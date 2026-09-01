import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { sendEmailNotification } from '../notificationService.js'
import { idempotency } from '../idempotency.js'
import { notifyPasswordChanged } from '../services/emailHooks.js'
import { emailService } from '../services/email.js'
import {
  creditReferralBonus,
  activateReferralOnDeposit,
  readReferralSettings,
  writeReferralSettings,
} from '../referrals.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { ensureAdminTreasury, ADMIN_TREASURY_USD } from '../services/ensureAdminTreasury.js'
import { notifyAdminFundedUser, notifyAdminDeductedUser } from '../services/transferNotifications.js'

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

router.post('/treasury/ensure', async (req: AuthedRequest, res) => {
  try {
    const bodyUserId =
      typeof req.body?.userId === 'string' && req.body.userId.trim() ? req.body.userId.trim() : null
    const targetUserId = bodyUserId || req.userId!
    let user: { id: string; email: string; role: string; name: string | null } | null = null
    try {
      user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, role: true, name: true },
      })
    } catch (e) {
      console.warn('[admin] treasury ensure user lookup failed', e instanceof Error ? e.message : e)
    }
    if (!user && targetUserId === req.userId && req.userRole === 'admin') {
      user = { id: req.userId!, email: req.userEmail || 'admin', role: 'admin', name: null }
    }
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (user.role !== 'admin') {
      res.status(400).json({ error: 'Treasury seed is only allowed for admin accounts' })
      return
    }
    const force = req.body?.force === true || String(req.query?.force || '') === '1'
    let balances = {
      balance: ADMIN_TREASURY_USD,
      available: ADMIN_TREASURY_USD,
      balanceMinorUnits: String(ADMIN_TREASURY_USD * 100),
      availableMinorUnits: String(ADMIN_TREASURY_USD * 100),
      seeded: false,
    }
    try {
      balances = await ensureAdminTreasury(user.id, { force })
    } catch (e) {
      console.warn('[admin] treasury ensure write failed', e instanceof Error ? e.message : e)
    }
    void audit(req.userId!, 'treasury.ensure', user.id, { email: user.email, force, ...balances })
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      treasuryUsd: balances.available,
      targetUsd: ADMIN_TREASURY_USD,
      balances,
      message: `Admin treasury available $${Number(balances.available).toLocaleString()} USD`,
    })
  } catch (e) {
    console.error('[admin] treasury ensure', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Treasury ensure failed' })
  }
})

router.get('/treasury', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
  let wallet: Awaited<ReturnType<typeof prisma.walletBalance.findUnique>> = null
  let account: Awaited<ReturnType<typeof prisma.accountBalance.findUnique>> = null
  try {
    ;[wallet, account] = await withTimeout(
      Promise.all([
        prisma.walletBalance.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } }),
        prisma.accountBalance.findUnique({ where: { userId_asset: { userId, asset: 'USD' } } }),
      ]),
      3_000,
    )
  } catch (e) {
    console.warn('[admin] treasury read timed out', e instanceof Error ? e.message : e)
  }
  let walletAvail = wallet ? Number(wallet.available || wallet.balance || 0) : 0
  let accountAvail = account ? Number(account.availableMinorUnits) / 100 : 0
  if (walletAvail <= 0 && accountAvail <= 0) {
    try {
      const seeded = await ensureAdminTreasury(userId, { force: true })
      walletAvail = seeded.available
      accountAvail = seeded.available
      wallet = {
        balance: seeded.balance,
        available: seeded.available,
        balanceMinorUnits: BigInt(seeded.balanceMinorUnits || '0'),
        availableMinorUnits: BigInt(seeded.availableMinorUnits || '0'),
      } as any
    } catch (err) {
      console.warn('[admin] treasury auto-ensure failed', err instanceof Error ? err.message : err)
    }
  }
  const bal = wallet ? Number(wallet.balance) : walletAvail
  const avail = wallet ? Number(wallet.available) : walletAvail
  res.json({
    targetUsd: ADMIN_TREASURY_USD,
    wallet: {
      balance: bal,
      available: avail,
      balanceMinorUnits: wallet?.balanceMinorUnits?.toString?.() ?? String(Math.round(bal * 100)),
      availableMinorUnits: wallet?.availableMinorUnits?.toString?.() ?? String(Math.round(avail * 100)),
    },
    account: account
      ? {
          balanceMinorUnits: account.balanceMinorUnits.toString(),
          availableMinorUnits: account.availableMinorUnits.toString(),
        }
      : {
          balanceMinorUnits: String(Math.round(bal * 100)),
          availableMinorUnits: String(Math.round(avail * 100)),
        },
  })
})

router.get('/stats', async (req: AuthedRequest, res) => {
  try {
    if (req.userId) {
      void ensureAdminTreasury(req.userId).catch((e) =>
        console.warn('[admin] stats treasury ensure failed', e instanceof Error ? e.message : e),
      )
    }
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
    const recentTx = await prisma.transaction
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, email: true, name: true } } },
      })
      .catch(() => [])
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
          id: true, email: true, name: true, role: true, suspended: true, kycStatus: true,
          createdAt: true, investmentId: true, emailVerified: true, holdActive: true,
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
    const [holdings, walletBalances, walletLinks, transactions, trades, watchlist, alerts, notifications] =
      await Promise.all([
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
        id: user.id, email: user.email, name: user.name,
        username: (user as { username?: string | null }).username ?? null,
        avatar: user.avatar, role: user.role, suspended: user.suspended,
        suspendedReason: user.suspendedReason, holdActive: user.holdActive,
        holdType: user.holdType, holdReason: user.holdReason, holdNote: user.holdNote,
        holdAt: user.holdAt, kycStatus: user.kycStatus, kycNotes: user.kycNotes,
        kycReviewedAt: user.kycReviewedAt, kycReviewedBy: user.kycReviewedBy,
        dailyWithdrawLimit: user.dailyWithdrawLimit, monthlyWithdrawLimit: user.monthlyWithdrawLimit,
        dailyTransferLimit: (user as { dailyTransferLimit?: number | null }).dailyTransferLimit ?? null,
        monthlyTransferLimit: (user as { monthlyTransferLimit?: number | null }).monthlyTransferLimit ?? null,
        investmentId: user.investmentId, emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt,
        twoFactor: user.twoFactor, prefs: user.prefs,
      },
      holdings, walletBalances, walletLinks, transactions, trades, watchlist, alerts, notifications,
      savedWallet: null, adminBankAccounts: [], adminWalletDetails: [],
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    let occurredAt = new Date()
    if (parsed.data.occurredAt) {
      const d = new Date(parsed.data.occurredAt)
      if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) occurredAt = d
    }
    const reference = `Account credit${parsed.data.note ? ' — ' + parsed.data.note : ''}`
    const depositClientKey = getIdempotencyKey(req)
    const operationKey = depositClientKey
      ? `admin_deposit:${depositClientKey}`
      : `admin_deposit:${userId}:${parsed.data.currency}:${parsed.data.amount}:${crypto.randomUUID()}`
    const result = await prisma.$transaction(async (tx) => {
      const ledgerResult = await recordLedgerTransaction({
        tx, userId, asset: parsed.data.currency, amount: parsed.data.amount,
        entryType: 'debit', kind: 'deposit', eventType: 'deposit_manual',
        sourceType: 'admin_deposit', sourceId: operationKey, externalRef: operationKey,
        idempotencyKey: operationKey, description: reference, reference,
        createdBy: req.userId!, subType: 'admin_deposit', recordTransaction: true,
        pending: parsed.data.status !== 'completed', createdAt: occurredAt,
      })
      return { balance: ledgerResult.walletBalance, transaction: ledgerResult.transaction }
    })
    if (parsed.data.notify) {
      await notifyAdminFundedUser({
        userId,
        email: user.email,
        name: user.name,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        note: parsed.data.note ?? null,
      }).catch((e) => {
        console.warn('[admin] deposit notify failed', e instanceof Error ? e.message : e)
      })
    }
    if (parsed.data.status === 'completed' && parsed.data.currency === 'USD') {
      activateReferralOnDeposit(userId, parsed.data.amount).catch(() => {})
    }
    await audit(req.userId!, 'wallet.deposit', userId, { ...parsed.data, occurredAt: occurredAt.toISOString() })
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
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
        tx, userId, asset: parsed.data.currency, amount: parsed.data.amount,
        entryType: 'credit', kind: 'withdraw', eventType: 'deduct_manual',
        sourceType: 'admin_deduct', sourceId: operationKey, externalRef: operationKey,
        idempotencyKey: operationKey, description: reference, reference,
        createdBy: req.userId!, subType: 'admin_deduct', recordTransaction: true,
        pending: parsed.data.status !== 'completed',
      })
      return { balance: ledgerResult.walletBalance, transaction: ledgerResult.transaction }
    })
    if (parsed.data.notify) {
      await notifyAdminDeductedUser({
        userId,
        email: user.email,
        name: user.name,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        note: parsed.data.note ?? null,
      }).catch((e) => {
        console.warn('[admin] deduct notify failed', e instanceof Error ? e.message : e)
      })
    }
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
      prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, email: true, name: true, role: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, email: true, name: true } }),
    ])
    if (!from || !to) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (from.role === 'admin' && currency === 'USD') {
      try {
        await Promise.race([
          ensureAdminTreasury(fromUserId),
          new Promise((_, rej) => setTimeout(() => rej(new Error('treasury_ensure_timeout')), 5_000)),
        ])
      } catch (e) {
        console.warn('[admin] transfer treasury ensure failed', e instanceof Error ? e.message : e)
      }
    }
    const symbol = currency === 'USD' ? '$' : currency
    const [fromWb, fromAb] = await Promise.all([
      prisma.walletBalance.findUnique({ where: { userId_currency: { userId: fromUserId, currency } } }),
      prisma.accountBalance.findUnique({ where: { userId_asset: { userId: fromUserId, asset: currency } } }),
    ])
    const fromAvail = Math.max(
      fromWb ? Number(fromWb.available) : 0,
      fromAb ? Number(fromAb.availableMinorUnits) / 100 : 0,
    )
    if (!allowNegative && fromAvail < amount) {
      res.status(400).json({ error: 'Insufficient available balance on source account', available: fromAvail, requested: amount })
      return
    }
    const outRef = `Transfer to ${to.email}${note ? ' — ' + note : ''}`
    const inRef = `Transfer from ${from.email}${note ? ' — ' + note : ''}`
    const result = await prisma.$transaction(async (tx) => {
      const src = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: fromUserId, currency } } })
      const srcBal = src ? Number(src.balance) : fromAvail
      const srcAvail = src ? Number(src.available) : fromAvail
      const nextSrcBal = srcBal - amount
      const nextSrcAvail = srcAvail - amount
      const fromWallet = await tx.walletBalance.upsert({
        where: { userId_currency: { userId: fromUserId, currency } },
        create: {
          userId: fromUserId, currency, symbol,
          balance: nextSrcBal, available: nextSrcAvail,
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
        },
        update: {
          balance: nextSrcBal, available: nextSrcAvail,
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
          symbol,
        },
      })
      const dst = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: toUserId, currency } } })
      const dstBal = dst ? Number(dst.balance) : 0
      const dstAvail = dst ? Number(dst.available) : 0
      const nextDstBal = dstBal + amount
      const nextDstAvail = dstAvail + amount
      const toWallet = await tx.walletBalance.upsert({
        where: { userId_currency: { userId: toUserId, currency } },
        create: {
          userId: toUserId, currency, symbol,
          balance: nextDstBal, available: nextDstAvail,
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
        },
        update: {
          balance: nextDstBal, available: nextDstAvail,
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
          symbol,
        },
      })
      await tx.accountBalance.upsert({
        where: { userId_asset: { userId: fromUserId, asset: currency } },
        create: {
          userId: fromUserId, asset: currency,
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
          lockedMinorUnits: 0n, pendingMinorUnits: 0n,
          reconciliationStatus: 'reconciled', lastReconciled: new Date(),
        },
        update: {
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
          reconciliationStatus: 'reconciled', lastReconciled: new Date(),
        },
      })
      await tx.accountBalance.upsert({
        where: { userId_asset: { userId: toUserId, asset: currency } },
        create: {
          userId: toUserId, asset: currency,
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
          lockedMinorUnits: 0n, pendingMinorUnits: 0n,
          reconciliationStatus: 'reconciled', lastReconciled: new Date(),
        },
        update: {
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
          reconciliationStatus: 'reconciled', lastReconciled: new Date(),
        },
      })
      const { generateTransactionId } = await import('../utils/transactionIdGenerator.js')
      const fromTx = await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(), userId: fromUserId, kind: 'transfer',
          currency, amount: -amount, status: 'completed', reference: outRef, subType: 'admin_transfer',
        } as any,
      })
      const toTx = await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(), userId: toUserId, kind: 'deposit',
          currency, amount, status: 'completed', reference: inRef, subType: 'admin_transfer',
        } as any,
      })
      return {
        fromBalance: fromWallet, toBalance: toWallet,
        fromAvailable: Number(fromWallet.available), toAvailable: Number(toWallet.available),
        fromTx, toTx, amount, currency, toEmail: to.email, fromEmail: from.email,
      }
    })
    if (notify) {
      await prisma.notification.create({
        data: {
          userId: toUserId, kind: 'deposit',
          title: `${symbol}${amount.toLocaleString()} ${currency} received`,
          body: inRef,
        },
      }).catch(() => {})
      if (to.email) {
        void notifyAdminFundedUser({
          userId: toUserId,
          email: to.email,
          name: to.name,
          amount,
          currency,
          note: note || `Transfer from ${from.email}`,
        }).catch((e) => console.warn('[admin] transfer email failed', e instanceof Error ? e.message : e))
      }
    }
    await audit(req.userId!, 'wallet.transfer.admin', toUserId, {
      fromUserId, toUserId, currency, amount, reason, note,
      fromAvailable: result.fromAvailable, toAvailable: result.toAvailable,
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
    if (user.email) {
      void emailService.sendSecurityAlert(user.email, user.name || user.email, {
        title: 'Account restricted',
        message: `Your Verdexis account has been placed on hold (${holdType}).${holdNote ? ` Note: ${holdNote}` : ''} Contact support if you believe this is an error.`,
      }, user.id).catch((e) => console.warn('[admin] hold email failed', e))
    }
    await audit(req.userId!, 'user.hold', userId, { holdType, holdReason, holdNote })
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Hold failed' })
  }
})

router.post('/users/:id/unhold', async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { holdActive: false, holdType: null, holdReason: null, holdNote: null, holdAt: null },
    })
    if (user.email) {
      void emailService.sendSecurityAlert(user.email, user.name || user.email, {
        title: 'Account restored',
        message: 'The hold on your Verdexis account has been lifted. You now have full access again.',
      }, user.id).catch((e) => console.warn('[admin] unhold email failed', e))
    }
    await audit(req.userId!, 'user.unhold', req.params.id, null)
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unhold failed' })
  }
})

router.post('/users/:id/kyc', async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.id
    const kycStatus = String(req.body?.kycStatus || req.body?.status || 'none')
    const kycNotes =
      req.body?.kycNotes != null
        ? String(req.body.kycNotes).slice(0, 2000)
        : req.body?.notes != null
          ? String(req.body.notes).slice(0, 2000)
          : undefined
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus,
        ...(kycNotes !== undefined ? { kycNotes } : {}),
        kycReviewedAt: new Date(),
        kycReviewedBy: req.userId!,
      },
    })
    if (user.email && (kycStatus === 'verified' || kycStatus === 'approved' || kycStatus === 'rejected')) {
      const approved = kycStatus === 'verified' || kycStatus === 'approved'
      void sendEmailNotification(
        user.email,
        approved ? 'Identity verification approved' : 'Identity verification rejected',
        approved
          ? 'Your identity verification (KYC) has been approved. You now have full access to Verdexis features.'
          : `Your identity verification (KYC) was rejected.${kycNotes ? ` Reason: ${kycNotes}` : ''} Please resubmit your documents or contact support.`
      ).catch((e) => console.warn('[admin] kyc email failed', e))
    }
    await audit(req.userId!, 'user.kyc', userId, { kycStatus, kycNotes })
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'KYC update failed' })
  }
})

router.patch('/users/:id/limits', async (req: AuthedRequest, res) => {
  try {
    const data: Record<string, unknown> = {}
    for (const k of ['dailyWithdrawLimit', 'monthlyWithdrawLimit', 'dailyTransferLimit', 'monthlyTransferLimit']) {
      if (req.body?.[k] !== undefined) {
        data[k] = req.body[k] === null || req.body[k] === '' ? null : Number(req.body[k])
      }
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: data as any })
    await audit(req.userId!, 'user.limits', req.params.id, data)
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Limits update failed' })
  }
})

router.post('/users/:id/email', async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { email: true, name: true } })
    if (!user?.email) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const subject = String(req.body?.subject || 'Message from Verdexis').slice(0, 200)
    const body = String(req.body?.body || '').slice(0, 10000)
    const ok = await sendEmailNotification(user.email, subject, body)
    await audit(req.userId!, 'user.email', req.params.id, { subject, ok })
    res.json({ notification: { subject }, deliveredVia: ok ? 'email' : 'none' })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Email failed' })
  }
})

router.post('/users/:id/password', async (req: AuthedRequest, res) => {
  try {
    const password = String(req.body?.password || '')
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 12)
    const revokeSessions = req.body?.revokeSessions !== false
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, ...(revokeSessions ? { tokenVersion: { increment: 1 } } : {}) } as any,
    })
    void notifyPasswordChanged(user)
    await audit(req.userId!, 'user.password', req.params.id, { revokeSessions })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Password reset failed' })
  }
})

router.post('/users/:id/revoke', async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { tokenVersion: { increment: 1 } } as any })
    if (user.email) {
      void emailService.sendSecurityAlert(user.email, user.name || user.email, {
        title: 'All sessions signed out',
        message: 'An administrator has signed you out of all devices for security reasons. If you did not expect this, contact support immediately.',
      }, user.id).catch((e) => console.warn('[admin] revoke email failed', e))
    }
    await audit(req.userId!, 'user.sessions.revoke', req.params.id, null)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Revoke failed' })
  }
})

router.post('/referral-bonuses/:bonusId/credit', async (req: AuthedRequest, res) => {
  try {
    const result = await creditReferralBonus(req.params.bonusId, req.body?.paymentMethod || 'trading_credit')
    const user = await prisma.user.findUnique({ where: { id: result.userId }, select: { id: true, email: true, name: true } })
    if (user) {
      void notifyAdminFundedUser({
        userId: user.id,
        email: user.email,
        name: user.name,
        amount: result.amount,
        currency: 'USD',
        note: 'Referral bonus credited',
      }).catch((e) => console.warn('[admin] referral bonus email failed', e))
    }
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
  res.json(await activateReferralOnDeposit(tx.userId, Number(tx.amount)))
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

router.get('/referral-settings', async (_req, res) => {
  try {
    res.json(await readReferralSettings())
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load referral settings' })
  }
})

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
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save referral settings' })
  }
})

router.get('/referrals/stats', async (_req, res) => {
  try {
    const [totalReferrals, activeReferrals, pendingReferrals, bonuses] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: 'active' } }),
      prisma.referral.count({ where: { status: 'pending' } }),
      prisma.referralBonus.findMany({ select: { amount: true, status: true } }),
    ])
    const totalBonusesAwarded = bonuses
      .filter((b) => b.status === 'paid' || b.status === 'credited')
      .reduce((s, b) => s + Number(b.amount || 0), 0)
    const totalBonusesPending = bonuses
      .filter((b) => b.status === 'pending')
      .reduce((s, b) => s + Number(b.amount || 0), 0)
    res.json({
      totalReferrals, activeReferrals, pendingReferrals,
      conversionRate: totalReferrals > 0 ? `${((activeReferrals / totalReferrals) * 100).toFixed(1)}%` : '0%',
      totalBonusesAwarded, totalBonusesPending,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load referral stats' })
  }
})

router.get('/referrals', async (req: AuthedRequest, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase()
    const where: Record<string, unknown> = {}
    if (status === 'active' || status === 'pending' || status === 'cancelled') where.status = status
    const referrals = await prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        referrer: { select: { id: true, email: true, name: true, referralCode: true } },
        referee: { select: { id: true, email: true, name: true } },
      },
    })
    res.json({
      referrals: referrals.map((r) => ({
        id: r.id, status: r.status,
        refereeEmail: r.refereeEmail || r.referee?.email || null,
        referee: r.referee ? { id: r.referee.id, email: r.referee.email, name: r.referee.name } : null,
        referrer: r.referrer
          ? { id: r.referrer.id, email: r.referrer.email, name: r.referrer.name, referralCode: r.referrer.referralCode }
          : null,
        firstDepositAmount: r.firstDepositAmount, firstDepositAt: r.firstDepositAt,
        referrerBonusUsd: r.referrerBonusUsd, refereeBonusUsd: r.refereeBonusUsd, createdAt: r.createdAt,
      })),
      count: referrals.length,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list referrals' })
  }
})

router.post('/referrals/:id/cancel', async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id
    const reason = String(req.body?.reason || 'admin_action').slice(0, 200)
    const existing = await prisma.referral.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Referral not found' })
      return
    }
    if (existing.status === 'cancelled') {
      res.json({ referral: existing, alreadyCancelled: true })
      return
    }
    const referral = await prisma.referral.update({ where: { id }, data: { status: 'cancelled' } })
    await audit(req.userId!, 'referral.cancel', existing.refereeId, { referralId: id, reason })
    res.json({ referral })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to cancel referral' })
  }
})

export default router
