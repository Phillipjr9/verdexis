import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import { otpService } from '../services/otp.js'
import { emailService } from '../services/email.js'
import { cognitoOTPService } from '../services/cognitoOTP.js'
import { getUserOTPSettings } from '../middleware/otpAuth.js'

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

  // Check if user has OTP enabled
  const otpSettings = await getUserOTPSettings(user.id)
  if (!otpSettings?.enabled) {
    res.status(403).json({ 
      error: 'OTP not enabled', 
      message: 'OTP authentication is not enabled for your account' 
    })
    return
  }

  if (parsed.data.purpose === 'email_verification' && user.emailVerified) {
    res.json({ alreadyVerified: true })
    return
  }

  // Check method availability
  if (otpSettings.method === 'disabled') {
    res.status(403).json({ 
      error: 'OTP method disabled', 
      message: 'OTP authentication method is currently disabled' 
    })
    return
  }

  try {
    const result = await otpService.create(user.id, parsed.data.purpose)
    
    if (result.error) {
      res.status(429).json({ error: result.error })
      return
    }
    
    const code = result.code!
    
    // Determine delivery method
    let deliveryMethod = parsed.data.method
    if (deliveryMethod === 'auto') {
      // Auto-select based on user preferences and available services
      deliveryMethod = otpSettings.method === 'email' ? 'email' : 'sms'
    }

    let deliveryResult
    if (deliveryMethod === 'sms') {
      // Get user's phone number from request or profile
      const phoneNumber = parsed.data.phoneNumber || await getUserPhoneNumber(user.id)
      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number required for SMS delivery' })
        return
      }

      // Use AWS Cognito for SMS OTP
      deliveryResult = await cognitoOTPService.sendOTP(phoneNumber, user.id)
    } else {
      // Send via email
      await emailService.sendOTP(user.email, user.name, code, 10, user.id)
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

  // Check if user has OTP enabled
  const otpSettings = await getUserOTPSettings(req.userId!)
  if (!otpSettings?.enabled) {
    res.status(403).json({ 
      error: 'OTP not enabled', 
      message: 'OTP authentication is not enabled for your account' 
    })
    return
  }

  const result = await otpService.verify(req.userId!, parsed.data.code, parsed.data.purpose)

  if (!result.success) {
    res.status(400).json({ error: result.error })
    return
  }

  if (parsed.data.purpose === 'email_verification') {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    })
  }

  // Set OTP verified header for subsequent requests
  res.setHeader('X-OTP-Verified', 'true')

  res.json({ 
    verified: true,
    purpose: parsed.data.purpose,
    otpVerified: true
  })
})

// Get user's OTP status and settings
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

// Get user's phone number from profile
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

// --- Phone Verification with OTP ---

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
    // Create OTP for phone verification
    const result = await otpService.create(user.id, 'phone_verification')
    
    if (result.error) {
      res.status(429).json({ error: result.error })
      return
    }

    const code = result.code!

    // Store phone number in prefs temporarily for verification
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

    // Send OTP via SMS or email
    await emailService.sendOTP(user.email, user.name, code, 10, user.id, `Phone verification code: ${code}`)

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

  // Update user with verified phone
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

  // Store verified phone in prefs
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

// --- Email Verification with OTP ---

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
    // Create OTP for email verification
    const result = await otpService.create(user.id, 'email_verification')
    
    if (result.error) {
      res.status(429).json({ error: result.error })
      return
    }

    const code = result.code!

    // Send OTP via email
    await emailService.sendOTP(user.email, user.name, code, 10, user.id, `Email verification code: ${code}`)

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

  // Update user with verified email
  await prisma.user.update({
    where: { id: req.userId! },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  res.json({
    verified: true,
    emailVerified: true,
    message: 'Email verified successfully',
  })
})

// Get verification status
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
