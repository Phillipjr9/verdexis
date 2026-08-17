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
import { creditReferralBonus } from '../referrals.js'
import { recordLedgerTransaction, recordLedgerBalanceReservation } from '../services/ledger.js'
import { archiveUserDeletion } from '../services/accountDeletion.js'
import { assignUserToAdmin, isSuperAdmin } from '../lib/adminHierarchy.js'
import { normalizeQueryText } from '../lib/safeInput.js'

const router = Router()

// Admin endpoints get a stricter limiter — these are operator-only.
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(adminLimiter)
router.use(requireAuth)
router.use(requireAdmin)

// --- helpers --------------------------------------------------------------

function publicUser(u: {
  id: string; email: string; name: string; avatar: string | null; prefs: string | null;
  twoFactor: boolean; role: string; suspended: boolean; suspendedReason: string | null;
  holdActive: boolean; holdType: string | null; holdReason: string | null; holdNote: string | null; holdAt: Date | null;
  kycStatus: string; kycNotes: string | null; kycReviewedAt: Date | null; kycReviewedBy: string | null;
  dailyWithdrawLimit: number | null; monthlyWithdrawLimit: number | null;
  dailyTransferLimit: number | null; monthlyTransferLimit: number | null;
  ipAllowlist: string | null;
  investmentId?: string | null;
  tokenVersion: number; createdAt: Date; updatedAt: Date;
}) {
  let prefs: Record<string, unknown> = {}
  try { if (u.prefs) prefs = JSON.parse(u.prefs) } catch { prefs = {} }
  return {
    id: u.id, email: u.email, name: u.name, avatar: u.avatar,
    twoFactor: u.twoFactor, role: u.role, suspended: u.suspended,
    suspendedReason: u.suspendedReason,
    holdActive: u.holdActive, holdType: u.holdType, holdReason: u.holdReason,
    holdNote: u.holdNote, holdAt: u.holdAt,
    kycStatus: u.kycStatus, kycNotes: u.kycNotes, kycReviewedAt: u.kycReviewedAt, kycReviewedBy: u.kycReviewedBy,
    dailyWithdrawLimit: u.dailyWithdrawLimit, monthlyWithdrawLimit: u.monthlyWithdrawLimit,
    dailyTransferLimit: u.dailyTransferLimit, monthlyTransferLimit: u.monthlyTransferLimit,
    ipAllowlist: u.ipAllowlist,
    investmentId: u.investmentId ?? null,
    tokenVersion: u.tokenVersion,
    createdAt: u.createdAt, updatedAt: u.updatedAt, prefs,
  }
}

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
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error('[admin audit] CRITICAL: audit logging failed', {
      action,
      error: errorMsg,
      timestamp: new Date().toISOString(),
      actor: actorId,
      target: targetUserId,
    })
    // TODO: Send alert to admin monitoring in production
  }
}

function getIdempotencyKey(req: AuthedRequest): string | undefined {
  const raw = req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key']
  if (!raw) return undefined
  return Array.isArray(raw) ? raw[0] : String(raw)
}

function readLastLoginMeta(prefsJson: string | null): {
  lastLoginAt: string | null
  lastLoginIp: string | null
  lastLoginGeo: {
    country?: string
    countryCode?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
    timezone?: string
    isp?: string
  } | null
} {
  try {
    if (!prefsJson) return { lastLoginAt: null, lastLoginIp: null, lastLoginGeo: null }
    
    const prefs = JSON.parse(prefsJson)
    if (!prefs || typeof prefs !== 'object') return { lastLoginAt: null, lastLoginIp: null, lastLoginGeo: null }
    
    const security = prefs.security && typeof prefs.security === 'object' ? prefs.security : null
    const lastLogin = security?.lastLogin && typeof security.lastLogin === 'object' ? security.lastLogin : null
    const geo = lastLogin?.geo && typeof lastLogin.geo === 'object' ? lastLogin.geo : null
    
    return {
      lastLoginAt: typeof lastLogin?.at === 'string' ? lastLogin.at : null,
      lastLoginIp: typeof lastLogin?.ip === 'string' ? lastLogin.ip : null,
      lastLoginGeo: geo ? {
        country: typeof geo.country === 'string' ? geo.country : undefined,
        countryCode: typeof geo.countryCode === 'string' ? geo.countryCode : undefined,
        region: typeof geo.region === 'string' ? geo.region : undefined,
        city: typeof geo.city === 'string' ? geo.city : undefined,
        latitude: typeof geo.latitude === 'number' ? geo.latitude : undefined,
        longitude: typeof geo.longitude === 'number' ? geo.longitude : undefined,
        timezone: typeof geo.timezone === 'string' ? geo.timezone : undefined,
        isp: typeof geo.isp === 'string' ? geo.isp : undefined,
      } : null,
    }
  } catch (e) {
    console.error('[readLastLoginMeta] failed to parse prefs:', e instanceof Error ? e.message : String(e))
    return { lastLoginAt: null, lastLoginIp: null, lastLoginGeo: null }
  }
}

// --- stats ---------------------------------------------------------------

router.get('/stats', async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits, lastBroadcast] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { suspended: true } }),
    prisma.holding.count(),
    prisma.trade.count(),
    prisma.priceAlert.count({ where: { active: true } }),
    prisma.transaction.count({ where: { kind: 'deposit', createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { holdActive: true } }),
    prisma.user.count({ where: { kycStatus: 'pending' } }),
    prisma.transaction.count({ where: { kind: 'withdraw', createdAt: { gte: since } } }),
    prisma.transaction.count({ where: { kind: 'deposit', status: 'pending' } }),
    prisma.adminAudit.findFirst({ where: { action: 'notification.broadcast' }, orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true } } } }),
  ])
  const recentSignups = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }, take: 8,
    select: { id: true, email: true, name: true, createdAt: true, role: true, suspended: true },
  })
  const recentTx = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' }, take: 10,
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.json({
    stats: { users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits },
    lastBroadcast: lastBroadcast ? { at: lastBroadcast.createdAt, by: lastBroadcast.actor?.email ?? null, payload: lastBroadcast.payload } : null,
    recentSignups, recentTx,
  })
})

export default router
