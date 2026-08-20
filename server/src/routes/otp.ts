import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import { otpService } from '../services/otp.js'
import { emailService } from '../services/email.js'
import { cognitoOTPService } from '../services/cognitoOTP.js'
import { getUserOTPSettings } from '../middleware/otpAuth.js'
import { notifyAdminNewUser } from '../notificationService.js'

const router = Router()

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthedRequest) => req.userId || req.ip || 'anon',
})

const sendOtpSchema = z.object({
  purpose: z.enum(['login', 'email_verification', 'transaction', '2fa']).optional().default('email_verification'),
  method: z.enum(['email', 'sms', 'auto']).optional().default('auto'),
  phoneNumber: z.string().optional()
})

const verifyOtpSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
  purpose: z.enum(['login', 'email_verification', 'transaction', '2fa']).optional().default('email_verification'),
})

function clientIp(req: AuthedRequest): string | null {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || null
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0]?.trim() || null
  }
  return req.ip || (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress || null
}

function clientUserAgent(req: AuthedRequest): string | null {
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

/** Mark email verified and notify admin once on first successful verification. */
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
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  })

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
        console.error('[otp] Failed to send new-user admin notification:', err)
      })
    })
  }
}

router.post('/send-otp', requireAuth, otpLimiter, async (req: AuthedRequest, res) => {
  const parsed = sendOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, name: true, emailVerified: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Email verification is part of account registration — always allowed.
  // Optional 2FA/OTP settings only gate login / transaction / 2fa purposes.
  const otpSettings = await getUserOTPSettings(user.id)

  if (parsed.data.purpose === 'email_verification' && user.emailVerified) {
    res.json({ alreadyVerified: true })
    return
  }

  if (parsed.data.purpose !== 'email_verification') {
    if (!otpSettings?.enabled) {
      res.status(403).json({
        error: 'OTP not enabled',
        message: 'OTP authentication is not enabled for your account',
      })
      return
    }
    if (otpSettings.method === 'disabled') {
      res.status(403).json({
        error: 'OTP method disabled',
        message: 'OTP authentication method is currently disabled',
      })
      return
    }
  }

  try {
    const result = await otpService.create(user.id, parsed.data.purpose)
    
    if (result.error) {
      res.status(429).json({ error: result.error })
      return
    }
    
    const code = result.code!
    
    let deliveryMethod = parsed.data.method
    if (deliveryMethod === 'auto') {
      // OTPSettings.method is 'email' | 'both' | 'disabled' (no pure 'sms').
      // Default to email; client can still pass method: 'sms' explicitly.
      deliveryMethod = 'email'
    }

    let deliveryResult
    if (deliveryMethod === 'sms') {
      const phoneNumber = parsed.data.phoneNumber || await getUserPhoneNumber(user.id)
      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number required for SMS delivery' })
        return
      }

      deliveryResult = await cognitoOTPService.sendOTP(phoneNumber, user.id)
    } else {
      const emailSent = await emailService.sendOTP(user.email, user.name, code, 10, user.id)
      if (!emailSent) {
        res.status(500).json({ error: 'Failed to send OTP email' })
        return
      }
      deliveryResult = { success: true, provider: 'email' }
    }

    if (!deliveryResult.success) {
      res.status(500).json({ error: deliveryResult.error || 'Failed to send OTP' })
      return
    }

    res.json({
      sent: true,
      expiresIn: 10,
      message: `OTP sent via ${deliveryMethod}`,
      method: deliveryMethod,
      provider: deliveryResult.provider || deliveryMethod,
      messageId: deliveryResult.messageId
    })
  } catch (error) {
    console.error('[otp] Failed to send:', error)
    res.status(500).json({ error: 'Failed to send OTP' })
  }
})

router.post('/verify-otp', requireAuth, otpLimiter, async (req: AuthedRequest, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  if (parsed.data.purpose !== 'email_verification') {
    const otpSettings = await getUserOTPSettings(req.userId!)
    if (!otpSettings?.enabled) {
      res.status(403).json({
        error: 'OTP not enabled',
        message: 'OTP authentication is not enabled for your account',
      })
      return
    }
  }

  const result = await otpService.verify(req.userId!, parsed.data.code, parsed.data.purpose)

  if (!result.success) {
    res.status(400).json({ error: result.error })
    return
  }

  if (parsed.data.purpose === 'email_verification') {
    await markEmailVerifiedAndNotifyAdmin(req.userId!, {
      ip: clientIp(req),
      userAgent: clientUserAgent(req),
    })
  }

  res.setHeader('X-OTP-Verified', 'true')

  res.json({ 
    verified: true,
    purpose: parsed.data.purpose,
    otpVerified: true
  })
})

router.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, emailVerified: true, twoFactor: true }
  })
  
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  
  const otpSettings = await getUserOTPSettings(req.userId!)
  
  res.json({
    userId: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    twoFactor: user.twoFactor,
    otpEnabled: otpSettings?.enabled || false,
    otpMethod: otpSettings?.method || 'disabled',
    requirements: otpSettings?.enabled ? {
      login: otpSettings.requireForLogin,
      transactions: otpSettings.requireForTransactions,
      withdrawals: otpSettings.requireForWithdrawals,
      twoFactor: otpSettings.requireFor2FA
    } : null
  })
})

async function getUserPhoneNumber(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prefs: true }
  })
  
  if (!user?.prefs) return null
  
  try {
    const prefs = JSON.parse(user.prefs)
    return prefs.phone || prefs.phoneNumber || null
  } catch {
    return null
  }
}

const sendPhoneVerificationSchema = z.object({
  phoneNumber: z.string().min(7).max(32).regex(/^[+0-9 ()\-.]+$/, 'Invalid phone number'),
})

router.post('/send-phone-verification', requireAuth, otpLimiter, async (req: AuthedRequest, res) => {
  const parsed = sendPhoneVerificationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, name: true, phoneVerified: true, prefs: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  try {
    const result = await otpService.create(user.id, 'phone_verification')
    
    if (result.error) {
      res.status(429).json({ error: result.error })
      return
    }

    const code = result.code!

    let prefs: Record<string, unknown> = {}
    try {
      if (user.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    prefs.pendingPhoneNumber = parsed.data.phoneNumber
    prefs.phoneVerificationStartedAt = new Date().toISOString()

    await prisma.user.update({
      where: { id: user.id },
      data: { prefs: JSON.stringify(prefs) },
    })

    const emailSent = await emailService.sendOTP(user.email, user.name, code, 10, user.id)
    if (!emailSent) {
      res.status(500).json({ error: 'Failed to send verification code' })
      return
    }

    res.json({
      sent: true,
      expiresIn: 10,
      message: 'Verification code sent to your email',
      phoneNumber: parsed.data.phoneNumber,
    })
  } catch (error) {
    console.error('[otp] Failed to send phone verification:', error)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
})

const verifyPhoneSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
  phoneNumber: z.string().min(7).max(32).regex(/^[+0-9 ()\-.]+$/, 'Invalid phone number'),
})

router.post('/verify-phone', requireAuth, otpLimiter, async (req: AuthedRequest, res) => {
  const parsed = verifyPhoneSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const result = await otpService.verify(req.userId!, parsed.data.code, 'phone_verification')

  if (!result.success) {
    res.status(400).json({ error: result.error })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { prefs: true },
  })

  let prefs: Record<string, unknown> = {}
  try {
    if (user?.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }

  prefs.phone = parsed.data.phoneNumber
  delete (prefs as { pendingPhoneNumber?: unknown }).pendingPhoneNumber
  delete (prefs as { phoneVerificationStartedAt?: unknown }).phoneVerificationStartedAt

  await prisma.user.update({
    where: { id: req.userId! },
    data: {
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      prefs: JSON.stringify(prefs),
    },
  })

  res.json({
    verified: true,
    phoneVerified: true,
    phoneNumber: parsed.data.phoneNumber,
    message: 'Phone number verified successfully',
  })
})

router.post('/send-email-verification', requireAuth, otpLimiter, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, name: true, emailVerified: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (user.emailVerified) {
    res.json({ alreadyVerified: true, message: 'Email already verified' })
    return
  }

  try {
    const result = await otpService.create(user.id, 'email_verification')
    
    if (result.error) {
      res.status(429).json({ error: result.error })
      return
    }

    const code = result.code!

    const emailSent = await emailService.sendOTP(user.email, user.name, code, 10, user.id)
    if (!emailSent) {
      res.status(500).json({ error: 'Failed to send verification email' })
      return
    }

    res.json({
      sent: true,
      expiresIn: 10,
      message: 'Verification code sent to your email',
      email: user.email,
    })
  } catch (error) {
    console.error('[otp] Failed to send email verification:', error)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
})

const verifyEmailOtpSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
})

router.post('/verify-email-otp', requireAuth, otpLimiter, async (req: AuthedRequest, res) => {
  const parsed = verifyEmailOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const result = await otpService.verify(req.userId!, parsed.data.code, 'email_verification')

  if (!result.success) {
    res.status(400).json({ error: result.error })
    return
  }

  await markEmailVerifiedAndNotifyAdmin(req.userId!, {
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
  })

  res.json({
    verified: true,
    emailVerified: true,
    message: 'Email verified successfully',
  })
})

router.get('/verification-status', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerifiedAt: true,
      phoneVerified: true,
      phoneVerifiedAt: true,
      prefs: true,
    },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  let prefs: Record<string, unknown> = {}
  try {
    if (user.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }

  const phone = (prefs as { phone?: string }).phone || null

  res.json({
    userId: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerified: user.phoneVerified,
    phoneVerifiedAt: user.phoneVerifiedAt,
    phone,
    allVerified: user.emailVerified && user.phoneVerified,
    verificationRequired: !user.emailVerified || !user.phoneVerified,
    message: !user.emailVerified || !user.phoneVerified
      ? `Please verify your ${!user.emailVerified ? 'email' : ''} ${!user.emailVerified && !user.phoneVerified ? 'and' : ''} ${!user.phoneVerified ? 'phone number' : ''}`
      : 'All verifications complete',
  })
})

export default router
