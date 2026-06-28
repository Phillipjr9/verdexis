import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import { otpService } from '../services/otp.js'
import { emailService } from '../services/email.js'
import { awsOTPService } from '../services/awsOTP.js'
import { smsService } from '../services/sms.js'
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
    const code = await otpService.create(user.id, parsed.data.purpose)
    
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

      // Try AWS OTP service first, fallback to regular SMS
      deliveryResult = await awsOTPService.sendOTP(phoneNumber, code, parsed.data.purpose, user.id)
      
      if (!deliveryResult.success) {
        // Fallback to regular SMS service
        deliveryResult = await smsService.sendOTP(phoneNumber, code, 10)
      }
    } else {
      // Send via email
      await emailService.sendOTP(user.email, user.name, code, 10)
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

export default router
