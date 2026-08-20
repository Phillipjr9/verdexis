import { Router, type Response } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { sendEmailNotification } from '../notificationService.js'
import { idempotency } from '../idempotency.js'
import { creditReferralBonus, activateReferralOnDeposit } from '../referrals.js'
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
          username: true,
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

    const [holdings, walletBalances, walletLinks, transactions, trades, watchlist, alerts, notifications] = await Promise.all([
      prisma.holding.findMany({ where: { userId: id }, orderBy: { symbol: 'asc' } }),
      prisma.walletBalance.findMany({ where: { userId: id }, orderBy: { currency: 'asc' } }),
      prisma.walletLink.findMany({ where: { userId: id }, orderBy: { linkedAt: 'desc' } }).catch(() => []),
      prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.trade.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.watchlist.findMany({ where: { userId: id }, orderBy: { symbol: 'asc' } }).catch(() => []),
      prisma.priceAlert.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }).catch(() => []),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ])

    const publicUser = {
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
    }

    res.json({
      user: publicUser,
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

/** Admin credits a user's wallet and optionally emails them. */
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
    const reference = `Account credit${parsed.data.note ? ' — ' + parsed.data.note : ''}${
      parsed.data.occurredAt ? ` (effective ${occurredAt.toISOString().slice(0, 10)})` : ''
    }`
    const operationKey =
      getIdempotencyKey(req) ??
      `admin_deposit:${userId}:${parsed.data.currency}:${parsed.data.amount}:${occurredAt.toISOString()}:${parsed.data.note ?? ''}:${Date.now()}`

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

    if (parsed.data.notify && user.email) {
      const amountLabel = `${parsed.data.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${parsed.data.currency}`
      const subject = `Deposit credited: ${amountLabel}`
      const body = [
        `Hi ${user.name || 'there'},`,
        '',
        `A deposit of ${amountLabel} has been credited to your Verdexis account.`,
        parsed.data.note ? `Note: ${parsed.data.note}` : null,
        `Reason: ${parsed.data.reason}`,
        `Status: ${parsed.data.status}`,
        '',
        'You can view the updated balance in your wallet.',
        '',
        '— Verdexis',
      ]
        .filter(Boolean)
        .join('\n')

      const html = `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;max-width:560px">
  <p>Hi ${escapeHtml(user.name || 'there')},</p>
  <p>A deposit of <strong>${escapeHtml(amountLabel)}</strong> has been credited to your Verdexis account.</p>
  ${parsed.data.note ? `<p>Note: ${escapeHtml(parsed.data.note)}</p>` : ''}
  <p style="color:#64748b;font-size:13px">Reason: ${escapeHtml(parsed.data.reason)} · Status: ${escapeHtml(parsed.data.status)}</p>
  <p>You can view the updated balance in your wallet.</p>
  <p style="color:#64748b;font-size:12px">— Verdexis</p>
</div>`

      await sendEmailNotification(user.email, subject, body, html, {
        userId: user.id,
        kind: 'deposit',
        title: subject,
        body: reference,
        createWebNotification: false,
      }).catch((err) => console.error('[admin] deposit email failed:', err))
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

router.get('/stats', async (_req, res) => {
  try {
    const [users, pendingDeposits] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count({ where: { kind: 'deposit', status: 'pending' } }),
    ])
    res.json({ stats: { users, pendingDeposits } })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'error' })
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

export default router
