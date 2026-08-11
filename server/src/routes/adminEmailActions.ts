import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { verifyDepositActionToken } from '../services/adminEmailActions.js'

const router = Router()
const actionLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })
router.use(actionLimiter)

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function page(title: string, message: string, actionButton?: { label: string; actionUrl: string }, autoSubmit = false): string {
  const controls = actionButton
    ? `<p><strong>Admin action:</strong></p><form id="actionForm" method="post" action="${actionButton.actionUrl}"><button style="background:#087f45;color:white;padding:12px 22px;border:0;border-radius:6px;font-weight:bold">${escapeHtml(actionButton.label)}</button></form>`
    : ''
  const script = autoSubmit && actionButton
    ? `<script>window.addEventListener('DOMContentLoaded',()=>{const f=document.getElementById('actionForm');if(f){f.submit();}});</script><noscript><p style="color:#b42318">JavaScript is required to complete this action automatically. Click the button above to continue.</p></noscript>`
    : ''
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:620px;margin:40px auto;padding:24px;color:#172026"><h1>${escapeHtml(title)}</h1><div style="white-space:pre-wrap;margin-bottom:18px">${escapeHtml(message)}</div>${controls}${script}<hr><p style="font-size:12px;color:#667085">Verdexis admin action. Never share this link.</p></body></html>`
}

async function approveDeposit(depositId: string, actor: string) {
  const pending = await prisma.pendingDeposit.findUnique({ where: { id: depositId } })
  if (!pending) return { status: 404, message: 'Deposit not found' }
  if (pending.status !== 'pending') {
    const state = pending.status === 'credited' || pending.status === 'completed' ? 'approved' : pending.status === 'rejected' ? 'rejected' : pending.status
    return { status: 409, message: `This deposit was already ${state}.` }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ledgerResult = await recordLedgerTransaction({
        tx, userId: pending.userId, asset: pending.asset, amount: pending.amount,
        entryType: 'debit', kind: 'deposit', eventType: 'pending_deposit_approved',
        sourceType: 'pending_deposit', sourceId: pending.id,
        externalRef: `pending-deposit:${pending.id}`, idempotencyKey: pending.id,
        description: `Approved pending deposit ${pending.id}`,
        metadata: { txHash: pending.txHash, chainId: pending.chainId, fromAddress: pending.fromAddress, toAddress: pending.toAddress, approvedBy: actor, approvalMethod: 'email' },
        createdBy: actor, reference: `On-chain deposit ${pending.txHash.slice(0, 14)}...`, recordTransaction: false,
      })
      const updated = await tx.pendingDeposit.updateMany({ where: { id: pending.id, status: 'pending' }, data: { status: 'credited', creditedTxId: ledgerResult.entry?.id ?? undefined } })
      if (updated.count !== 1) throw new Error('Deposit was already processed by another action.')
      await tx.adminAudit.create({ data: { actorId: actor, action: 'pendingDeposit.approve.email', targetUserId: pending.userId, payload: JSON.stringify({ pendingDepositId: pending.id, amount: pending.amount, asset: pending.asset, adminId: actor }) } })
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('already processed by another action')) {
      return { status: 409, message: 'This deposit was already processed by another action.' }
    }
    throw err
  }

  await prisma.notification.create({ data: { userId: pending.userId, kind: 'deposit', title: `Deposit credited: ${pending.amount} ${pending.asset}`, body: 'Your deposit was verified and credited by the Verdexis admin team.' } }).catch(() => {})
  return { status: 200, message: `Deposit ${pending.id} approved and credited successfully.` }
}

async function rejectDeposit(depositId: string, actor: string) {
  const pending = await prisma.pendingDeposit.findUnique({ where: { id: depositId } })
  if (!pending) return { status: 404, message: 'Deposit not found' }
  if (pending.status !== 'pending') {
    const state = pending.status === 'credited' || pending.status === 'completed' ? 'approved' : pending.status === 'rejected' ? 'rejected' : pending.status
    return { status: 409, message: `This deposit was already ${state}.` }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.pendingDeposit.updateMany({ where: { id: pending.id, status: 'pending' }, data: { status: 'rejected', note: 'Rejected by admin email action' } })
      if (updated.count !== 1) throw new Error('Deposit was already processed by another action.')
      await tx.adminAudit.create({ data: { actorId: actor, action: 'pendingDeposit.reject.email', targetUserId: pending.userId, payload: JSON.stringify({ pendingDepositId: pending.id, amount: pending.amount, asset: pending.asset, adminId: actor }) } })
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('already processed by another action')) {
      return { status: 409, message: 'This deposit was already processed by another action.' }
    }
    throw err
  }

  await prisma.notification.create({ data: { userId: pending.userId, kind: 'deposit', title: 'Deposit rejected', body: 'Your deposit was reviewed and rejected by the Verdexis admin team.' } }).catch(() => {})
  return { status: 200, message: `Deposit ${pending.id} rejected.` }
}

router.get('/:token', async (req, res) => {
  const payload = verifyDepositActionToken(req.params.token)
  if (!payload) { res.status(401).type('html').send(page('Link expired', 'This admin action link is invalid or expired.')); return }
  const deposit = await prisma.pendingDeposit.findUnique({ where: { id: payload.depositId }, include: { user: { select: { email: true, name: true } } } })
  if (!deposit) { res.status(404).type('html').send(page('Deposit not found', 'This deposit no longer exists.')); return }
  if (deposit.status !== 'pending') {
    res.status(409).type('html').send(page('Deposit already processed', `This deposit has already been ${deposit.status}. No further action is possible.`))
    return
  }

  const actionUrl = `/api/admin/email-actions/${encodeURIComponent(req.params.token)}/${payload.action}`
  const label = payload.action === 'approve' ? 'YES - APPROVE DEPOSIT' : 'NO - REJECT DEPOSIT'
  const message = `User: ${deposit.user.name} (${deposit.user.email})\nAmount: ${deposit.amount} ${deposit.asset}\nTransaction: ${deposit.txHash}\nNetwork: ${deposit.chainId}\nStatus: ${deposit.status}\n\nThis link is bound to admin account: ${payload.adminEmail}. The action is processed automatically when this page opens.`
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer').set('X-Robots-Tag', 'noindex').type('html').send(page('Deposit approval required', message, { label, actionUrl }, true))
})

router.post('/:token/approve', async (req, res) => {
  const payload = verifyDepositActionToken(req.params.token)
  if (!payload || payload.action !== 'approve') { res.status(401).type('html').send(page('Link expired', 'This approval link is invalid or expired.')); return }
  const admin = await prisma.user.findFirst({ where: { email: payload.adminEmail.toLowerCase(), role: 'admin' }, select: { id: true } })
  if (!admin) { res.status(403).type('html').send(page('Unauthorized admin', 'This action is no longer available for this administrator.')); return }
  const result = await approveDeposit(payload.depositId, admin.id)
  res.status(result.status).set('Cache-Control', 'no-store').type('html').send(page(result.status === 200 ? 'Deposit approved' : 'Approval not completed', result.message))
})

router.post('/:token/reject', async (req, res) => {
  const payload = verifyDepositActionToken(req.params.token)
  if (!payload || payload.action !== 'reject') { res.status(401).type('html').send(page('Link expired', 'This rejection link is invalid or expired.')); return }
  const admin = await prisma.user.findFirst({ where: { email: payload.adminEmail.toLowerCase(), role: 'admin' }, select: { id: true } })
  if (!admin) { res.status(403).type('html').send(page('Unauthorized admin', 'This action is no longer available for this administrator.')); return }
  const result = await rejectDeposit(payload.depositId, admin.id)
  res.status(result.status).set('Cache-Control', 'no-store').type('html').send(page(result.status === 200 ? 'Deposit rejected' : 'Rejection not completed', result.message))
})

export default router
