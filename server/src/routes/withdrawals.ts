import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { generateTransactionId } from '../utils/transactionIdGenerator.js'
import { idempotency } from '../idempotency.js'

const router = Router()
const CHECK_METHODS = new Set(['check', 'cashier_check', 'wire_check'])

const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip || 'anon',
})

router.get('/config', requireAuth, async (_req, res) => {
  res.json({
    enabled: true,
    networks: [],
    methods: { crypto: true, wire: true, ach: true, cashier_check: true, wire_check: true },
    message: 'Withdrawals (crypto, wire, ACH, cashier check, wire check) are available. Check and bank methods are processed manually by an administrator.',
  })
})

const withdrawalSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  asset: z.string().min(1).max(12),
  destinationAddress: z.string().min(1).max(256).optional(),
  chain: z.enum(['solana', 'ethereum', 'bitcoin', 'bsc']).optional(),
  tokenAddress: z.string().min(1).max(128).optional(),
  memo: z.string().max(256).optional(),
  withdrawalMethod: z.enum(['crypto', 'wire', 'ach', 'check', 'cashier_check', 'wire_check']).default('crypto'),
  checkType: z.enum(['cashier_check', 'wire_check']).optional(),
})

function syntheticCheckAddress(method: string, payee: string, userId: string): string {
  const safePayee = payee.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 40).trim() || 'payee'
  return `CHECK:${method}:${userId.slice(0, 12)}:${safePayee}`.slice(0, 128)
}

router.post('/', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = withdrawalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  let { amount, asset, destinationAddress, withdrawalMethod, checkType, memo } = parsed.data
  if (withdrawalMethod === 'check') {
    withdrawalMethod = checkType === 'wire_check' ? 'wire_check' : 'cashier_check'
  }
  const isCheck = CHECK_METHODS.has(withdrawalMethod)

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { prefs: true } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let userPrefs: Record<string, unknown> = {}
    try {
      if (user.prefs) userPrefs = JSON.parse(user.prefs)
    } catch {
      userPrefs = {}
    }

    let targetAddress = (destinationAddress || '').trim()
    let linkProvider = 'user'
    let linkChainId: string | null = null
    let checkConfig: { types?: string[]; payeeName?: string; mailingAddress?: Record<string, string> } | null = null

    if (isCheck) {
      checkConfig = (userPrefs.withdrawalCheck as typeof checkConfig) || null
      if (!checkConfig?.types?.length || !checkConfig.payeeName || !checkConfig.mailingAddress?.line1) {
        res.status(400).json({ error: 'Check withdrawal is not configured for your account. Contact support.' })
        return
      }
      if (!checkConfig.types.includes(withdrawalMethod)) {
        res.status(400).json({ error: `Check type "${withdrawalMethod}" is not enabled.` })
        return
      }
      targetAddress = syntheticCheckAddress(withdrawalMethod, checkConfig.payeeName, req.userId!)
      linkProvider = 'check'
      linkChainId = withdrawalMethod
    } else if (withdrawalMethod === 'wire') {
      if (!userPrefs.withdrawalWire) {
        res.status(400).json({ error: 'Wire withdrawal is not configured. Contact support.' })
        return
      }
      const w = userPrefs.withdrawalWire as { beneficiaryName?: string; accountNumber?: string }
      targetAddress =
        targetAddress ||
        `WIRE:${(w.beneficiaryName || 'user').slice(0, 40)}:${(w.accountNumber || '').slice(-4)}`
      linkProvider = 'wire'
      linkChainId = 'wire'
    } else if (withdrawalMethod === 'ach') {
      if (!userPrefs.withdrawalAch) {
        res.status(400).json({ error: 'ACH withdrawal is not configured. Contact support.' })
        return
      }
      const a = userPrefs.withdrawalAch as { institution?: string; accountMask?: string }
      targetAddress =
        targetAddress || `ACH:${(a.institution || 'bank').slice(0, 40)}:${a.accountMask || '****'}`
      linkProvider = 'ach'
      linkChainId = 'ach'
    } else if (!targetAddress) {
      res.status(400).json({ error: 'Destination address is required for crypto withdrawals' })
      return
    }

    const processingFee = isCheck ? 0 : 0
    const normalizedAsset = asset.toUpperCase()
    const totalDebit = amount + processingFee

    const prepared = await prisma.$transaction(async (tx) => {
      const walletLink = await tx.walletLink.upsert({
        where: { userId_address: { userId: req.userId!, address: targetAddress } },
        create: {
          userId: req.userId!,
          address: targetAddress,
          chainId: linkChainId,
          provider: linkProvider,
          isPrimary: false,
          label: isCheck
            ? `${withdrawalMethod === 'wire_check' ? 'Wire check' : "Cashier's check"} → ${checkConfig?.payeeName || ''}`
            : undefined,
        },
        update: { chainId: linkChainId, provider: linkProvider },
      })

      const holding = await tx.holding.findUnique({
        where: { userId_symbol: { userId: req.userId!, symbol: normalizedAsset } },
      })
      if (!holding || holding.amount < totalDebit) {
        throw Object.assign(new Error('Insufficient balance for withdrawal'), { status: 400 })
      }

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: req.userId!,
          walletLinkId: walletLink.id,
          amount,
          asset: normalizedAsset,
          fee: processingFee,
          status: 'pending',
        },
      })

      await tx.holding.update({
        where: { id: holding.id },
        data: { amount: { decrement: totalDebit } },
      })

      try {
        await tx.adminAudit.create({
          data: {
            actorId: req.userId!,
            action: 'withdrawal.request',
            targetUserId: req.userId!,
            payload: JSON.stringify({
              withdrawalId: withdrawal.id,
              method: withdrawalMethod,
              amount,
              asset: normalizedAsset,
              memo: memo || null,
              check: isCheck
                ? {
                    type: withdrawalMethod,
                    payeeName: checkConfig?.payeeName,
                    mailingAddress: checkConfig?.mailingAddress,
                  }
                : null,
            }).slice(0, 4000),
          },
        })
      } catch {
        /* ignore */
      }

      return { withdrawal, method: withdrawalMethod }
    })

    const typeLabel =
      prepared.method === 'wire_check'
        ? 'wire check'
        : prepared.method === 'cashier_check'
          ? "cashier's check"
          : prepared.method

    await prisma.notification
      .create({
        data: {
          userId: req.userId!,
          kind: 'withdrawal',
          title: `Withdrawal queued: ${amount} ${normalizedAsset}`,
          body: isCheck
            ? `Your ${typeLabel} withdrawal is pending. A check will be mailed after admin review.`
            : `Your ${typeLabel} withdrawal is queued for processing.`,
        },
      })
      .catch(() => {})

    res.status(201).json({
      withdrawal: prepared.withdrawal,
      transfer: { status: 'pending', message: `Queued as ${typeLabel}`, txHash: null },
      method: prepared.method,
      processingFee,
      totalDebit,
    })
  } catch (err) {
    const error = err as Error & { status?: number }
    console.error('[withdrawals] POST error:', error)
    res.status(error.status || 500).json({
      error: error.status && error.status < 500 ? error.message : 'An error occurred. Please try again.',
    })
  }
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const withdrawals = await prisma.withdrawalRequest.findMany({
    where: { userId: req.userId! },
    include: { walletLink: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json({ withdrawals })
})

router.get('/admin/pending', requireAuth, requireAdmin, async (_req, res) => {
  const pending = await prisma.withdrawalRequest.findMany({
    where: { status: 'pending' },
    include: { user: true, walletLink: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  res.json({ withdrawals: pending })
})

router.put('/admin/:id/approve', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      txHash: z.string().min(1).max(128).optional(),
      trackingRef: z.string().min(1).max(128).optional(),
      fee: z.number().nonnegative().optional(),
      note: z.string().max(500).optional(),
    })
    .safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const withdrawalId = req.params['id']
  if (!withdrawalId) {
    res.status(400).json({ error: 'Withdrawal id is required' })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { walletLink: true },
      })
      if (!withdrawal) throw Object.assign(new Error('Withdrawal not found'), { status: 404 })
      if (withdrawal.status !== 'pending') {
        throw Object.assign(new Error('Withdrawal already processed'), { status: 400 })
      }

      const isFiat =
        withdrawal.walletLink?.provider === 'check' ||
        withdrawal.walletLink?.provider === 'wire' ||
        withdrawal.walletLink?.provider === 'ach' ||
        (withdrawal.walletLink?.address || '').startsWith('CHECK:')

      let ref = body.data.txHash || body.data.trackingRef || null
      if (!isFiat) {
        if (!ref || !/^0x[a-fA-F0-9]{64}$/.test(ref)) {
          throw Object.assign(new Error('Valid 0x transaction hash required for crypto withdrawals'), {
            status: 400,
          })
        }
        ref = ref.toLowerCase()
      } else if (!ref) {
        ref = `manual:${Date.now()}`
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: 'approved',
          txHash: ref,
          fee: body.data.fee ?? withdrawal.fee ?? 0,
          approvedBy: req.userId!,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      })

      await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(),
          userId: withdrawal.userId,
          kind: 'withdrawal',
          currency: withdrawal.asset,
          amount: withdrawal.amount,
          status: 'completed',
          reference: ref,
        } as any,
      })

      const isCheck =
        withdrawal.walletLink?.provider === 'check' ||
        (withdrawal.walletLink?.address || '').startsWith('CHECK:')
      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          kind: 'withdrawal',
          title: `Withdrawal approved: ${withdrawal.amount} ${withdrawal.asset}`,
          body: isCheck
            ? `Your check has been mailed${body.data.note ? `: ${body.data.note}` : '.'}`
            : 'Your withdrawal has been approved and sent.',
        },
      })

      return updated
    })
    res.json({ withdrawal: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    res.status(error.status || 500).json({ error: error.message || 'Failed' })
  }
})

router.put('/admin/:id/reject', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body)
  const withdrawalId = req.params['id']
  if (!withdrawalId) {
    res.status(400).json({ error: 'Withdrawal id is required' })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } })
      if (!withdrawal) throw Object.assign(new Error('Withdrawal not found'), { status: 404 })
      if (withdrawal.status !== 'pending') {
        throw Object.assign(new Error('Withdrawal already processed'), { status: 400 })
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: 'rejected', rejectedReason: reason },
      })

      await recordLedgerTransaction({
        tx,
        userId: withdrawal.userId,
        asset: withdrawal.asset,
        amount: withdrawal.amount + (withdrawal.fee ?? 0),
        entryType: 'credit',
        kind: 'deposit',
        eventType: 'withdrawal_reject',
        sourceType: 'withdrawal_reject',
        sourceId: `withdrawal_reject:${withdrawal.id}`,
        externalRef: `withdrawal_reject:${withdrawal.id}`,
        description: `Withdrawal rejected refund for ${withdrawal.asset}`,
        reference: `Withdrawal rejected refund for ${withdrawal.asset}`,
        subType: 'withdrawal_reject',
        recordTransaction: true,
      })

      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          kind: 'withdrawal',
          title: `Withdrawal rejected: ${withdrawal.amount} ${withdrawal.asset}`,
          body: `Reason: ${reason}. Amount refunded to your account.`,
        },
      })

      return updated
    })
    res.json({ withdrawal: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    res.status(error.status || 500).json({ error: error.message || 'Failed' })
  }
})

export default router
