import { Router, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { sendEmailNotification } from '../notificationService.js'
import { getHistoricalPrice, getCurrentCryptoPrice } from '../historicalPrice.js'
import { generateInvestmentId } from '../investmentId.js'
import { idempotency } from '../idempotency.js'
import { creditReferralBonus, activateReferralOnDeposit } from '../referrals.js'
import { recordLedgerTransaction, recordLedgerBalanceReservation } from '../services/ledger.js'
import { archiveUserDeletion } from '../services/accountDeletion.js'
import { assignUserToAdmin, isSuperAdmin } from '../lib/adminHierarchy.js'
import { normalizeQueryText } from '../lib/safeInput.js'

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

// TEMP bootstrap: re-export note — full file restore in progress via history blob
// If this commit ships alone, immediately follow with complete admin router body.
router.get('/users', async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25))
    const skip = (page - 1) * limit
    const q = String(req.query.q || '').trim()
    const role = String(req.query.role || 'all')
    const suspended = String(req.query.suspended || 'all')
    const kycStatus = String(req.query.kycStatus || '')

    const where: any = {}
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
      username: (user as any).username ?? null,
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
      dailyTransferLimit: (user as any).dailyTransferLimit ?? null,
      monthlyTransferLimit: (user as any).monthlyTransferLimit ?? null,
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
