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
import { notifyAdminNewUser } from '../notificationService.js'

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

router.post('/signup', authLimiter, async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid input',
        code: 'SIGNUP_VALIDATION_FAILED',
        message: 'Please check the form fields and try again.',
        details: { ...parsed.error.flatten(), retryable: false },
      })
      return
    }
    const { email, password, name, phone, address, source: bodySource, ref: bodyRef, referralCode: bodyReferralCode } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    const signupStartedAt = Date.now()
    const emailPrefix = normalizedEmail.split('@')[0]?.slice(0, 3) || '???'
    const ip = clientIp(req)
    const userAgent = clientUserAgent(req)

    function logSignupError(code: string, detail: Record<string, unknown>) {
      console.error('[auth] signup error', {
        code,
        emailPrefix,
        elapsedMs: Date.now() - signupStartedAt,
        ...detail,
      })
    }

    async function rollbackUnverifiedSignup(userId: string, reason: string): Promise<{ ok: boolean; method?: string; error?: string }> {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.otp.deleteMany({ where: { userId } })
          await tx.user.delete({ where: { id: userId } })
        })
        console.warn('[auth] Transaction rollback succeeded', { userId, reason, method: 'transaction' })
        return { ok: true, method: 'transaction' }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[auth] Transaction rollback failed, trying sequential purge', { userId, reason, error: message })
        try {
          await prisma.otp.deleteMany({ where: { userId } })
          await prisma.user.delete({ where: { id: userId } })
          console.warn('[auth] Fallback sequential purge succeeded', { userId, reason })
          return { ok: true, method: 'sequential' }
        } catch (err2) {
          const message2 = err2 instanceof Error ? err2.message : String(err2)
          console.error('[auth] Fallback purge failed — orphan user may remain', { userId, reason, error: message2 })
          return { ok: false, error: message2 }
        }
      }
    }

    function smtpConfigHints() {
      return {
        smtpHostConfigured: Boolean(env.SMTP_HOST),
        smtpUserConfigured: Boolean(env.SMTP_USER),
        smtpPassConfigured: Boolean(env.SMTP_PASS),
        emailFromConfigured: Boolean(env.EMAIL_FROM_ADDRESS || env.SMTP_USER),
      }
    }

    let existing: Awaited<ReturnType<typeof getUserByEmail>> | null = null
    try {
      existing = await getUserByEmail(normalizedEmail)
    } catch (dbError) {
      if (!isDbUnavailableError(dbError as Error)) throw dbError
      res.status(503).json({
        error: 'Database unavailable',
        code: 'SIGNUP_DB_UNAVAILABLE',
        message: 'The database is temporarily unavailable. Please try again shortly.',
        details: { retryable: true },
      })
      return
    }

    if (existing?.emailVerified) {
      res.status(409).json({
        error: 'Email already registered',
        code: 'SIGNUP_EMAIL_TAKEN',
        message: 'An account with this email is already registered. Please log in or reset your password.',
        details: { retryable: false },
      })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const isSignupRetry = !!(existing && !existing.emailVerified)

    const prefsPayload: Record<string, unknown> = {
      phone: phone ?? null,
    }
    if (ip) {
      prefsPayload.signupIp = ip
      prefsPayload.lastIp = ip
    }
    if (userAgent) prefsPayload.signupUserAgent = userAgent

    const referralToken = String(bodyRef || bodyReferralCode || '').trim()
    const explicitSource = String(bodySource || '').trim()
    const refererHeader =
      (typeof req.headers.referer === 'string' && req.headers.referer.trim()) ||
      (typeof req.headers.referrer === 'string' && req.headers.referrer.trim()) ||
      null
    let signupSource: string | null = null
    if (explicitSource) {
      signupSource = explicitSource
    } else if (referralToken) {
      signupSource = `referral:${referralToken}`
    } else if (refererHeader) {
      try {
        const u = new URL(refererHeader)
        const refParam = u.searchParams.get('ref') || u.searchParams.get('referral') || u.searchParams.get('utm_source')
        if (refParam) signupSource = `referral:${refParam}`
        else signupSource = `referer:${u.hostname}${u.pathname}`.slice(0, 200)
      } catch {
        signupSource = `referer:${refererHeader.slice(0, 120)}`
      }
    }
    if (signupSource) prefsPayload.signupSource = signupSource
    if (referralToken) prefsPayload.referralCode = referralToken

    let user: any
    try {
      if (isSignupRetry && existing) {
        const existingPrefs = parsePrefs(existing.prefs)
        user = await updateUser(existing.id, {
          name,
          passwordHash,
          prefs: JSON.stringify({ ...existingPrefs, ...prefsPayload }),
          ...(address !== undefined ? { address } : {}),
          emailVerified: false,
          emailVerifiedAt: null,
        })
        console.info(`[auth] Signup retry for unverified email ${normalizedEmail} (user ${existing.id})`)
      } else {
        const investmentId = await generateInvestmentId().catch(
          () => `VDX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        )
        const createData: any = {
          email: normalizedEmail,
          name,
          passwordHash,
          investmentId,
          role: ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'user',
          emailVerified: false,
          prefs: JSON.stringify(prefsPayload),
        }
        if (address !== undefined) createData.address = address
        user = await createUser(createData)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/Unique constraint failed/i.test(msg) || /P2002/.test(msg)) {
        const raced = await getUserByEmail(normalizedEmail).catch(() => null)
        if (raced && !raced.emailVerified) {
          const racedPrefs = parsePrefs(raced.prefs)
          user = await updateUser(raced.id, {
            name,
            passwordHash,
            prefs: JSON.stringify({ ...racedPrefs, ...prefsPayload }),
            ...(address !== undefined ? { address } : {}),
            emailVerified: false,
            emailVerifiedAt: null,
          })
        } else {
          res.status(409).json({
            error: 'Email already registered',
            code: 'SIGNUP_EMAIL_TAKEN',
            message: 'An account with this email is already registered. Please log in or reset your password.',
            details: { retryable: false },
          })
          return
        }
      } else {
        throw e
      }
    }

    try {
      const otpResult = await otpService.create(user.id, 'email_verification')
      if (otpResult.error || !otpResult.code) {
        const rollback = await rollbackUnverifiedSignup(user.id, `otp-create-failed: ${otpResult.error || 'no-code'}`)
        logSignupError('SIGNUP_OTP_CREATE_FAILED', {
          userId: user.id,
          otpError: otpResult.error || 'no-code',
          rollbackOk: rollback.ok,
          rollbackMethod: rollback.method,
          rollbackError: rollback.error,
        })
        res.status(429).json({
          error: 'Could not create verification code',
          code: 'SIGNUP_OTP_CREATE_FAILED',
          message: otpResult.error || 'Please wait a moment and try again.',
          details: {
            reason: otpResult.error || 'rate_limited_or_unavailable',
            accountSaved: !rollback.ok,
            retryable: true,
          },
        })
        return
      }

      const emailSent = await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
      if (!emailSent) {
        const rollback = await rollbackUnverifiedSignup(user.id, 'otp-email-send-failed')
        logSignupError('SIGNUP_EMAIL_SEND_FAILED', {
          userId: user.id,
          rollbackOk: rollback.ok,
          rollbackMethod: rollback.method,
          rollbackError: rollback.error,
          ...smtpConfigHints(),
        })
        res.status(500).json({
          error: 'Verification email failed',
          code: 'SIGNUP_EMAIL_SEND_FAILED',
          message: rollback.ok
            ? 'Unable to send verification code. No account was saved — please try again in a moment.'
            : 'Unable to send verification code. Your account may need support to clear before retrying.',
          details: {
            reason: 'smtp_or_provider_failure',
            accountSaved: !rollback.ok,
            rollback: rollback.ok ? rollback.method : 'failed',
            retryable: rollback.ok,
            hint: rollback.ok
              ? 'Check SMTP credentials on the server, then retry signup.'
              : 'Contact support to remove the incomplete registration for this email.',
          },
        })
        return
      }
    } catch (signupOtpErr) {
      const errMsg = signupOtpErr instanceof Error ? signupOtpErr.message : String(signupOtpErr)
      const rollback = await rollbackUnverifiedSignup(user.id, 'otp-exception')
      logSignupError('SIGNUP_OTP_EXCEPTION', {
        userId: user.id,
        error: errMsg,
        rollbackOk: rollback.ok,
        rollbackMethod: rollback.method,
        ...smtpConfigHints(),
      })
      res.status(500).json({
        error: 'Verification email failed',
        code: 'SIGNUP_OTP_EXCEPTION',
        message: rollback.ok
          ? 'Unable to send verification code. No account was saved — please try again or contact support.'
          : 'Unable to complete signup. Please contact support if this persists.',
        details: {
          reason: 'unexpected_error',
          accountSaved: !rollback.ok,
          rollback: rollback.ok ? rollback.method : 'failed',
          retryable: rollback.ok,
        },
      })
      return
    }

    const pendingToken = signToken({
      sub: user.id,
      email: user.email,
      v: (user as { tokenVersion?: number }).tokenVersion ?? 0,
      otpPending: true,
      signupVerification: true,
    })
    const pendingVerificationPayload = buildPendingVerificationPayload({
      kind: 'signup',
      pendingToken,
      email: user.email,
    })

    res.status(isSignupRetry ? 202 : 201).json({
      ...pendingVerificationPayload,
      token: pendingToken,
      user: publicUser({ ...user, emailVerified: false }),
      message: 'Account created. Check your email for a 6-digit verification code.',
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[auth] Signup failed:', { error: errMsg, stack: e instanceof Error ? e.stack : undefined })
    if (isDbUnavailableError(e as Error)) {
      res.status(503).json({
        error: 'Database unavailable',
        code: 'SIGNUP_DB_UNAVAILABLE',
        message: 'The database is temporarily unavailable. Please try again shortly.',
        details: { retryable: true },
      })
      return
    }
    res.status(500).json({
      error: 'Signup failed',
      code: 'SIGNUP_UNEXPECTED',
      message: 'Something went wrong during signup. Please try again.',
      details: { retryable: true },
    })
  }
})

router.post('/signup/resend-otp', authLimiter, async (req, res) => {
  try {
    const parsed = resendSignupOtpSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { email } = parsed.data
    const user = await getUserByEmail(email)

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (user.emailVerified) {
      res.status(409).json({ error: 'Email already verified' })
      return
    }

    const otpResult = await otpService.create(user.id, 'email_verification')
    if (otpResult.error || !otpResult.code) {
      res.status(429).json({ error: otpResult.error || 'Could not create verification code' })
      return
    }

    const emailSent = await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
    if (!emailSent) {
      console.error('[auth] Failed to resend signup OTP email to', user.email)
      res.status(500).json({
        error: 'Verification email failed',
        message: 'Unable to resend verification code. Please try again or contact support.',
      })
      return
    }

    const pendingToken = signToken({
      sub: user.id,
      email: user.email,
      v: (user as { tokenVersion?: number }).tokenVersion ?? 0,
      otpPending: true,
      signupVerification: true,
    })
    const payload = buildPendingVerificationPayload({ kind: 'signup', pendingToken, email: user.email })
    const isDev = (env.NODE_ENV || 'development') !== 'production'

    res.status(202).json({
      ...payload,
      ...(isDev ? { devCode: otpResult.code } : {}),
    })
  } catch (err) {
    console.error('[auth] /signup/resend-otp crashed:', err)
    res.status(500).json({ error: 'Failed to resend code' })
  }
})

router.post('/signup/verify-otp', authLimiter, async (req, res) => {
  try {
    const parsed = verifySignupOtpSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const payload = verifyToken(parsed.data.pendingToken) as {
      sub?: string
      otpPending?: boolean
      signupVerification?: boolean
    } | null

    if (!payload?.sub || !payload.otpPending) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign up again or request a new code.' })
      return
    }

    const result = await otpService.verify(payload.sub, parsed.data.code, 'email_verification')
    if (!result.success) {
      res.status(400).json({ error: result.error })
      return
    }

    const user = await getUserById(payload.sub)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (user.suspended) {
      res.status(403).json({ error: 'Account suspended' })
      return
    }
    if ((user as any).deletedAt) {
      res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' })
      return
    }

    await markEmailVerifiedAndNotifyAdmin(user.id, {
      ip: clientIp(req),
      userAgent: clientUserAgent(req),
    })

    process.nextTick(() => {
      emailService.sendWelcome(user.email, user.name, user.id).catch((err) => {
        console.error('[auth] Failed to send welcome email:', err)
      })
    })

    const role = await autoPromoteIfAdminEmail(user.id, user.email, user.role)
    const token = signToken({
      sub: user.id,
      email: user.email,
      v: (user as { tokenVersion?: number }).tokenVersion ?? 0,
    })

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

    res.json({
      token,
      user: publicUser({ ...user, role, emailVerified: true, emailVerifiedAt: new Date() }),
      verified: true,
      emailVerified: true,
      message: 'Email verified successfully. You are now signed in.',
    })
  } catch (err) {
    console.error('[auth] /signup/verify-otp crashed:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

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
      if (nextCount >= 5) {
        await updateUser(user.id, { suspended: true, suspendedReason: 'Repeated failed login attempts' })
      }
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    failedLoginAttempts.delete(user.email.toLowerCase())
    if (user.suspended) { res.status(403).json({ error: 'Account suspended' }); return }

    if (!user.emailVerified) {
      const otpResult = await otpService.create(user.id, 'email_verification')
      if (otpResult.error || !otpResult.code) {
        res.status(403).json({
          error: 'Email verification required',
          code: 'EMAIL_NOT_VERIFIED',
          message: otpResult.error || 'Please verify your email. Request a new code from the signup screen.',
        })
        return
      }
      const emailSent = await emailService.sendOTP(user.email, user.name, otpResult.code, 10, user.id)
      if (!emailSent) {
        res.status(500).json({
          error: 'Verification email failed',
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Unable to send verification code. Please try again.',
        })
        return
      }
      const pendingToken = signToken({
        sub: user.id,
        email: user.email,
        v: (user as { tokenVersion?: number }).tokenVersion ?? 0,
        otpPending: true,
        signupVerification: true,
      })
      const isDev = (env.NODE_ENV || 'development') !== 'production'
      res.status(403).json({
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
        ...buildPendingVerificationPayload({ kind: 'signup', pendingToken, email: user.email }),
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
