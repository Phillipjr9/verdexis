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
        u = await createUser({ email, name: 'Admin', passwordHash, investmentId, role: 'admin' } as any)
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

const loginSchema = z.object({
  identifier: z.string().min(3).max(200).trim().toLowerCase().optional(),
  email: z.string().min(3).max(200).trim().toLowerCase().optional(),
  password: z.string().min(1).max(200),
}).refine((d) => !!(d.identifier || d.email), { message: 'identifier or email required' })

const forgotSchema = z.object({ email: z.string().email().toLowerCase().trim() })
const resetSchema = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) })

router.post('/login', authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
    const id = String(parsed.data.identifier || parsed.data.email || '').trim().toLowerCase()
    const lockedEntry = failedLoginAttempts.get(id)
    if (lockedEntry && Date.now() < lockedEntry.lockedUntil) {
      res.status(423).json({ error: 'Account temporarily locked due to repeated failed attempts' })
      return
    }
    const user = await findUserByEmailOrUsername(id)
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return }
    if (user.deletedAt) { res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' }); return }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
    if (!ok) {
      const userKey = user.email.toLowerCase()
      const previous = failedLoginAttempts.get(userKey) || { count: 0, lockedUntil: 0 }
      const nextCount = previous.count + 1
      const lockUntil = nextCount >= 5 ? Date.now() + 15 * 60 * 1000 : 0
      failedLoginAttempts.set(userKey, { count: nextCount, lockedUntil: lockUntil })
      if (nextCount >= 5) {
        await updateUser(user.id, { suspended: true, suspendedReason: 'Repeated failed login attempts' })
      }
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    failedLoginAttempts.delete(user.email.toLowerCase())
    if (user.suspended) { res.status(403).json({ error: 'Account suspended' }); return }
    if (!user.emailVerified) {
      res.status(403).json({ error: 'Email verification required' })
      return
    }
    const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
    const token = signToken({ sub: user.id, email: user.email, v: (user as any).tokenVersion ?? 0 })
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null
      const expires = decoded?.exp ? new Date(decoded.exp * 1000) : undefined
      res.cookie('vdx_token', token, {
        httpOnly: true,
        secure: (env.NODE_ENV || 'development') === 'production',
        sameSite: 'lax',
        path: '/',
        expires,
      })
    } catch { /* ignore */ }
    res.json({ token, user: publicUser({ ...user, role }) })
  } catch (err) {
    console.error('[verdexis-api] /login crashed:', err)
    if (isDbUnavailableError(err)) {
      res.status(503).json({ error: 'Database unavailable' })
      return
    }
    res.status(500).json({ error: 'Login failed' })
  }
})

router.post('/forgot', passwordResetLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const email = parsed.data.email.trim().toLowerCase()
  const user = await getUserByEmail(email)
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    }).catch(() => undefined)
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    const base = (env.APP_BASE_URL || process.env.APP_BASE_URL || 'https://www.verdexisgroup.com').replace(/\/$/, '')
    const resetUrl = `${base}/reset?token=${rawToken}`
    try {
      const sent = await emailService.sendPasswordReset(user.email, user.name, resetUrl, user.id)
      if (!sent) console.error('[auth] Password reset email reported failure for', user.email)
      else console.log('[auth] Password reset email sent to', user.email)
    } catch (err) {
      console.error('[auth] Failed to send password reset email:', err)
    }
  }
  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })
})

router.post('/reset', authLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } })
  if (!record || record.used || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invalid or expired token' })
    return
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const currentUser = await getUserById(record.userId)
  const updated = await updateUser(record.userId, {
    passwordHash,
    tokenVersion: (currentUser?.tokenVersion ?? 0) + 1,
    suspended: false,
    suspendedReason: null,
  })
  try { failedLoginAttempts.delete(String(updated.email || '').toLowerCase()) } catch { /* ignore */ }
  await prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } })
  const secureCookie = process.env.NODE_ENV === 'production'
  res.clearCookie('verdexis_token', { httpOnly: true, sameSite: 'lax', secure: secureCookie })
  res.clearCookie('vdx_token', { httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/' })
  res.json({ ok: true, token: signToken({ sub: updated.id, email: updated.email, v: updated.tokenVersion }) })
})

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await getUserById(req.userId!)
    if (!user) { res.status(404).json({ error: 'Not found' }); return }
    const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
    res.json(publicUser({ ...user, role }))
  } catch (err) {
    if (isDbUnavailableError(err)) { res.status(503).json({ error: 'Database unavailable' }); return }
    res.status(500).json({ error: 'Unable to load profile' })
  }
})

router.post('/logout', (_req, res) => {
  const secureCookie = process.env.NODE_ENV === 'production'
  res.clearCookie('verdexis_token', { httpOnly: true, sameSite: 'lax', secure: secureCookie })
  res.clearCookie('vdx_token', { httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/' })
  res.json({ ok: true })
})

export default router
