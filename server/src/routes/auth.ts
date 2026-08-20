import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, verifyToken, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { createUser, getUserByEmail, getUserById, findUserByEmailOrUsername, updateUser } from '../services/userStore.js'
import { emailService } from '../services/email.js'
import { otpService } from '../services/otp.js'
import { isDbUnavailableError } from '../dbError.js'
import { generateInvestmentId } from '../investmentId.js'
import { ensureUserReferralCode, linkReferrer } from '../referrals.js'
import { notifyAdminNewUser } from '../notificationService.js'
import { grantSignupBonusIfEnabled } from '../signupBonus.js'

const router = Router()
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>()

export function clearFailedLoginAttempts(email: string): void {
  try { failedLoginAttempts.delete(String(email || '').toLowerCase().trim()) } catch { /* ignore */ }
}

const ADMIN_EMAILS = (env.ADMIN_EMAILS || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
const DEFAULT_ADMIN_EMAIL = 'admin@verdexisgroup.com'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const body = (req.body ?? {}) as { identifier?: string; email?: string }
    const id = String(body.identifier || body.email || '').trim().toLowerCase()
    return `${req.ip || 'anon'}|${id}`
  },
})

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const body = (req.body ?? {}) as { email?: string }
    const id = String(body.email || '').trim().toLowerCase()
    return `${req.ip || 'anon'}|${id}`
  },
  message: { error: 'Too many password reset requests. Please wait before retrying.' },
})

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    username: u.username ?? null,
    name: u.name,
    avatar: u.avatar ?? null,
    twoFactor: !!u.twoFactor,
    role: (u.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
    suspended: !!u.suspended,
    investmentId: u.investmentId ?? null,
    kycStatus: u.kycStatus || 'none',
    emailVerified: !!u.emailVerified,
    emailVerifiedAt: u.emailVerifiedAt ?? null,
    phoneVerified: !!u.phoneVerified,
    phoneVerifiedAt: u.phoneVerifiedAt ?? null,
    prefs: typeof u.prefs === 'string' ? (() => { try { return JSON.parse(u.prefs) } catch { return {} } })() : (u.prefs || {}),
  }
}

function buildPendingVerificationPayload(opts: {
  kind: 'signup' | 'login'
  pendingToken: string
  email: string
}) {
  return {
    otpRequired: true as const,
    pendingToken: opts.pendingToken,
    verificationType: opts.kind,
    email: opts.email,
    message:
      opts.kind === 'signup'
        ? 'Check your email for a 6-digit verification code to complete registration.'
        : 'Check your email for a 6-digit code to continue signing in.',
  }
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || null
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0]?.trim() || null
  }
  return req.ip || (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress || null
}

function clientUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent']
  return typeof ua === 'string' && ua.trim() ? ua.trim() : null
}

function parsePrefs(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function autoPromoteIfAdminEmail(userId: string, email: string, currentRole: string): Promise<string> {
  if (currentRole === 'admin') return 'admin'
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) return currentRole
  await updateUser(userId, { role: 'admin' })
  return 'admin'
}

export async function promoteAllAdminEmails(): Promise<void> {
  const adminEmails = ADMIN_EMAILS.length ? ADMIN_EMAILS : [DEFAULT_ADMIN_EMAIL]
  const seedPassword = env.ADMIN_SEED_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'Admin@Verdexis2024'
  for (const email of adminEmails) {
    try {
      let u = await getUserByEmail(email)
      if (!u) {
        const passwordHash = await bcrypt.hash(seedPassword, 12)
        const investmentId = await generateInvestmentId().catch(() => `VDX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`)
        u = await createUser({ email, name: 'Admin', passwordHash, investmentId, role: 'admin', emailVerified: true, emailVerifiedAt: new Date() } as any)
        console.log(`[verdexis-api] created admin user ${email}`)
      } else if (!u.passwordHash || u.passwordHash.length < 20) {
        const passwordHash = await bcrypt.hash(seedPassword, 12)
        await updateUser(u.id, { passwordHash, tokenVersion: (u.tokenVersion ?? 0) + 1 })
      }
      await autoPromoteIfAdminEmail(u.id, u.email, u.role)
    } catch (e) {
      console.error(`[verdexis-api] failed to promote ${email}:`, (e as Error).message)
    }
  }
}

/** Mark email verified once and fire high-importance admin alert on first transition. */
async function markEmailVerifiedAndNotifyAdmin(
  userId: string,
  extra?: { ip?: string | null; userAgent?: string | null },
): Promise<void> {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      investmentId: true,
      role: true,
      createdAt: true,
      emailVerified: true,
      address: true,
      prefs: true,
    },
  })
  if (!before) return

  const wasVerified = !!before.emailVerified
  await updateUser(userId, { emailVerified: true, emailVerifiedAt: new Date() })

  if (!wasVerified) {
    // Signup bonus (respects admin enabled flag; idempotent)
    try {
      const bonusResult = await grantSignupBonusIfEnabled(userId)
      if (bonusResult.granted) {
        console.info('[auth] signup bonus granted', { userId, amountUsd: bonusResult.amountUsd })
      }
    } catch (e) {
      console.warn('[auth] signup bonus grant skipped', e instanceof Error ? e.message : e)
    }

    const prefs = parsePrefs(before.prefs)
    const phone =
      (typeof prefs.phone === 'string' && prefs.phone.trim()) ||
      (typeof prefs.phoneNumber === 'string' && prefs.phoneNumber.trim()) ||
      null
    const storedIp =
      (typeof prefs.signupIp === 'string' && prefs.signupIp.trim()) ||
      (typeof prefs.lastIp === 'string' && prefs.lastIp.trim()) ||
      null
    const storedUa =
      (typeof prefs.signupUserAgent === 'string' && prefs.signupUserAgent.trim()) ||
      null
    const storedSource =
      (typeof prefs.signupSource === 'string' && prefs.signupSource.trim()) ||
      (typeof prefs.referralCode === 'string' && prefs.referralCode.trim()
        ? `referral:${String(prefs.referralCode).trim()}`
        : null)

    process.nextTick(() => {
      notifyAdminNewUser({
        id: before.id,
        email: before.email,
        name: before.name,
        username: before.username,
        investmentId: before.investmentId,
        role: before.role,
        createdAt: before.createdAt,
        address: before.address,
        phone,
        ip: extra?.ip || storedIp,
        userAgent: extra?.userAgent || storedUa,
        source: storedSource,
      }).catch((err) => {
        console.error('[auth] Failed to send new-user admin notification:', err)
      })
    })
  }
}

const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).trim(),
  phone: z.string().trim().min(7).max(32).regex(/^[+0-9 ()\-.]+$/, 'Invalid phone number').optional(),
  address: z.string().trim().min(5).max(200).optional(),
  source: z.string().trim().max(200).optional(),
  ref: z.string().trim().max(64).optional(),
  referralCode: z.string().trim().max(64).optional(),
})

const loginSchema = z.object({
  identifier: z.string().min(3).max(200).trim().toLowerCase().optional(),
  email: z.string().min(3).max(200).trim().toLowerCase().optional(),
  password: z.string().min(1).max(200),
}).refine((d) => !!(d.identifier || d.email), { message: 'identifier or email required' })

const forgotSchema = z.object({ email: z.string().email().toLowerCase().trim() })
const resetSchema = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) })
const resendSignupOtpSchema = z.object({ email: z.string().email().toLowerCase().trim() })
const verifySignupOtpSchema = z.object({
  pendingToken: z.string().min(10),
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
})

export default router
