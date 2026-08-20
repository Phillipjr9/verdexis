/**
 * Server-side fee-payment proof queue.
 *
 * Replaces the localStorage-only client queue (app/src/lib/feeProofs.ts).
 * Backed by FinancialEvent (eventType = 'fee_proof') so no schema migration
 * is required.
 *
 * User:
 *   POST   /api/fee-proofs          — submit proof
 *   GET    /api/fee-proofs/me       — list own proofs
 *
 * Admin:
 *   GET    /api/admin/fee-proofs              — list (filter by status)
 *   POST   /api/admin/fee-proofs/:id/verify   — mark verified + optional bonus unlock
 *   POST   /api/admin/fee-proofs/:id/reject   — mark rejected
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { recordLedgerTransaction } from '../services/ledger.js'

const router = Router()

const FEE_PROOF_EVENT = 'fee_proof'

type FeeProofKind = 'withdraw_fee' | 'bonus_unlock'
type FeeProofStatus = 'pending' | 'verified' | 'rejected'

type FeeProofDetails = {
  kind: FeeProofKind
  amount: number
  currency: string
  feeUsd: number
  feePayCurrency: string
  feeProof: string
  reference: string
  userEmail: string
  reviewerNote?: string
  reviewedBy?: string
  reviewedAt?: string
  creditedFee?: boolean
  unlockedBonus?: boolean
}

function parseDetails(raw: string | null | undefined): FeeProofDetails | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as FeeProofDetails
  } catch {
    return null
  }
}

function toPublic(ev: {
  id: string
  userId: string
  eventStatus: string
  details: string | null
  externalRef: string | null
  createdAt: Date
  completedAt: Date | null
  failedAt: Date | null
  failureReason: string | null
}) {
  const d = parseDetails(ev.details)
  return {
    id: ev.id,
    userId: ev.userId,
    status: (ev.eventStatus as FeeProofStatus) || 'pending',
    kind: d?.kind ?? 'withdraw_fee',
    amount: d?.amount ?? 0,
    currency: d?.currency ?? 'USD',
    feeUsd: d?.feeUsd ?? 0,
    feePayCurrency: d?.feePayCurrency ?? 'USD',
    feeProof: d?.feeProof ?? '',
    reference: d?.reference ?? '',
    userEmail: d?.userEmail ?? '',
    reviewerNote: d?.reviewerNote ?? ev.failureReason ?? undefined,
    reviewedAt: d?.reviewedAt ?? (ev.completedAt || ev.failedAt)?.toISOString(),
    createdAt: ev.createdAt.toISOString(),
    externalRef: ev.externalRef,
    creditedFee: d?.creditedFee === true,
    unlockedBonus: d?.unlockedBonus === true,
  }
}

const submitSchema = z.object({
  kind: z.enum(['withdraw_fee', 'bonus_unlock']).default('withdraw_fee'),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  feeUsd: z.number().nonnegative(),
  feePayCurrency: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  feeProof: z.string().min(3).max(500).trim(),
  reference: z.string().max(500).optional().default(''),
})

// ─── User routes ────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const userId = req.userId!
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, suspended: true },
  })
  if (!user || user.suspended) {
    res.status(403).json({ error: 'Account not available' })
    return
  }

  const data = parsed.data
  const externalRef = `fee_proof:${userId}:${data.kind}:${data.feeProof.slice(0, 64)}:${Date.now()}`
  const details: FeeProofDetails = {
    kind: data.kind,
    amount: data.amount,
    currency: data.currency,
    feeUsd: data.feeUsd,
    feePayCurrency: data.feePayCurrency,
    feeProof: data.feeProof,
    reference: data.reference || '',
    userEmail: user.email,
  }

  try {
    const ev = await prisma.financialEvent.create({
      data: {
        userId,
        eventType: FEE_PROOF_EVENT,
        eventStatus: 'pending',
        details: JSON.stringify(details),
        externalRef,
        idempotencyKey: externalRef,
      },
    })

    await prisma.notification
      .create({
        data: {
          userId,
          kind: 'system',
          title: 'Fee proof submitted',
          body: `Your ${data.kind === 'bonus_unlock' ? 'bonus unlock' : 'withdrawal fee'} proof is pending admin review.`,
        },
      })
      .catch(() => {})

    try {
      await prisma.adminAudit.create({
        data: {
          actorId: userId,
          action: 'fee_proof.submit',
          targetUserId: userId,
          payload: JSON.stringify({
            id: ev.id,
            kind: data.kind,
            feeUsd: data.feeUsd,
            feeProof: data.feeProof.slice(0, 120),
          }).slice(0, 4000),
        },
      })
    } catch {
      /* ignore */
    }

    res.status(201).json({ proof: toPublic(ev) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/Unique constraint|P2002/i.test(msg)) {
      res.status(409).json({ error: 'Duplicate proof submission' })
      return
    }
    console.error('[feeProofs] submit failed', msg)
    res.status(500).json({ error: 'Failed to submit fee proof' })
  }
})

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.financialEvent.findMany({
    where: { userId: req.userId!, eventType: FEE_PROOF_EVENT },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ proofs: rows.map(toPublic) })
})

export const adminFeeProofRouter = Router()
adminFeeProofRouter.use(requireAuth)
adminFeeProofRouter.use(requireAdmin)

adminFeeProofRouter.get('/', async (req: AuthedRequest, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending'
  const where: Record<string, unknown> = { eventType: FEE_PROOF_EVENT }
  if (status !== 'all') where.eventStatus = status

  const rows = await prisma.financialEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  res.json({
    proofs: rows.map((r) => ({
      ...toPublic(r),
      user: r.user,
    })),
  })
})

const reviewSchema = z.object({
  note: z.string().max(500).optional(),
  creditFee: z.boolean().default(true),
  unlockBonus: z.boolean().default(true),
  notify: z.boolean().default(true),
})

adminFeeProofRouter.post('/:id/verify', async (req: AuthedRequest, res) => {
  const parsed = reviewSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const ev = await prisma.financialEvent.findUnique({ where: { id: req.params.id } })
  if (!ev || ev.eventType !== FEE_PROOF_EVENT) {
    res.status(404).json({ error: 'Fee proof not found' })
    return
  }
  if (ev.eventStatus !== 'pending') {
    res.status(409).json({ error: `Already ${ev.eventStatus}` })
    return
  }

  const details = parseDetails(ev.details) || ({} as FeeProofDetails)
  let creditedFee = false
  let unlockedBonus = false

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.creditFee && details.kind === 'withdraw_fee' && details.feeUsd > 0) {
        const opKey = `fee_proof_credit:${ev.id}`
        await recordLedgerTransaction({
          tx,
          userId: ev.userId,
          asset: 'USD',
          amount: details.feeUsd,
          entryType: 'debit',
          kind: 'deposit',
          eventType: 'fee_proof_credit',
          sourceType: 'fee_proof',
          sourceId: ev.id,
          externalRef: opKey,
          idempotencyKey: opKey,
          description: `Fee proof credit (ref ${details.feeProof?.slice(0, 24) || ev.id})`,
          reference: `Fee proof verified — $${details.feeUsd} USD returned`,
          createdBy: req.userId!,
          subType: 'fee_proof_credit',
          recordTransaction: true,
        })
        creditedFee = true
      }

      if (parsed.data.unlockBonus && details.kind === 'bonus_unlock') {
        const user = await tx.user.findUnique({ where: { id: ev.userId }, select: { prefs: true } })
        let prefs: Record<string, unknown> = {}
        try {
          if (user?.prefs) prefs = JSON.parse(user.prefs)
        } catch {
          prefs = {}
        }
        const lock = prefs.bonusLock as Record<string, unknown> | undefined
        if (lock && lock.active) {
          prefs.bonusLock = {
            ...lock,
            active: false,
            unlockedAt: new Date().toISOString(),
            unlockedBy: req.userId!,
            unlockNote: parsed.data.note?.trim() || 'Fee proof verified',
            feeProofId: ev.id,
          }
          await tx.user.update({
            where: { id: ev.userId },
            data: { prefs: JSON.stringify(prefs) },
          })
          unlockedBonus = true
        }
      }

      const nextDetails: FeeProofDetails = {
        ...details,
        reviewerNote: parsed.data.note?.trim() || undefined,
        reviewedBy: req.userId!,
        reviewedAt: new Date().toISOString(),
        creditedFee,
        unlockedBonus,
      }

      await tx.financialEvent.update({
        where: { id: ev.id },
        data: {
          eventStatus: 'verified',
          completedAt: new Date(),
          details: JSON.stringify(nextDetails),
        },
      })
    })
  } catch (err) {
    console.error('[feeProofs] verify failed', err instanceof Error ? err.message : err)
    res.status(500).json({ error: 'Failed to verify fee proof' })
    return
  }

  if (parsed.data.notify) {
    await prisma.notification
      .create({
        data: {
          userId: ev.userId,
          kind: 'system',
          title: details.kind === 'bonus_unlock' ? 'Bonus unlocked' : 'Fee proof verified',
          body:
            details.kind === 'bonus_unlock'
              ? 'Your fee proof was accepted. Bonus withdrawal lock has been released.'
              : creditedFee
                ? `Fee proof accepted. $${details.feeUsd} USD has been credited back to your balance.`
                : 'Your fee proof was accepted by admin.',
        },
      })
      .catch(() => {})
  }

  try {
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        action: 'fee_proof.verify',
        targetUserId: ev.userId,
        payload: JSON.stringify({
          id: ev.id,
          kind: details.kind,
          creditedFee,
          unlockedBonus,
          note: parsed.data.note,
        }).slice(0, 4000),
      },
    })
  } catch {
    /* ignore */
  }

  const updated = await prisma.financialEvent.findUnique({ where: { id: ev.id } })
  res.json({
    proof: updated ? toPublic(updated) : null,
    creditedFee,
    unlockedBonus,
  })
})

adminFeeProofRouter.post('/:id/reject', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ note: z.string().max(500).optional(), notify: z.boolean().default(true) })
    .safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const ev = await prisma.financialEvent.findUnique({ where: { id: req.params.id } })
  if (!ev || ev.eventType !== FEE_PROOF_EVENT) {
    res.status(404).json({ error: 'Fee proof not found' })
    return
  }
  if (ev.eventStatus !== 'pending') {
    res.status(409).json({ error: `Already ${ev.eventStatus}` })
    return
  }

  const details = parseDetails(ev.details) || ({} as FeeProofDetails)
  const nextDetails: FeeProofDetails = {
    ...details,
    reviewerNote: parsed.data.note?.trim() || undefined,
    reviewedBy: req.userId!,
    reviewedAt: new Date().toISOString(),
  }

  const updated = await prisma.financialEvent.update({
    where: { id: ev.id },
    data: {
      eventStatus: 'rejected',
      failedAt: new Date(),
      failureReason: parsed.data.note?.trim() || 'Rejected by admin',
      details: JSON.stringify(nextDetails),
    },
  })

  if (parsed.data.notify) {
    await prisma.notification
      .create({
        data: {
          userId: ev.userId,
          kind: 'system',
          title: 'Fee proof rejected',
          body:
            parsed.data.note?.trim() ||
            'Your fee payment proof could not be verified. Contact support if you believe this is an error.',
        },
      })
      .catch(() => {})
  }

  try {
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        action: 'fee_proof.reject',
        targetUserId: ev.userId,
        payload: JSON.stringify({ id: ev.id, note: parsed.data.note }).slice(0, 4000),
      },
    })
  } catch {
    /* ignore */
  }

  res.json({ proof: toPublic(updated) })
})

export default router
