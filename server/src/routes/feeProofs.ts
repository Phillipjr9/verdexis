/**
 * Fee-payment proofs (optional user submission).
 * Users pay processing fees out-of-band and may paste a tx hash / wire ref.
 * Admins review proofs on the user detail page and credit the fee back.
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
  /** Optional — user may submit without a hash */
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

async function notifyAdminsFeePaid(proof: StoredFeeProof): Promise<void> {
  const { sendAdminEmailNotification } = await import('../notificationService.js')
  const kindLabel = proof.kind === 'bonus_unlock' ? 'bonus unlock fee' : 'withdrawal processing fee'
  const subject = `Processing fee paid — ${proof.userEmail}`
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
    'Review and approve or reject in Admin → user detail.',
  ].join('\n')
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
      <p style="margin:0 0 12px;padding:10px 14px;background:#ecfdf3;border-left:4px solid #087f45;border-radius:4px">
        <strong>Processing fee paid</strong>
      </p>
      <p><strong>${proof.userEmail}</strong> marked a ${kindLabel} as paid.</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b;width:180px">Fee</td><td style="padding:6px 0"><strong>$${proof.feeUsd.toFixed(2)} ${proof.feePayCurrency}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Amount</td><td style="padding:6px 0">${proof.amount} ${proof.currency}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Proof / tx hash</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${proof.feeProof || '(none provided)'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="padding:6px 0">${proof.reference || '(none)'}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Proof id</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${proof.id}</td></tr>
      </table>
      <p style="margin-top:16px;color:#64748b">Review and approve or reject in Admin → user detail.</p>
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
          title: `Processing fee paid: $${proof.feeUsd.toFixed(2)} ${proof.feePayCurrency}`,
          body: `${proof.userEmail} paid a ${kindLabel} (${proof.feeProof || 'no hash'}) for ${proof.amount} ${proof.currency}.`,
        })),
      })
    }
  } catch (inAppErr) {
    console.warn('[fee-proofs] in-app admin notify failed', inAppErr)
  }
}

/** POST /api/fee-proofs — user submits optional proof */
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
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    const list = await loadAll()
    list.unshift(proof)
    await saveAll(list, userId)

    // Always email ADMIN_EMAIL / ADMIN_EMAILS — do not gate on DB admin rows.
    await notifyAdminsFeePaid(proof).catch((notifyErr) => {
      console.warn('[fee-proofs] admin notify failed', notifyErr)
    })

    res.status(201).json({ proof, adminNotified: true })
  } catch (e) {
    console.error('[fee-proofs] create', e)
    res.status(500).json({ error: 'Failed to record fee proof' })
  }
})

/** GET /api/fee-proofs — current user sees their own */
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

/** GET /api/fee-proofs/admin/user/:userId — admin list for a user */
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

/** GET /api/fee-proofs/admin/pending — all pending */
router.get('/admin/pending', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const list = await loadAll()
    res.json({ proofs: list.filter((p) => p.status === 'pending') })
  } catch (e) {
    console.error('[fee-proofs] admin pending', e)
    res.status(500).json({ error: 'Failed to list pending proofs' })
  }
})

/** PATCH /api/fee-proofs/admin/:id — approve / reject */
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
