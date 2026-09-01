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

    try {
      const { sendAdminEmailNotification } = await import('../notificationService.js')
      const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true } })
      if (admins.length) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            kind: 'withdrawal',
            title: `Fee payment submitted: $${feeUsd.toFixed(2)} ${feePayCurrency}`,
            body: `${user.email} submitted a ${kind} proof (${feeProof || 'no hash'}) for ${amount} ${currency}. Approve or reject on the user page.`,
          })),
        })
        await sendAdminEmailNotification(
          `Fee payment submitted — ${user.email}`,
          `${user.email} submitted a ${kind.replace('_', ' ')} payment of $${feeUsd.toFixed(2)} ${feePayCurrency}.\nAmount: ${amount} ${currency}\nProof: ${feeProof || '(none)'}\nReference: ${reference}\n\nReview and approve or reject in Admin → user detail.`,
        ).catch(() => {})
      }
    } catch (notifyErr) {
      console.warn('[fee-proofs] admin notify failed', notifyErr)
    }

    res.status(201).json({ proof })
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
