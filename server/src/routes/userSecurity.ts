import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { trustedDeviceService } from '../services/trustedDevice.js'
import { totpService } from '../services/totp.js'
import { sessionManagementService } from '../services/sessionManagement.js'
import { getUserOTPSettings } from '../middleware/otpAuth.js'
import { prisma } from '../db.js'

const router = Router()

const userSecurityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthedRequest) => req.userId || req.ip || 'anon',
})

router.use(userSecurityLimiter)
router.use(requireAuth)

// SECURITY OVERVIEW

router.get('/overview', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  
  const [user, otpSettings, totpStatus, trustedDevices, sessions, recentEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerified: true,
        twoFactor: true,
        createdAt: true,
        prefs: true
      }
    }),
    getUserOTPSettings(userId),
    totpService.getTOTPStatus(userId),
    trustedDeviceService.getUserDevices(userId),
    sessionManagementService.getUserSessions(userId),
    prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ])

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  let prefs: any = {}
  try {
    if (user.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }

  const securityScore = calculateSecurityScore({
    emailVerified: user.emailVerified,
    twoFactor: user.twoFactor,
    otpEnabled: otpSettings?.enabled || false,
    totpEnabled: totpStatus.enabled,
    trustedDevicesCount: trustedDevices.length,
    hasBackupCodes: totpStatus.unusedBackupCodes > 0
  })

  res.json({
    user: {
      email: user.email,
      emailVerified: user.emailVerified,
      accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    },
    securityScore,
    authentication: {
      twoFactor: user.twoFactor,
      otp: {
        enabled: otpSettings?.enabled || false,
        method: otpSettings?.method || 'disabled',
        requirements: otpSettings?.enabled ? {
          login: otpSettings.requireForLogin,
          transactions: otpSettings.requireForTransactions,
          withdrawals: otpSettings.requireForWithdrawals,
          twoFactor: otpSettings.requireFor2FA
        } : null
      },
      totp: totpStatus
    },
    devices: {
      total: trustedDevices.length,
      trusted: trustedDevices.filter(d => d.isTrusted).length,
      recent: trustedDevices.slice(0, 5).map(device => ({
        id: device.id,
        name: device.deviceName,
        lastSeen: device.lastSeenAt,
        trusted: device.isTrusted,
        location: device.location
      }))
    },
    sessions: {
      total: sessions.length,
      active: sessions.filter(s => s.expiresAt > new Date()).length,
      otpVerified: sessions.filter(s => s.otpVerified).length
    },
    recentActivity: recentEvents.map(event => ({
      type: event.eventType,
      severity: event.severity,
      description: event.description,
      timestamp: event.createdAt,
      resolved: event.resolved
    }))
  })
})

// TRUSTED DEVICES MANAGEMENT

router.get('/devices', async (req: AuthedRequest, res) => {
  const devices = await trustedDeviceService.getUserDevices(req.userId!)
  res.json({ devices })
})

router.post('/devices/:deviceId/trust', async (req: AuthedRequest, res) => {
  const { deviceId } = req.params
  
  const device = await prisma.trustedDevice.findFirst({
    where: { id: deviceId, userId: req.userId! }
  })
  
  if (!device) {
    res.status(404).json({ error: 'Device not found' })
    return
  }
  
  await prisma.trustedDevice.update({
    where: { id: deviceId },
    data: { isTrusted: true, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
  })
  
  res.json({ success: true })
})

router.delete('/devices/:deviceId', async (req: AuthedRequest, res) => {
  await trustedDeviceService.revokeDevice(req.userId!, req.params.deviceId)
  res.json({ success: true })
})

// TOTP MANAGEMENT

router.post('/totp/setup', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { email: true }
  })
  
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  
  const setup = await totpService.setupTOTP(req.userId!, user.email)
  res.json(setup)
})

const totpVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits')
})

router.post('/totp/enable', async (req: AuthedRequest, res) => {
  const parsed = totpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid verification code' })
    return
  }
  
  const success = await totpService.enableTOTP(req.userId!, parsed.data.code)
  
  if (!success) {
    res.status(400).json({ error: 'Invalid verification code' })
    return
  }
  
  res.json({ success: true, message: 'TOTP enabled successfully' })
})

router.post('/totp/disable', async (req: AuthedRequest, res) => {
  await totpService.disableTOTP(req.userId!)
  res.json({ success: true, message: 'TOTP disabled successfully' })
})

router.post('/totp/regenerate-backup-codes', async (req: AuthedRequest, res) => {
  try {
    const backupCodes = await totpService.regenerateBackupCodes(req.userId!)
    res.json({ success: true, backupCodes })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to regenerate codes' })
  }
})

// SESSION MANAGEMENT

router.get('/sessions', async (req: AuthedRequest, res) => {
  const sessions = await sessionManagementService.getUserSessions(req.userId!)
  res.json({ sessions })
})

router.delete('/sessions/:sessionId', async (req: AuthedRequest, res) => {
  await sessionManagementService.revokeSession(req.params.sessionId)
  res.json({ success: true })
})

router.delete('/sessions/all', async (req: AuthedRequest, res) => {
  const count = await sessionManagementService.revokeAllUserSessions(req.userId!)
  res.json({ success: true, revokedSessions: count })
})

// SECURITY EVENTS

router.get('/events', async (req: AuthedRequest, res) => {
  const { days = 30, type, resolved } = req.query
  const since = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000)
  
  const events = await prisma.securityEvent.findMany({
    where: {
      userId: req.userId!,
      createdAt: { gte: since },
      ...(type ? { eventType: type as string } : {}),
      ...(resolved !== undefined ? { resolved: resolved === 'true' } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  
  res.json({ 
    events: events.map(event => ({
      id: event.id,
      type: event.eventType,
      severity: event.severity,
      description: event.description,
      timestamp: event.createdAt,
      resolved: event.resolved,
      metadata: event.metadata ? JSON.parse(event.metadata) : null
    }))
  })
})

// SECURITY PREFERENCES

const securityPrefsSchema = z.object({
  enableEmailAlerts: z.boolean().default(true),
  enableSMSAlerts: z.boolean().default(false),
  alertOnNewDevice: z.boolean().default(true),
  alertOnNewLocation: z.boolean().default(true),
  alertOnLargeTransaction: z.boolean().default(true),
  alertOnPasswordChange: z.boolean().default(true),
  sessionTimeout: z.number().min(15).max(1440).default(60), // minutes
  requireTrustedDevice: z.boolean().default(false),
  ipWhitelist: z.array(z.string().ip()).optional()
})

router.get('/preferences', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { prefs: true }
  })
  
  let prefs: any = {}
  try {
    if (user?.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }
  
  const securityPrefs = prefs.securityPreferences || {
    enableEmailAlerts: true,
    enableSMSAlerts: false,
    alertOnNewDevice: true,
    alertOnNewLocation: true,
    alertOnLargeTransaction: true,
    alertOnPasswordChange: true,
    sessionTimeout: 60,
    requireTrustedDevice: false
  }
  
  res.json({ preferences: securityPrefs })
})

router.put('/preferences', async (req: AuthedRequest, res) => {
  const parsed = securityPrefsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid preferences', details: parsed.error.flatten() })
    return
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { prefs: true }
  })
  
  let prefs: any = {}
  try {
    if (user?.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }
  
  prefs.securityPreferences = parsed.data
  
  await prisma.user.update({
    where: { id: req.userId! },
    data: { prefs: JSON.stringify(prefs) }
  })
  
  res.json({ success: true, preferences: parsed.data })
})

// RECOVERY CODES

router.post('/recovery-codes/generate', async (req: AuthedRequest, res) => {
  const codes = []
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase()
    codes.push(code)
  }
  
  // Store hashed codes
  const hashedCodes = codes.map(code => {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(code).digest('hex')
  })
  
  await prisma.recoveryCode.createMany({
    data: hashedCodes.map(hash => ({
      userId: req.userId!,
      code: hash,
      type: 'account_recovery',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    }))
  })
  
  res.json({ 
    success: true, 
    codes,
    message: 'Store these codes in a safe place. They can be used to recover your account if you lose access to your authentication methods.'
  })
})

/**
 * Calculate security score based on enabled features
 */
function calculateSecurityScore(factors: {
  emailVerified: boolean
  twoFactor: boolean
  otpEnabled: boolean
  totpEnabled: boolean
  trustedDevicesCount: number
  hasBackupCodes: boolean
}): { score: number; level: string; recommendations: string[] } {
  let score = 0
  const recommendations: string[] = []
  
  // Base security
  if (factors.emailVerified) {
    score += 20
  } else {
    recommendations.push('Verify your email address')
  }
  
  // Two-factor authentication
  if (factors.twoFactor) {
    score += 25
  } else {
    recommendations.push('Enable two-factor authentication')
  }
  
  // OTP authentication
  if (factors.otpEnabled) {
    score += 20
  } else {
    recommendations.push('Enable OTP authentication for additional security')
  }
  
  // TOTP (authenticator app)
  if (factors.totpEnabled) {
    score += 25
  } else {
    recommendations.push('Set up authenticator app (TOTP)')
  }
  
  // Trusted devices
  if (factors.trustedDevicesCount > 0) {
    score += 5
  }
  
  // Backup codes
  if (factors.hasBackupCodes) {
    score += 5
  } else if (factors.totpEnabled) {
    recommendations.push('Generate backup recovery codes')
  }
  
  const level = score >= 90 ? 'excellent' : 
               score >= 70 ? 'good' : 
               score >= 50 ? 'fair' : 'poor'
  
  return { score, level, recommendations }
}

export default router