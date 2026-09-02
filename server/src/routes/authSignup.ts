import type { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { signToken, verifyToken } from '../auth.js'
import { env } from '../env.js'
import { createUser, getUserByEmail, getUserById, updateUser } from '../services/userStore.js'
import { emailService } from '../services/email.js'
import { otpService } from '../services/otp.js'
import { isDbUnavailableError } from '../dbError.js'
import { generateInvestmentId } from '../investmentId.js'
import { recordLastLogin } from '../services/loginMeta.js'
import {
  ADMIN_EMAILS,
  publicUser,
  buildPendingVerificationPayload,
  autoPromoteIfAdminEmail,
  markEmailVerifiedAndNotifyAdmin,
  signupSchema,
  resendSignupOtpSchema,
  verifySignupOtpSchema,
} from './authHelpers.js'

export function registerSignupRoutes(router: Router, authLimiter: any) {
  router.post('/signup', authLimiter, async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', code: 'SIGNUP_VALIDATION_FAILED', details: parsed.error.flatten() })
        return
      }
      const { email, password, name, phone, address } = parsed.data
      const normalizedEmail = email.trim().toLowerCase()
      const existing = await getUserByEmail(normalizedEmail).catch((e) => { if (isDbUnavailableError(e as Error)) { res.status(503).json({ error: 'Database unavailable' }); return 'db' as const } throw e })
      if (existing === 'db') return
      if (existing?.emailVerified) {
        res.status(409).json({ error: 'Email already registered', code: 'SIGNUP_EMAIL_TAKEN' })
        return
      }
      const passwordHash = await bcrypt.hash(password, 12)
      let user: any
      if (existing && !existing.emailVerified) {
        user = await updateUser(existing.id, { name, passwordHash, prefs: JSON.stringify({ phone: phone ?? null }), ...(address !== undefined ? { address } : {}), emailVerified: false, emailVerifiedAt: null })
      } else {
        const investmentId = await generateInvestmentId().catch(() => `VDX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`)
        user = await createUser({ email: normalizedEmail, name, passwordHash, investmentId, role: ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'user', emailVerified: false, prefs: JSON.stringify({ phone: phone ?? null }), ...(address !== undefined ? { address } : {}) } as any)
      }
      const otpResult = await otpService.create(user.id, 'email_verification')
      if (otpResult.error || !otpResult.code) {
        res.status(429).json({ error: otpResult.error || 'Could not create verification code' })
        return
      }
      const emailSent = await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
      if (!emailSent) {
        res.status(500).json({ error: 'Verification email failed' })
        return
      }
      const pendingToken = signToken({ sub: user.id, email: user.email, v: (user as { tokenVersion?: number }).tokenVersion ?? 0, otpPending: true, signupVerification: true })
      res.status(201).json({ ...buildPendingVerificationPayload({ kind: 'signup', pendingToken, email: user.email }), token: pendingToken, user: publicUser({ ...user, emailVerified: false }) })
    } catch (e) {
      console.error('[auth] Signup failed:', e)
      res.status(500).json({ error: 'Signup failed' })
    }
  })

  router.post('/signup/resend-otp', authLimiter, async (req, res) => {
    try {
      const parsed = resendSignupOtpSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
      const user = await getUserByEmail(parsed.data.email)
      if (!user) { res.status(404).json({ error: 'User not found' }); return }
      if (user.emailVerified) { res.status(409).json({ error: 'Email already verified' }); return }
      const otpResult = await otpService.create(user.id, 'email_verification')
      if (otpResult.error || !otpResult.code) { res.status(429).json({ error: otpResult.error || 'Could not create verification code' }); return }
      const emailSent = await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
      if (!emailSent) { res.status(500).json({ error: 'Verification email failed' }); return }
      const pendingToken = signToken({ sub: user.id, email: user.email, v: (user as { tokenVersion?: number }).tokenVersion ?? 0, otpPending: true, signupVerification: true })
      res.status(202).json(buildPendingVerificationPayload({ kind: 'signup', pendingToken, email: user.email }))
    } catch (err) {
      console.error('[auth] /signup/resend-otp crashed:', err)
      res.status(500).json({ error: 'Failed to resend code' })
    }
  })

  router.post('/signup/verify-otp', authLimiter, async (req, res) => {
    try {
      const parsed = verifySignupOtpSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
      const payload = verifyToken(parsed.data.pendingToken) as { sub?: string; otpPending?: boolean } | null
      if (!payload?.sub || !payload.otpPending) { res.status(401).json({ error: 'Invalid or expired session. Please sign up again or request a new code.' }); return }
      const result = await otpService.verify(payload.sub, parsed.data.code, 'email_verification')
      if (!result.success) { res.status(400).json({ error: result.error }); return }
      const user = await getUserById(payload.sub)
      if (!user) { res.status(404).json({ error: 'User not found' }); return }
      if (user.suspended) { res.status(403).json({ error: 'Account suspended' }); return }
      if ((user as any).deletedAt) { res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' }); return }
      await markEmailVerifiedAndNotifyAdmin(user.id)
      process.nextTick(() => { emailService.sendWelcome(user.email, user.name, user.id).catch((err) => console.error('[auth] Failed to send welcome email:', err)) })
      const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
      const token = signToken({ sub: user.id, email: user.email, v: (user as { tokenVersion?: number }).tokenVersion ?? 0 })
      try {
        const decoded = jwt.decode(token) as { exp?: number } | null
        const expires = decoded?.exp ? new Date(decoded.exp * 1000) : undefined
        res.cookie('vdx_token', token, { httpOnly: true, secure: (env.NODE_ENV || 'development') === 'production', sameSite: 'lax', path: '/', expires })
      } catch { /* ignore */ }
      void recordLastLogin(user.id, req).catch((e) => console.warn('[signup] last-login meta failed', e))
      res.json({ token, user: publicUser({ ...user, role, emailVerified: true, emailVerifiedAt: new Date() }), verified: true, emailVerified: true, message: 'Email verified successfully. You are now signed in.' })
    } catch (err) {
      console.error('[auth] /signup/verify-otp crashed:', err)
      res.status(500).json({ error: 'Verification failed' })
    }
  })
}
