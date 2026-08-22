import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { sendEmailNotification } from '../notificationService.js'
import { idempotency } from '../idempotency.js'
import {
  creditReferralBonus,
  activateReferralOnDeposit,
  readReferralSettings,
  writeReferralSettings,
} from '../referrals.js'
import { recordLedgerTransaction } from '../services/ledger.js'

const router = Router()

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(adminLimiter)
router.use(requireAuth)
router.use(requireAdmin)

async function audit(actorId: string, action: string, targetUserId: string | null, payload: unknown) {
  try {
    await prisma.adminAudit.create({
      data: {
        actorId,
        action,
        targetUserId: targetUserId ?? undefined,
        payload: payload === undefined ? null : JSON.stringify(payload).slice(0, 4000),
      },
    })
  } catch (e) {
    console.error('[admin audit] failed:', e instanceof Error ? e.message : e)
  }
}

function getIdempotencyKey(req: AuthedRequest): string | undefined {
  const h = req.headers['idempotency-key']
  if (typeof h === 'string' && h.trim()) return h.trim().slice(0, 200)
  return undefined
}

const DEPOSIT_REASONS = [
  'manual_bank_wire', 'manual_crypto', 'promo_credit', 'refund', 'chargeback_reversal',
  'bonus_referral', 'compensation', 'correction_undercharge', 'other',
] as const

const DEDUCT_REASONS = [
  'manual_bank_wire', 'manual_crypto', 'fee', 'chargeback', 'fraud_reversal',
  'compliance_sanctions', 'correction_overcharge', 'court_order', 'other',
] as const

const TRANSFER_REASONS = [
  'internal_correction', 'gift', 'family_transfer', 'payroll', 'refund', 'other',
  'court_order', 'dispute_resolution', 'fraud_recovery', 'compliance_directive',
  'merger_consolidation', 'manual_correction',
] as const

const depositSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  symbol: z.string().min(1).max(10).optional(),
  amount: z.number().positive(),
  reason: z.enum(DEPOSIT_REASONS).default('manual_bank_wire'),
  note: z.string().max(500).optional(),
  status: z.enum(['pending', 'completed']).default('completed'),
  notify: z.boolean().default(true),
  occurredAt: z.string().datetime().optional(),
})

const deductSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  symbol: z.string().min(1).max(10).optional(),
  amount: z.number().positive(),
  reason: z.enum(DEDUCT_REASONS).default('fee'),
  note: z.string().max(500).optional(),
  status: z.enum(['pending', 'completed', 'reversed']).default('completed'),
  allowNegative: z.boolean().default(false),
  notify: z.boolean().default(true),
})

const transferSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  amount: z.number().positive(),
  reason: z.enum(TRANSFER_REASONS).default('internal_correction'),
  note: z.string().max(500).optional(),
  allowNegative: z.boolean().default(false),
  notify: z.boolean().default(true),
})

const referralSettingsSchema = z.object({
  enabled: z.boolean(),
  referrerBonusUsd: z.number().min(0).max(1_000_000),
  refereeBonusUsd: z.number().min(0).max(1_000_000),
  minDepositUsd: z.number().min(0).max(1_000_000),
  note: z.string().max(500).optional().or(z.literal('')),
})

router.get('/stats', async (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [
      users, admins, suspended, holdings, trades, alerts,
      deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { suspended: true } }),
      prisma.holding.count().catch(() => 0),
      prisma.trade.count().catch(() => 0),
      prisma.priceAlert.count({ where: { active: true } }).catch(() => 0),
      prisma.transaction.count({ where: { kind: 'deposit', createdAt: { gte: since } } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { holdActive: true } }),
      prisma.user.count({ where: { kycStatus: 'pending' } }),
      prisma.transaction.count({ where: { kind: 'withdraw', createdAt: { gte: since } } }),
      prisma.transaction.count({ where: { kind: 'deposit', status: 'pending' } }),
    ])
    const recentSignups = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, email: true, name: true, createdAt: true, role: true, suspended: true },
    })
    const recentTx = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, email: true, name: true } } },
    }).catch(() => [])
    res.json({
      stats: {
        users, admins, suspended, holdings, trades, alerts,
        deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits,
      },
      recentSignups,
      recentTx,
      lastBroadcast: null,
    })
  } catch (e) {
    console.error('[admin] stats', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'error' })
  }
})

router.get('/users', async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25))
    const skip = (page - 1) * limit
    const q = String(req.query.q || '').trim()
    const role = String(req.query.role || 'all')
    const suspended = String(req.query.suspended || 'all')
    const kycStatus = String(req.query.kycStatus || '')

    const where: Record<string, unknown> = {}
    if (role === 'user' || role === 'admin') where.role = role
    if (suspended === 'true') where.suspended = true
    if (suspended === 'false') where.suspended = false
    if (kycStatus && kycStatus !== 'all') where.kycStatus = kycStatus
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { id: { contains: q } },
        { investmentId: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          suspended: true,
          kycStatus: true,
          createdAt: true,
          investmentId: true,
          emailVerified: true,
          holdActive: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    res.json({ users, total, page, limit })
  } catch (e) {
    console.error('[admin] list users', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list users' })
  }
})

router.get('/users/:id', async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const empty: never[] = []
    const [holdings, walletBalances, walletLinks, transactions, trades, watchlist, alerts, notifications] = await Promise.all([
      prisma.holding.findMany({ where: { userId: id }, orderBy: { symbol: 'asc' } }).catch(() => empty),
      prisma.walletBalance.findMany({ where: { userId: id }, orderBy: { currency: 'asc' } }).catch(() => empty),
      prisma.walletLink.findMany({ where: { userId: id }, orderBy: { linkedAt: 'desc' } }).catch(() => empty),
      prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => empty),
      prisma.trade.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => empty),
      prisma.watchlist.findMany({ where: { userId: id }, orderBy: { symbol: 'asc' } }).catch(() => empty),
      prisma.priceAlert.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }).catch(() => empty),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => empty),
    ])

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: (user as { username?: string | null }).username ?? null,
        avatar: user.avatar,
        role: user.role,
        suspended: user.suspended,
        suspendedReason: user.suspendedReason,
        holdActive: user.holdActive,
        holdType: user.holdType,
        holdReason: user.holdReason,
        holdNote: user.holdNote,
        holdAt: user.holdAt,
        kycStatus: user.kycStatus,
        kycNotes: user.kycNotes,
        kycReviewedAt: user.kycReviewedAt,
        kycReviewedBy: user.kycReviewedBy,
        dailyWithdrawLimit: user.dailyWithdrawLimit,
        monthlyWithdrawLimit: user.monthlyWithdrawLimit,
        dailyTransferLimit: (user as { dailyTransferLimit?: number | null }).dailyTransferLimit ?? null,
        monthlyTransferLimit: (user as { monthlyTransferLimit?: number | null }).monthlyTransferLimit ?? null,
        investmentId: user.investmentId,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        twoFactor: user.twoFactor,
        prefs: user.prefs,
      },
      holdings,
      walletBalances,
      walletLinks,
      transactions,
      trades,
      watchlist,
      alerts,
      notifications,
      savedWallet: null,
      adminBankAccounts: [],
      adminWalletDetails: [],
    })
  } catch (e) {
    console.error('[admin] get user', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load user' })
  }
})

router.post('/users/:id/deposit', idempotency(), async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id ?? ''
    const parsed = depositSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let occurredAt = new Date()
    if (parsed.data.occurredAt) {
      const d = new Date(parsed.data.occurredAt)
      if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) occurredAt = d
    }

    const symbol = parsed.data.symbol ?? (parsed.data.currency === 'USD' ? '$' : parsed.data.currency)
    const reference = `Account credit${parsed.data.note ? ' — ' + parsed.data.note : ''}`
    const depositClientKey = getIdempotencyKey(req)
    const operationKey = depositClientKey
      ? `admin_deposit:${depositClientKey}`
      : `admin_deposit:${userId}:${parsed.data.currency}:${parsed.data.amount}:${crypto.randomUUID()}`

    const result = await prisma.$transaction(async (tx) => {
      const ledgerResult = await recordLedgerTransaction({
        tx,
        userId,
        asset: parsed.data.currency,
        amount: parsed.data.amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'deposit_manual',
        sourceType: 'admin_deposit',
        sourceId: operationKey,
        externalRef: operationKey,
        idempotencyKey: operationKey,
        description: reference,
        reference,
        createdBy: req.userId!,
        subType: 'admin_deposit',
        recordTransaction: true,
        pending: parsed.data.status !== 'completed',
        createdAt: occurredAt,
      })
      return { balance: ledgerResult.walletBalance, transaction: ledgerResult.transaction }
    })

    if (parsed.data.notify) {
      await prisma.notification
        .create({
          data: {
            userId,
            kind: 'deposit',
            title: `${symbol}${parsed.data.amount.toLocaleString()} ${parsed.data.currency} credited`,
            body: reference,
          },
        })
        .catch(() => {})
    }

    if (parsed.data.status === 'completed' && parsed.data.currency === 'USD') {
      activateReferralOnDeposit(userId, parsed.data.amount).catch(() => {})
    }

    await audit(req.userId!, 'wallet.deposit', userId, {
      ...parsed.data,
      occurredAt: occurredAt.toISOString(),
    })
    res.status(201).json(result)
  } catch (e) {
    console.error('[admin] deposit', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Deposit failed' })
  }
})

router.post('/users/:id/deduct', idempotency(), async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id ?? ''
    const parsed = deductSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const reference = `Account debit${parsed.data.note ? ' — ' + parsed.data.note : ''}`
    const deductClientKey = getIdempotencyKey(req)
    const operationKey = deductClientKey
      ? `admin_deduct:${deductClientKey}`
      : `admin_deduct:${userId}:${parsed.data.currency}:${parsed.data.amount}:${crypto.randomUUID()}`

    if (!parsed.data.allowNegative) {
      const bal = await prisma.walletBalance.findUnique({
        where: { userId_currency: { userId, currency: parsed.data.currency } },
      })
      if (!bal || Number(bal.available) < parsed.data.amount) {
        res.status(400).json({ error: 'Insufficient available balance' })
        return
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const ledgerResult = await recordLedgerTransaction({
        tx,
        userId,
        asset: parsed.data.currency,
        amount: parsed.data.amount,
        entryType: 'credit',
        kind: 'withdraw',
        eventType: 'deduct_manual',
        sourceType: 'admin_deduct',
        sourceId: operationKey,
        externalRef: operationKey,
        idempotencyKey: operationKey,
        description: reference,
        reference,
        createdBy: req.userId!,
        subType: 'admin_deduct',
        recordTransaction: true,
        pending: parsed.data.status !== 'completed',
      })
      return { balance: ledgerResult.walletBalance, transaction: ledgerResult.transaction }
    })

    await audit(req.userId!, 'wallet.deduct', userId, parsed.data)
    res.status(201).json(result)
  } catch (e) {
    console.error('[admin] deduct', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Deduct failed' })
  }
})

router.post('/transfer', idempotency(), async (req: AuthedRequest, res) => {
  try {
    const parsed = transferSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const { fromUserId, toUserId, currency, amount, reason, note, allowNegative, notify } = parsed.data
    if (fromUserId === toUserId) {
      res.status(400).json({ error: 'From and To must differ' })
      return
    }

    const [from, to] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, email: true, name: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, email: true, name: true } }),
    ])
    if (!from || !to) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    if (!allowNegative) {
      const bal = await prisma.walletBalance.findUnique({
        where: { userId_currency: { userId: fromUserId, currency } },
      })
      if (!bal || Number(bal.available) < amount) {
        res.status(400).json({ error: 'Insufficient available balance on source account' })
        return
      }
    }

    const outRef = `Transfer to ${to.email}${note ? ' — ' + note : ''}`
    const inRef = `Transfer from ${from.email}${note ? ' — ' + note : ''}`
    const clientKey = getIdempotencyKey(req)
    const keyBase = clientKey
      ? `admin_transfer:${clientKey}`
      : `admin_transfer:${fromUserId}:${toUserId}:${currency}:${amount}:${crypto.randomUUID()}`

    const result = await prisma.$transaction(async (tx) => {
      const fromLedger = await recordLedgerTransaction({
        tx,
        userId: fromUserId,
        asset: currency,
        amount,
        entryType: 'credit',
        kind: 'transfer',
        eventType: 'admin_transfer',
        sourceType: 'admin_transfer',
        sourceId: keyBase,
        externalRef: keyBase,
        idempotencyKey: `${keyBase}:out`,
        description: outRef,
        reference: outRef,
        createdBy: req.userId!,
        subType: 'transfer',
        recordTransaction: true,
      })
      const toLedger = await recordLedgerTransaction({
        tx,
        userId: toUserId,
        asset: currency,
        amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'admin_transfer',
        sourceType: 'admin_transfer',
        sourceId: `${keyBase}:in`,
        externalRef: `${keyBase}:in`,
        idempotencyKey: `${keyBase}:in`,
        description: inRef,
        reference: inRef,
        createdBy: req.userId!,
        subType: 'transfer',
        recordTransaction: true,
      })
      return {
        fromBalance: fromLedger.walletBalance,
        toBalance: toLedger.walletBalance,
        fromTx: fromLedger.transaction,
        toTx: toLedger.transaction,
      }
    })

    await audit(req.userId!, 'wallet.transfer.admin', toUserId, {
      fromUserId,
      toUserId,
      currency,
      amount,
      reason,
      note,
    })
    res.status(201).json(result)
  } catch (e) {
    console.error('[admin] transfer', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Transfer failed' })
  }
})

router.post('/users/:id/hold', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const holdType = String(req.body?.holdType || 'all')
    const holdReason = String(req.body?.holdReason || 'other')
    const holdNote = req.body?.holdNote ? String(req.body.holdNote).slice(0, 500) : null
    const user = await prisma.user.update({
      where: { id: userId },
      data: { holdActive: true, holdType, holdReason, holdNote, holdAt: new Date() },
    })
    await audit(req.userId!, 'user.hold', userId, { holdType, holdReason, holdNote })
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Hold failed' })
  }
})

router.post('/users/:id/unhold', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const user = await prisma.user.update({
      where: { id: userId },
      data: { holdActive: false, holdType: null, holdReason: null, holdNote: null, holdAt: null },
    })
    await audit(req.userId!, 'user.unhold', userId, null)
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unhold failed' })
  }
})

router.post('/users/:id/kyc', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const kycStatus = String(req.body?.kycStatus || req.body?.status || 'none')
    const kycNotes = req.body?.kycNotes != null ? String(req.body.kycNotes).slice(0, 2000) : (req.body?.notes != null ? String(req.body.notes).slice(0, 2000) : undefined)
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus,
        ...(kycNotes !== undefined ? { kycNotes } : {}),
        kycReviewedAt: new Date(),
        kycReviewedBy: req.userId!,
      },
    })
    await audit(req.userId!, 'user.kyc', userId, { kycStatus, kycNotes })
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'KYC update failed' })
  }
})

router.patch('/users/:id/limits', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const data: Record<string, unknown> = {}
    for (const k of ['dailyWithdrawLimit', 'monthlyWithdrawLimit', 'dailyTransferLimit', 'monthlyTransferLimit']) {
      if (req.body?.[k] !== undefined) {
        data[k] = req.body[k] === null || req.body[k] === '' ? null : Number(req.body[k])
      }
    }
    const user = await prisma.user.update({ where: { id: userId }, data: data as any })
    await audit(req.userId!, 'user.limits', userId, data)
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Limits update failed' })
  }
})

router.post('/users/:id/email', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!user?.email) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const subject = String(req.body?.subject || 'Message from Verdexis').slice(0, 200)
    const body = String(req.body?.body || '').slice(0, 10000)
    const ok = await sendEmailNotification(user.email, subject, body)
    await audit(req.userId!, 'user.email', userId, { subject, ok })
    res.json({ notification: { subject }, deliveredVia: ok ? 'email' : 'none' })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Email failed' })
  }
})

router.post('/users/:id/password', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const password = String(req.body?.password || '')
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 12)
    const revokeSessions = req.body?.revokeSessions !== false
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, ...(revokeSessions ? { tokenVersion: { increment: 1 } } : {}) } as any,
    })
    await audit(req.userId!, 'user.password', userId, { revokeSessions })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Password reset failed' })
  }
})

router.post('/users/:id/revoke', async (req: AuthedRequest, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { tokenVersion: { increment: 1 } } as any,
    })
    await audit(req.userId!, 'user.sessions.revoke', req.params.id, null)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Revoke failed' })
  }
})

router.post('/referral-bonuses/:bonusId/credit', async (req: AuthedRequest, res) => {
  try {
    const result = await creditReferralBonus(req.params.bonusId, req.body?.paymentMethod || 'trading_credit')
    res.json({ success: true, result })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to credit bonus' })
  }
})

router.post('/deposits/:tid/activate-referral', async (req: AuthedRequest, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.tid } })
  if (!tx || tx.kind !== 'deposit' || tx.status !== 'completed') {
    res.status(400).json({ error: 'Completed deposit transaction required' })
    return
  }
  const result = await activateReferralOnDeposit(tx.userId, Number(tx.amount))
  res.json(result)
})

router.get('/signup-bonus', async (_req, res) => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'signup_bonus' } })
  if (!row?.value) {
    res.json({ enabled: false, amountUsd: 0, note: '' })
    return
  }
  try {
    res.json(JSON.parse(row.value))
  } catch {
    res.json({ enabled: false, amountUsd: 0, note: '' })
  }
})

/** GET /api/admin/referral-settings */
router.get('/referral-settings', async (_req, res) => {
  try {
    const settings = await readReferralSettings()
    res.json(settings)
  } catch (e) {
    console.error('[admin] referral-settings get', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load referral settings' })
  }
})

/** PUT /api/admin/referral-settings — enable/disable program */
router.put('/referral-settings', async (req: AuthedRequest, res) => {
  try {
    const parsed = referralSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const updated = await writeReferralSettings(
      {
        enabled: parsed.data.enabled === true,
        referrerBonusUsd: parsed.data.referrerBonusUsd,
        refereeBonusUsd: parsed.data.refereeBonusUsd,
        minDepositUsd: parsed.data.minDepositUsd,
        note: (parsed.data.note || '').trim(),
      },
      req.userId!,
    )
    await audit(req.userId!, 'referral.settings.update', null, updated)
    res.json(updated)
  } catch (e) {
    console.error('[admin] referral-settings put', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save referral settings' })
  }
})

export default router
