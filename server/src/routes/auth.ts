import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { getUserByEmail, getUserById, findUserByEmailOrUsername, updateUser } from '../services/userStore.js'
import { emailService } from '../services/email.js'
import { otpService } from '../services/otp.js'
import { isDbUnavailableError } from '../dbError.js'
import { notifyPasswordChanged } from '../services/emailHooks.js'
import { recordLastLogin } from '../services/loginMeta.js'
import {
  failedLoginAttempts,
  clearFailedLoginAttempts,
  publicUser,
  buildPendingVerificationPayload,
  autoPromoteIfAdminEmail,
  promoteAllAdminEmails,
  loginSchema,
  forgotSchema,
  resetSchema,
} from './authHelpers.js'
import { registerSignupRoutes } from './authSignup.js'

const router = Router()

export { clearFailedLoginAttempts, autoPromoteIfAdminEmail, promoteAllAdminEmails }

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

registerSignupRoutes(router, authLimiter)

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
    if ((user as any).deletedAt) { res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' }); return }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
    if (!ok) {
      const userKey = user.email.toLowerCase()
      const previous = failedLoginAttempts.get(userKey) || { count: 0, lockedUntil: 0 }
      const nextCount = previous.count + 1
      const lockUntil = nextCount >= 5 ? Date.now() + 15 * 60 * 1000 : 0
      failedLoginAttempts.set(userKey, { count: nextCount, lockedUntil: lockUntil })
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    failedLoginAttempts.delete(user.email.toLowerCase())

    // Auto-recover if suspended solely due to past failed login attempts
    if (user.suspended && user.suspendedReason === 'Repeated failed login attempts') {
      await updateUser(user.id, { suspended: false, suspendedReason: null })
      user.suspended = false
      user.suspendedReason = null
    }

    if (user.suspended) { res.status(403).json({ error: 'Account suspended' }); return }

    if (!user.emailVerified) {
      const otpResult = await otpService.create(user.id, 'email_verification')
      if (otpResult.error || !otpResult.code) {
        res.status(429).json({
          error: 'Email verification required',
          code: 'EMAIL_NOT_VERIFIED',
          message: otpResult.error || 'Please wait before requesting a new verification code.',
        })
        return
      }
      const isDev = (env.NODE_ENV || 'development') !== 'production'
      let emailSent = false
      try {
        emailSent = await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
      } catch (err) {
        console.warn('[auth] Failed to send login OTP email:', err)
      }
      if (!emailSent && !isDev) {
        console.warn('[auth] OTP email not sent in production; check SMTP configuration')
      }
      const pendingToken = signToken({
        sub: user.id,
        email: user.email,
        v: (user as { tokenVersion?: number }).tokenVersion ?? 0,
        otpPending: true,
        signupVerification: true,
      })
      res.status(200).json({
        ok: true,
        otpRequired: true,
        code: 'EMAIL_NOT_VERIFIED',
        ...buildPendingVerificationPayload({ kind: 'login', pendingToken, email: user.email }),
        ...(isDev ? { devCode: otpResult.code } : {}),
      })
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
    void recordLastLogin(user.id, req).catch((e) => console.warn('[login] last-login meta failed', e))
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

router.post('/login/verify-otp', authLimiter, async (req, res) => {
  try {
    const parsed = verifySignupOtpSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
    const payload = verifyToken(parsed.data.pendingToken) as { sub?: string; otpPending?: boolean } | null
    if (!payload?.sub || !payload.otpPending) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' })
      return
    }
    const result = await otpService.verify(payload.sub, parsed.data.code, 'email_verification')
    if (!result.success) { res.status(400).json({ error: result.error }); return }
    const user = await getUserById(payload.sub)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    if (user.suspended) { res.status(403).json({ error: 'Account suspended' }); return }
    if ((user as any).deletedAt) { res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' }); return }
    await markEmailVerifiedAndNotifyAdmin(user.id)
    const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
    const token = signToken({ sub: user.id, email: user.email, v: (user as { tokenVersion?: number }).tokenVersion ?? 0 })
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null
      const expires = decoded?.exp ? new Date(decoded.exp * 1000) : undefined
      res.cookie('vdx_token', token, { httpOnly: true, secure: (env.NODE_ENV || 'development') === 'production', sameSite: 'lax', path: '/', expires })
    } catch { /* ignore */ }
    void recordLastLogin(user.id, req).catch((e) => console.warn('[login] last-login meta failed', e))
    res.json({ token, user: publicUser({ ...user, role, emailVerified: true, emailVerifiedAt: new Date() }), verified: true, emailVerified: true, message: 'Signed in successfully.' })
  } catch (err) {
    console.error('[auth] /login/verify-otp crashed:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

router.post('/login/resend-otp', authLimiter, async (req, res) => {
  try {
    const body = (req.body ?? {}) as { pendingToken?: string; email?: string }
    let userId: string | null = null
    let email: string | null = null

    if (body.pendingToken) {
      const payload = verifyToken(body.pendingToken) as { sub?: string; email?: string } | null
      if (payload?.sub) {
        userId = payload.sub
        email = payload.email || null
      }
    }
    if (!userId && body.email) {
      const u = await getUserByEmail(body.email.trim().toLowerCase())
      if (u) {
        userId = u.id
        email = u.email
      }
    }

    if (!userId) {
      res.status(400).json({ error: 'Session expired. Please sign in again.' })
      return
    }

    const user = await getUserById(userId)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    if (user.emailVerified) {
      res.status(409).json({ error: 'Email already verified. Please sign in.' })
      return
    }

    const otpResult = await otpService.create(user.id, 'email_verification')
    if (otpResult.error || !otpResult.code) {
      res.status(429).json({ error: otpResult.error || 'Could not create verification code' })
      return
    }

    const isDev = (env.NODE_ENV || 'development') !== 'production'
    try {
      await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
    } catch (e) {
      console.warn('[auth] Resend OTP email failed:', e)
    }

    const pendingToken = signToken({
      sub: user.id,
      email: user.email,
      v: (user as { tokenVersion?: number }).tokenVersion ?? 0,
      otpPending: true,
      signupVerification: true,
    })

    res.status(200).json({
      ...buildPendingVerificationPayload({ kind: 'login', pendingToken, email: user.email }),
      ...(isDev ? { devCode: otpResult.code } : {}),
    })
  } catch (err) {
    console.error('[auth] /login/resend-otp crashed:', err)
    res.status(500).json({ error: 'Failed to resend code' })
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
    const base = (env.APP_BASE_URL || process.env.APP_BASE_URL || 'https://www.verdexisgroup.online').replace(/\/$/, '')
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
  void notifyPasswordChanged(updated, { ip: req.ip })
  const secureCookie = process.env.NODE_ENV === 'production'
  res.clearCookie('verdexis_token', { httpOnly: true, sameSite: 'lax', secure: secureCookie })
  res.clearCookie('vdx_token', { httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/' })
  res.json({ ok: true, token: signToken({ sub: updated.id, email: updated.email, v: updated.tokenVersion }) })
})

router.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const changePasswordSchema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(200),
    })
    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input. New password must be at least 8 characters.' })
      return
    }

    const user = await getUserById(req.userId!)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
    if (!ok) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    const tokenVersion = ((user as { tokenVersion?: number }).tokenVersion ?? 0) + 1
    const updated = await updateUser(user.id, {
      passwordHash,
      tokenVersion,
    })

    const token = signToken({ sub: updated.id, email: updated.email, v: tokenVersion })
    void notifyPasswordChanged(updated, { ip: req.ip })
    res.json({ ok: true, token, message: 'Password changed successfully' })
  } catch (err) {
    console.error('[auth] /change-password error:', err)
    res.status(500).json({ error: 'Failed to change password' })
  }
})

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await getUserById(req.userId!)
    if (!user) { res.status(404).json({ error: 'Not found' }); return }
    const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
    void recordLastLogin(user.id, req).catch((e) => console.warn('[me] last-login meta failed', e))
    res.json({ user: publicUser({ ...user, role }) })
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
