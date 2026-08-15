import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()
router.use(requireAuth)

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

router.get('/notifications', async (req: AuthedRequest, res) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: req.userId! },
    })
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: req.userId! },
      })
    }
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notification preferences' })
  }
})

const notificationPrefsSchema = z.object({
  emailFrequency: z.enum(['never', 'daily', 'weekly', 'monthly']).optional(),
  emailPriceAlerts: z.boolean().optional(),
  emailTradeConfirmations: z.boolean().optional(),
  emailSecurityAlerts: z.boolean().optional(),
  emailSystemUpdates: z.boolean().optional(),
  emailMarketingNews: z.boolean().optional(),
  smsPriceAlerts: z.boolean().optional(),
  smsSecurityAlerts: z.boolean().optional(),
  pushNotificationsEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  quietHoursEnabled: z.boolean().optional(),
})

router.patch('/notifications', async (req: AuthedRequest, res) => {
  const parsed = notificationPrefsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    })
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification preferences' })
  }
})

// ============================================================================
// PRIVACY SETTINGS
// ============================================================================

router.get('/privacy', async (req: AuthedRequest, res) => {
  try {
    let settings = await prisma.privacySetting.findUnique({
      where: { userId: req.userId! },
    })
    if (!settings) {
      settings = await prisma.privacySetting.create({
        data: { userId: req.userId! },
      })
    }
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load privacy settings' })
  }
})

const privacySettingsSchema = z.object({
  profileVisibility: z.enum(['public', 'private', 'friends_only']).optional(),
  showPortfolioValue: z.boolean().optional(),
  showTradeHistory: z.boolean().optional(),
  allowMessagesFromStrangers: z.boolean().optional(),
  dataCollectionOptOut: z.boolean().optional(),
  analyticsOptOut: z.boolean().optional(),
  thirdPartyDataSharing: z.boolean().optional(),
})

router.patch('/privacy', async (req: AuthedRequest, res) => {
  const parsed = privacySettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const settings = await prisma.privacySetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    })
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update privacy settings' })
  }
})

// ============================================================================
// WALLET PREFERENCES
// ============================================================================

router.get('/wallet', async (req: AuthedRequest, res) => {
  try {
    let prefs = await prisma.walletPreference.findUnique({
      where: { userId: req.userId! },
    })
    if (!prefs) {
      prefs = await prisma.walletPreference.create({
        data: { userId: req.userId! },
      })
    }
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load wallet preferences' })
  }
})

const walletPrefsSchema = z.object({
  defaultWithdrawalAddress: z.string().optional(),
  defaultNetwork: z.string().optional(),
  autoCompoundStaking: z.boolean().optional(),
  stakingFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  gasOptimization: z.enum(['low', 'standard', 'fast']).optional(),
  showSmallBalances: z.boolean().optional(),
  minimumBalanceThreshold: z.number().min(0).optional(),
})

router.patch('/wallet', async (req: AuthedRequest, res) => {
  const parsed = walletPrefsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const prefs = await prisma.walletPreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    })
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update wallet preferences' })
  }
})

// ============================================================================
// ACCESSIBILITY SETTINGS
// ============================================================================

router.get('/accessibility', async (req: AuthedRequest, res) => {
  try {
    let settings = await prisma.accessibilitySetting.findUnique({
      where: { userId: req.userId! },
    })
    if (!settings) {
      settings = await prisma.accessibilitySetting.create({
        data: { userId: req.userId! },
      })
    }
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load accessibility settings' })
  }
})

const accessibilitySchema = z.object({
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge']).optional(),
  highContrast: z.boolean().optional(),
  screenReaderOptimized: z.boolean().optional(),
  keyboardNavigationEnabled: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  colorBlindMode: z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia']).optional(),
})

router.patch('/accessibility', async (req: AuthedRequest, res) => {
  const parsed = accessibilitySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const settings = await prisma.accessibilitySetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    })
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update accessibility settings' })
  }
})

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

router.get('/sessions', async (req: AuthedRequest, res) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: req.userId!, isActive: true },
      orderBy: { lastActivityAt: 'desc' },
    })
    res.json(sessions)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sessions' })
  }
})

router.post('/sessions/revoke/:id', async (req: AuthedRequest, res) => {
  try {
    const session = await prisma.userSession.findUnique({
      where: { id: req.params.id },
    })
    if (!session || session.userId !== req.userId!) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    await prisma.userSession.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' })
  }
})

router.post('/sessions/revoke-all', async (req: AuthedRequest, res) => {
  try {
    await prisma.userSession.updateMany({
      where: { userId: req.userId!, isActive: true },
      data: { isActive: false },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke sessions' })
  }
})

// ============================================================================
// LOGIN HISTORY
// ============================================================================

router.get('/login-history', async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const history = await prisma.loginHistory.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    res.json(history)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load login history' })
  }
})

// ============================================================================
// IP RESTRICTIONS
// ============================================================================

router.get('/ip-restrictions', async (req: AuthedRequest, res) => {
  try {
    const restrictions = await prisma.ipRestriction.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    })
    res.json(restrictions)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load IP restrictions' })
  }
})

const ipRestrictionSchema = z.object({
  ipAddress: z.string().ip(),
  type: z.enum(['whitelist', 'blacklist']),
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

router.post('/ip-restrictions', async (req: AuthedRequest, res) => {
  const parsed = ipRestrictionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const restriction = await prisma.ipRestriction.create({
      data: {
        userId: req.userId!,
        ipAddress: parsed.data.ipAddress,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    })
    res.status(201).json(restriction)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create IP restriction' })
  }
})

router.delete('/ip-restrictions/:id', async (req: AuthedRequest, res) => {
  try {
    const restriction = await prisma.ipRestriction.findUnique({
      where: { id: req.params.id },
    })
    if (!restriction || restriction.userId !== req.userId!) {
      res.status(404).json({ error: 'Restriction not found' })
      return
    }
    await prisma.ipRestriction.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete IP restriction' })
  }
})

// ============================================================================
// ACTIVITY LOG
// ============================================================================

router.get('/activity-log', async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const category = req.query.category as string | undefined
    const logs = await prisma.activityLog.findMany({
      where: {
        userId: req.userId!,
        ...(category && { category }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load activity log' })
  }
})

// ============================================================================
// RISK TOLERANCE
// ============================================================================

router.get('/risk-tolerance', async (req: AuthedRequest, res) => {
  try {
    let tolerance = await prisma.riskTolerance.findUnique({
      where: { userId: req.userId! },
    })
    if (!tolerance) {
      tolerance = await prisma.riskTolerance.create({
        data: { userId: req.userId! },
      })
    }
    res.json(tolerance)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load risk tolerance' })
  }
})

const riskToleranceSchema = z.object({
  level: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  maxDrawdown: z.number().min(0).max(100).optional(),
  maxSingleTradePercent: z.number().min(0).max(100).optional(),
  maxLeverageMultiplier: z.number().min(1).max(10).optional(),
})

router.patch('/risk-tolerance', async (req: AuthedRequest, res) => {
  const parsed = riskToleranceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const tolerance = await prisma.riskTolerance.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    })
    res.json(tolerance)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update risk tolerance' })
  }
})

// ============================================================================
// LINKED ACCOUNTS
// ============================================================================

router.get('/linked-accounts', async (req: AuthedRequest, res) => {
  try {
    const accounts = await prisma.linkedAccount.findMany({
      where: { userId: req.userId! },
    })
    res.json(accounts)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load linked accounts' })
  }
})

router.delete('/linked-accounts/:id', async (req: AuthedRequest, res) => {
  try {
    const account = await prisma.linkedAccount.findUnique({
      where: { id: req.params.id },
    })
    if (!account || account.userId !== req.userId!) {
      res.status(404).json({ error: 'Account not found' })
      return
    }
    await prisma.linkedAccount.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink account' })
  }
})

// ============================================================================
// RECOVERY OPTIONS
// ============================================================================

router.get('/recovery-options', async (req: AuthedRequest, res) => {
  try {
    const options = await prisma.accountRecoveryOption.findMany({
      where: { userId: req.userId! },
    })
    res.json(options)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recovery options' })
  }
})

const recoveryOptionSchema = z.object({
  type: z.enum(['email', 'phone', 'recovery_code']),
  value: z.string(),
})

router.post('/recovery-options', async (req: AuthedRequest, res) => {
  const parsed = recoveryOptionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const option = await prisma.accountRecoveryOption.create({
      data: {
        userId: req.userId!,
        type: parsed.data.type,
        value: parsed.data.value,
      },
    })
    res.status(201).json(option)
  } catch (err) {
    res.status(500).json({ error: 'Failed to add recovery option' })
  }
})

router.delete('/recovery-options/:id', async (req: AuthedRequest, res) => {
  try {
    const option = await prisma.accountRecoveryOption.findUnique({
      where: { id: req.params.id },
    })
    if (!option || option.userId !== req.userId!) {
      res.status(404).json({ error: 'Recovery option not found' })
      return
    }
    await prisma.accountRecoveryOption.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete recovery option' })
  }
})

// ============================================================================
// 2FA RECOVERY CODES
// ============================================================================

router.get('/2fa-recovery-codes', async (req: AuthedRequest, res) => {
  try {
    const codes = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: req.userId! },
      select: {
        id: true,
        used: true,
        usedAt: true,
        createdAt: true,
      },
    })
    res.json(codes)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recovery codes' })
  }
})

router.post('/2fa-recovery-codes/generate', async (req: AuthedRequest, res) => {
  try {
    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    )
    await prisma.twoFactorRecoveryCode.deleteMany({
      where: { userId: req.userId!, used: false },
    })
    await prisma.twoFactorRecoveryCode.createMany({
      data: codes.map(code => ({
        userId: req.userId!,
        code,
      })),
    })
    res.json({ codes })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate recovery codes' })
  }
})

// ============================================================================
// DATA EXPORT
// ============================================================================

router.post('/export-data', async (req: AuthedRequest, res) => {
  const schema = z.object({
    format: z.enum(['json', 'csv']).default('json'),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const request = await prisma.dataExportRequest.create({
      data: {
        userId: req.userId!,
        format: parsed.data.format,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    res.status(201).json(request)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create export request' })
  }
})

router.get('/export-data', async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.dataExportRequest.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load export requests' })
  }
})

// ============================================================================
// COOKIE PREFERENCES
// ============================================================================

router.get('/cookie-preferences', async (req: AuthedRequest, res) => {
  try {
    let prefs = await prisma.cookiePreference.findUnique({
      where: { userId: req.userId! },
    })
    if (!prefs) {
      prefs = await prisma.cookiePreference.create({
        data: { userId: req.userId! },
      })
    }
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load cookie preferences' })
  }
})

const cookiePrefsSchema = z.object({
  essential: z.boolean().optional(),
  analytics: z.boolean().optional(),
  marketing: z.boolean().optional(),
  preferences: z.boolean().optional(),
})

router.patch('/cookie-preferences', async (req: AuthedRequest, res) => {
  const parsed = cookiePrefsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const prefs = await prisma.cookiePreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    })
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cookie preferences' })
  }
})

export default router
