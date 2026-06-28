import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { trustedDeviceService } from '../services/trustedDevice.js'
import { riskAssessmentService } from '../services/riskAssessment.js'
import { fraudDetectionService } from '../services/fraudDetection.js'
import { sessionManagementService } from '../services/sessionManagement.js'
import { totpService } from '../services/totp.js'
import { smsService } from '../services/sms.js'
import { webhookService } from '../services/webhook.js'
import { complianceService } from '../services/compliance.js'
import { awsOTPService } from '../services/awsOTP.js'
import { prisma } from '../db.js'

const router = Router()

const securityLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(securityLimiter)
router.use(requireAuth)
router.use(requireAdmin)

// TRUSTED DEVICES MANAGEMENT

router.get('/trusted-devices', async (req: AuthedRequest, res) => {
  const { userId } = req.query
  
  if (userId) {
    const devices = await trustedDeviceService.getUserDevices(userId as string)
    res.json({ devices })
  } else {
    // Get all devices with pagination
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    
    const devices = await prisma.trustedDevice.findMany({
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { email: true, name: true } }
      },
      orderBy: { lastSeenAt: 'desc' }
    })
    
    const total = await prisma.trustedDevice.count()
    
    res.json({ 
      devices: devices.map(d => ({
        ...d,
        fingerprint: JSON.parse(d.fingerprint),
        location: d.location ? JSON.parse(d.location) : null
      })),
      pagination: { page, limit, total }
    })
  }
})

router.delete('/trusted-devices/:deviceId', async (req: AuthedRequest, res) => {
  const { deviceId } = req.params
  
  const device = await prisma.trustedDevice.findUnique({
    where: { id: deviceId }
  })
  
  if (!device) {
    res.status(404).json({ error: 'Device not found' })
    return
  }
  
  await trustedDeviceService.revokeDevice(device.userId, deviceId)
  res.json({ success: true })
})

router.post('/trusted-devices/cleanup', async (req: AuthedRequest, res) => {
  const deleted = await trustedDeviceService.cleanupExpiredDevices()
  res.json({ deleted })
})

// RISK ASSESSMENT & FRAUD DETECTION

router.get('/risk-assessments', async (req: AuthedRequest, res) => {
  const { userId, riskLevel, days } = req.query
  const since = days ? new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  
  const assessments = await prisma.riskAssessment.findMany({
    where: {
      ...(userId ? { userId: userId as string } : {}),
      ...(riskLevel ? { riskLevel: riskLevel as string } : {}),
      createdAt: { gte: since }
    },
    include: {
      user: { select: { email: true, name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  })
  
  res.json({ assessments: assessments.map(a => ({
    ...a,
    factors: JSON.parse(a.factors),
    context: a.context ? JSON.parse(a.context) : null
  })) })
})

router.get('/fraud-rules', async (req: AuthedRequest, res) => {
  const rules = await prisma.fraudRule.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }]
  })
  
  res.json({ 
    rules: rules.map(rule => ({
      ...rule,
      conditions: JSON.parse(rule.conditions)
    }))
  })
})

const fraudRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  conditions: z.object({
    maxAmount: z.number().optional(),
    minAmount: z.number().optional(),
    maxTransactionsPerHour: z.number().optional(),
    maxDailyAmount: z.number().optional(),
    blockedCountries: z.array(z.string()).optional(),
    blockedHours: z.array(z.number()).optional(),
    requireTrustedDevice: z.boolean().optional(),
    suspiciousPatterns: z.array(z.string()).optional(),
    unusualBehavior: z.boolean().optional()
  }),
  action: z.enum(['block', 'flag', 'review', 'notify']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  active: z.boolean().default(true)
})

router.post('/fraud-rules', async (req: AuthedRequest, res) => {
  const parsed = fraudRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  
  const rule = await prisma.fraudRule.create({
    data: {
      ...parsed.data,
      conditions: JSON.stringify(parsed.data.conditions),
      createdBy: req.userId!
    }
  })
  
  res.json({ rule: { ...rule, conditions: parsed.data.conditions } })
})

router.put('/fraud-rules/:ruleId', async (req: AuthedRequest, res) => {
  const { ruleId } = req.params
  const parsed = fraudRuleSchema.safeParse(req.body)
  
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  
  const rule = await prisma.fraudRule.update({
    where: { id: ruleId },
    data: {
      ...parsed.data,
      conditions: JSON.stringify(parsed.data.conditions)
    }
  })
  
  res.json({ rule: { ...rule, conditions: parsed.data.conditions } })
})

router.delete('/fraud-rules/:ruleId', async (req: AuthedRequest, res) => {
  await prisma.fraudRule.delete({
    where: { id: req.params.ruleId }
  })
  
  res.json({ success: true })
})

router.post('/fraud-rules/initialize-defaults', async (req: AuthedRequest, res) => {
  await fraudDetectionService.initializeDefaultRules()
  res.json({ success: true, message: 'Default fraud rules initialized' })
})

// SESSION MANAGEMENT

router.get('/sessions', async (req: AuthedRequest, res) => {
  const { userId } = req.query
  
  if (userId) {
    const sessions = await sessionManagementService.getUserSessions(userId as string)
    res.json({ sessions })
  } else {
    const stats = await sessionManagementService.getSessionStats()
    res.json({ stats })
  }
})

router.delete('/sessions/:sessionId', async (req: AuthedRequest, res) => {
  await sessionManagementService.revokeSession(req.params.sessionId)
  res.json({ success: true })
})

router.delete('/sessions/user/:userId', async (req: AuthedRequest, res) => {
  const count = await sessionManagementService.revokeAllUserSessions(req.params.userId)
  res.json({ success: true, revokedSessions: count })
})

router.post('/sessions/cleanup', async (req: AuthedRequest, res) => {
  const deleted = await sessionManagementService.cleanupExpiredSessions()
  res.json({ deleted })
})

// TOTP MANAGEMENT

router.get('/totp/status/:userId', async (req: AuthedRequest, res) => {
  const status = await totpService.getTOTPStatus(req.params.userId)
  res.json({ status })
})

router.post('/totp/disable/:userId', async (req: AuthedRequest, res) => {
  await totpService.disableTOTP(req.params.userId)
  res.json({ success: true, message: 'TOTP disabled for user' })
})

router.post('/totp/regenerate-backup/:userId', async (req: AuthedRequest, res) => {
  try {
    const backupCodes = await totpService.regenerateBackupCodes(req.params.userId)
    res.json({ success: true, backupCodes })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to regenerate codes' })
  }
})

// SMS MANAGEMENT

router.get('/sms/status', async (req: AuthedRequest, res) => {
  res.json({
    available: smsService.isAvailable(),
    provider: smsService.getProviderName()
  })
})

router.post('/sms/test', async (req: AuthedRequest, res) => {
  const { phoneNumber, message } = req.body
  
  if (!phoneNumber || !message) {
    res.status(400).json({ error: 'Phone number and message required' })
    return
  }
  
  const result = await smsService.sendSMS(phoneNumber, message)
  res.json(result)
})

// SECURITY EVENTS

router.get('/security-events', async (req: AuthedRequest, res) => {
  const { userId, eventType, severity, resolved, days } = req.query
  const since = days ? new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  
  const events = await prisma.securityEvent.findMany({
    where: {
      ...(userId ? { userId: userId as string } : {}),
      ...(eventType ? { eventType: eventType as string } : {}),
      ...(severity ? { severity: severity as string } : {}),
      ...(resolved !== undefined ? { resolved: resolved === 'true' } : {}),
      createdAt: { gte: since }
    },
    include: {
      user: { select: { email: true, name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  })
  
  res.json({ 
    events: events.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
      location: event.location ? JSON.parse(event.location) : null
    }))
  })
})

router.post('/security-events/:eventId/resolve', async (req: AuthedRequest, res) => {
  const { eventId } = req.params
  const { resolution } = req.body
  
  const event = await prisma.securityEvent.update({
    where: { id: eventId },
    data: {
      resolved: true,
      resolvedBy: req.userId!,
      resolvedAt: new Date()
    }
  })
  
  res.json({ success: true, event })
})

// COMPLIANCE REPORTING

router.get('/compliance/reports', async (req: AuthedRequest, res) => {
  const reports = await prisma.complianceReport.findMany({
    orderBy: { generatedAt: 'desc' },
    take: 50
  })
  
  res.json({ reports })
})

router.post('/compliance/reports/soc2', async (req: AuthedRequest, res) => {
  const { startDate, endDate } = req.body
  
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Start date and end date required' })
    return
  }
  
  try {
    const report = await complianceService.generateSOC2Report(
      new Date(startDate),
      new Date(endDate),
      req.userId!
    )
    
    res.json({ success: true, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

router.post('/compliance/reports/pci-dss', async (req: AuthedRequest, res) => {
  const { startDate, endDate } = req.body
  
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Start date and end date required' })
    return
  }
  
  try {
    const report = await complianceService.generatePCIDSSReport(
      new Date(startDate),
      new Date(endDate),
      req.userId!
    )
    
    res.json({ success: true, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

router.post('/compliance/reports/gdpr', async (req: AuthedRequest, res) => {
  const { startDate, endDate } = req.body
  
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Start date and end date required' })
    return
  }
  
  try {
    const report = await complianceService.generateGDPRReport(
      new Date(startDate),
      new Date(endDate),
      req.userId!
    )
    
    res.json({ success: true, report })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

router.get('/compliance/audit-trail/export', async (req: AuthedRequest, res) => {
  const { startDate, endDate, userId } = req.query
  
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Start date and end date required' })
    return
  }
  
  try {
    const csv = await complianceService.exportAuditTrailCSV(
      new Date(startDate as string),
      new Date(endDate as string),
      userId as string | undefined
    )
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.csv"')
    res.send(csv)
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit trail' })
  }
})

// WEBHOOKS

router.get('/webhooks/status', async (req: AuthedRequest, res) => {
  const stats = await webhookService.getWebhookStats()
  res.json({ stats })
})

router.post('/webhooks/test', async (req: AuthedRequest, res) => {
  const { event, data } = req.body
  
  const success = await webhookService.sendSecurityWebhook({
    eventType: event || 'test',
    severity: 'low',
    userId: req.userId!,
    description: 'Test webhook from admin panel',
    ...data
  })
  
  res.json({ success })
})

// AWS OTP MANAGEMENT

router.get('/aws/status', async (req: AuthedRequest, res) => {
  const status = awsOTPService.getStatus()
  res.json({ aws: status })
})

router.post('/aws/test', async (req: AuthedRequest, res) => {
  const connectionTest = await awsOTPService.testConnection()
  res.json({ connectionTest })
})

router.post('/aws/send-test-otp', async (req: AuthedRequest, res) => {
  const { phoneNumber, code, method } = req.body
  
  if (!phoneNumber || !code) {
    res.status(400).json({ error: 'Phone number and code required' })
    return
  }
  
  try {
    const result = await awsOTPService.sendOTP(phoneNumber, code, 'admin_test', req.userId!)
    res.json({ result })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Test failed' 
    })
  }
})

// SECURITY DASHBOARD

router.get('/dashboard', async (req: AuthedRequest, res) => {
  const days = parseInt(req.query.days as string) || 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  
  const [
    securityEvents,
    riskAssessments,
    activeSessions,
    trustedDevices,
    otpSuccess,
    fraudAttempts
  ] = await Promise.all([
    prisma.securityEvent.count({
      where: { createdAt: { gte: since } }
    }),
    prisma.riskAssessment.count({
      where: { 
        riskLevel: { in: ['high', 'critical'] },
        createdAt: { gte: since } 
      }
    }),
    prisma.userSession.count({
      where: { expiresAt: { gte: new Date() } }
    }),
    prisma.trustedDevice.count({
      where: { isTrusted: true, expiresAt: { gte: new Date() } }
    }),
    prisma.otp.aggregate({
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { attempts: true }
    }),
    prisma.riskAssessment.count({
      where: {
        riskScore: { gte: 80 },
        createdAt: { gte: since }
      }
    })
  ])
  
  const otpSuccessRate = otpSuccess._count.id > 0 ? 
    (((otpSuccess._count.id - (otpSuccess._sum.attempts || 0)) / otpSuccess._count.id) * 100).toFixed(1) + '%' : 
    '0%'
  
  res.json({
    dashboard: {
      securityEvents,
      highRiskAssessments: riskAssessments,
      activeSessions,
      trustedDevices,
      otpSuccessRate,
      fraudAttempts,
      systemHealth: 'Good',
      alertLevel: fraudAttempts > 10 ? 'High' : riskAssessments > 5 ? 'Medium' : 'Low'
    }
  })
})

export default router