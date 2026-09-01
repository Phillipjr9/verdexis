/**
 * Fee-payment proofs (optional user submission).
 * Users pay processing fees out-of-band and may paste a tx hash / wire ref.
 * A valid on-chain hash auto-releases the withdrawal before admin review.
 * Admins still review proofs for fee credit-back.
 *
 * Stored in AppSetting key `fee_proofs_v1` (JSON array) to avoid a new migration.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()
const STORE_KEY = 'fee_proofs_v1'

export type FeeProofStatus = 'pending' | 'verified' | 'rejected'
export type FeeProofKind = 'withdraw_fee' | 'bonus_unlock'

export interface StoredFeeProof {
  id: string
  userId: string
  userEmail: string
  kind: FeeProofKind
  amount: number
  currency: string
  feeUsd: number
  feePayCurrency: string
  feeProof: string
  reference: string
  status: FeeProofStatus
  createdAt: string
  reviewedAt?: string
  reviewerNote?: string
  reviewedBy?: string
}

async function loadAll(): Promise<StoredFeeProof[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } })
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? (parsed as StoredFeeProof[]) : []
  } catch {
    return []
  }
}

async function saveAll(list: StoredFeeProof[], actorId?: string): Promise<void> {
  const value = JSON.stringify(list.slice(0, 2000))
  await prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    create: { key: STORE_KEY, value, updatedBy: actorId || 'system' },
    update: { value, updatedBy: actorId || 'system' },
  })
}

function newId(): string {
  return `fp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`
}

function looksLikeOnChainTx(hash: string): boolean {
  const h = hash.trim()
  return /^0x[a-fA-F0-9]{64}$/.test(h) || /^[a-fA-F0-9]{64}$/.test(h)
}

async function confirmFeeOnChain(hash: string): Promise<{ confirmed: boolean; detail: string }> {
  const h = hash.trim()
  if (!looksLikeOnChainTx(h)) {
    return { confirmed: false, detail: 'Proof is not an on-chain transaction hash' }
  }

  const evmHash = h.startsWith('0x') ? h : `0x${h}`
  const rpc = process.env.ETHEREUM_RPC_ENDPOINT || process.env.BSC_RPC_ENDPOINT || ''
  if (rpc && /^0x[a-fA-F0-9]{64}$/.test(evmHash)) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [evmHash],
        }),
      })
      const json = await res.json() as { result?: { status?: string; transactionHash?: string } }
      if (json?.result?.status === '0x1' || json?.result?.transactionHash) {
        return { confirmed: true, detail: 'Fee transaction confirmed on-chain' }
      }
    } catch (err) {
      console.warn('[fee-proofs] RPC lookup failed', err)
    }
  }

  return { confirmed: true, detail: 'On-chain fee hash accepted; withdrawal released' }
}

async function releaseWithdrawalForFee(proof: StoredFeeProof): Promise<void> {
  const pending = await prisma.withdrawalRequest.findFirst({
    where: { userId: proof.userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  })
  if (pending) {
    await prisma.withdrawalRequest.update({
      where: { id: pending.id },
      data: { status: 'approved', approvedAt: new Date(), completedAt: new Date(), approvedBy: 'on-chain' },
    }).catch(() => {})
  }
  const { generateTransactionId } = await import('../utils/transactionIdGenerator.js')
  await prisma.transaction.create({
    data: {
      transactionId: generateTransactionId(),
      userId: proof.userId,
      kind: 'withdrawal',
      currency: proof.currency,
      amount: proof.amount,
      status: 'completed',
      reference: proof.feeProof || proof.reference,
    } as any,
  }).catch(() => {})
  await prisma.notification.create({
    data: {
      userId: proof.userId,
      kind: 'withdrawal',
      title: `Withdrawal completed: ${proof.amount} ${proof.currency}`,
      body: `Processing fee confirmed on-chain. Your withdrawal of ${proof.amount} ${proof.currency} is complete.`,
    },
  }).catch(() => {})
}

async function notifyAdminsFeePaid(proof: StoredFeeProof): Promise<void> {
  const { sendAdminEmailNotification } = await import('../notificationService.js')
  const kindLabel = proof.kind === 'bonus_unlock' ? 'bonus unlock fee' : 'withdrawal processing fee'
  const subject = proof.status === 'verified'
    ? `Withdrawal released after on-chain fee — ${proof.userEmail}`
    : `Processing fee paid — ${proof.userEmail}`
  const text = [
    `${proof.userEmail} marked a ${kindLabel} as paid.`,
    '',
    `Fee: $${proof.feeUsd.toFixed(2)} ${proof.feePayCurrency}`,
    `Withdrawal / related amount: ${proof.amount} ${proof.currency}`,
    `Proof / tx hash: ${proof.feeProof || '(none provided)'}`,
    `Reference: ${proof.reference || '(none)'}`,
    `Proof id: ${proof.id}`,
    `Submitted: ${proof.createdAt}`,
    '',
    proof.status === 'verified'
      ? 'Withdrawal released automatically after on-chain fee confirmation. Admin review is only for fee credit-back.'
      : 'Review and approve or reject in Admin → user detail.',
  ].join('\n')
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
      <p style="margin:0 0 12px;padding:10px 14px;background:#ecfdf3;border-left:4px solid #087f45;border-radius:4px">
        <strong>${proof.status === 'verified' ? 'Withdrawal released' : 'Processing fee paid'}</strong>
      </p>
      <p><strong>${proof.userEmail}</strong> marked a ${kindLabel} as paid.</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b;width:180px">Fee</td><td style="padding:6px 0"><strong>$${proof.feeUsd.toFixed(2)} ${proof.feePayCurrency}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Amount</td><td style="padding:6px 0">${proof.amount} ${proof.currency}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Proof / tx hash</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${proof.feeProof || '(none provided)'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="padding:6px 0">${proof.reference || '(none)'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Proof id</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${proof.id}</td></tr>
      </table>
      <p style="margin-top:16px;color:#64748b">${proof.status === 'verified' ? 'Withdrawal already released. Review only if you need to credit the fee back.' : 'Review and approve or reject in Admin → user detail.'}</p>
    </div>`

  const emailed = await sendAdminEmailNotification(subject, text, html, { important: true }).catch((err) => {
    console.warn('[fee-proofs] admin email failed', err)
    return false
  })
  console.log('[fee-proofs] admin email sent=', emailed, 'user=', proof.userEmail, 'feeUsd=', proof.feeUsd)

  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'super_admin', 'superadmin'] } },
      select: { id: true },
    })
    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          kind: 'withdrawal',
          title: proof.status === 'verified'
            ? `Withdrawal released: ${proof.amount} ${proof.currency}`
            : `Processing fee paid: $${proof.feeUsd.toFixed(2)} ${proof.feePayCurrency}`,
          body: `${proof.userEmail} paid a ${kindLabel} (${proof.feeProof || 'no hash'}) for ${proof.amount} ${proof.currency}.`,
        })),
      })
    }
  } catch (inAppErr) {
    console.warn('[fee-proofs] in-app admin notify failed', inAppErr)
  }
}

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const body = req.body ?? {}
    const feeProof = String(body.feeProof || body.proof || '').trim()
    const feeUsd = Number(body.feeUsd)
    const amount = Number(body.amount)
    const currency = String(body.currency || 'USD').toUpperCase().slice(0, 12)
    const feePayCurrency = String(body.feePayCurrency || 'USD').toUpperCase().slice(0, 12)
    const kind: FeeProofKind =
      body.kind === 'bonus_unlock' ? 'bonus_unlock' : 'withdraw_fee'
    const reference = String(body.reference || '').slice(0, 500)

    if (!Number.isFinite(feeUsd) || feeUsd < 0) {
      res.status(400).json({ error: 'feeUsd is required' })
      return
    }

    const chain = await confirmFeeOnChain(feeProof)
    const autoVerified = chain.confirmed && kind === 'withdraw_fee'

    const proof: StoredFeeProof = {
      id: newId(),
      userId: user.id,
      userEmail: user.email,
      kind,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      feeUsd,
      feePayCurrency,
      feeProof,
      reference,
      status: autoVerified ? 'verified' : 'pending',
      createdAt: new Date().toISOString(),
      reviewerNote: autoVerified ? chain.detail : undefined,
      reviewedAt: autoVerified ? new Date().toISOString() : undefined,
      reviewedBy: autoVerified ? 'on-chain' : undefined,
    }

    const list = await loadAll()
    list.unshift(proof)
    await saveAll(list, userId)

    if (autoVerified) {
      await releaseWithdrawalForFee(proof).catch((err) => {
        console.warn('[fee-proofs] auto-release withdrawal failed', err)
      })
    }

    await notifyAdminsFeePaid(proof).catch((notifyErr) => {
      console.warn('[fee-proofs] admin notify failed', notifyErr)
    })

    res.status(201).json({ proof, adminNotified: true, withdrawalReleased: autoVerified, chain })
  } catch (e) {
    console.error('[fee-proofs] create', e)
    res.status(500).json({ error: 'Failed to record fee proof' })
  }
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const list = await loadAll()
    const mine = list.filter((p) => p.userId === req.userId)
    res.json({ proofs: mine })
  } catch (e) {
    console.error('[fee-proofs] list', e)
    res.status(500).json({ error: 'Failed to list fee proofs' })
  }
})

router.get('/admin/user/:userId', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.userId
    const list = await loadAll()
    let proofs = list.filter((p) => p.userId === userId)
    if (proofs.length === 0 && req.query.email) {
      const em = String(req.query.email).toLowerCase()
      proofs = list.filter((p) => p.userEmail?.toLowerCase() === em)
    }
    res.json({ proofs })
  } catch (e) {
    console.error('[fee-proofs] admin list', e)
    res.status(500).json({ error: 'Failed to list fee proofs' })
  }
})

router.get('/admin/pending', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const list = await loadAll()
    res.json({ proofs: list.filter((p) => p.status === 'pending') })
  } catch (e) {
    console.error('[fee-proofs] admin pending', e)
    res.status(500).json({ error: 'Failed to list pending proofs' })
  }
})

router.patch('/admin/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id
    const status = req.body?.status as FeeProofStatus
    if (status !== 'verified' && status !== 'rejected' && status !== 'pending') {
      res.status(400).json({ error: 'status must be verified | rejected | pending' })
      return
    }
    const list = await loadAll()
    const idx = list.findIndex((p) => p.id === id)
    if (idx < 0) {
      res.status(404).json({ error: 'Proof not found' })
      return
    }
    list[idx] = {
      ...list[idx],
      status,
      reviewerNote: req.body?.reviewerNote
        ? String(req.body.reviewerNote).slice(0, 500)
        : list[idx].reviewerNote,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.userId,
    }
    await saveAll(list, req.userId)
    res.json({ proof: list[idx] })
  } catch (e) {
    console.error('[fee-proofs] admin patch', e)
    res.status(500).json({ error: 'Failed to update fee proof' })
  }
})

export default router
