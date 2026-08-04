import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

// Default settings configuration
const DEFAULT_SETTINGS = {
  fees: [
    { key: 'withdrawal_fee_percent', value: '11.8', type: 'number', category: 'fees' },
    { key: 'deposit_fee_percent', value: '0', type: 'number', category: 'fees' },
    { key: 'trading_fee_percent', value: '0.5', type: 'number', category: 'fees' },
    { key: 'transfer_fee_percent', value: '0', type: 'number', category: 'fees' },
  ],
  wallet: [
    { key: 'admin_wallet_address', value: 'N/A', type: 'string', category: 'wallet' },
    { key: 'treasury_wallet_address', value: 'N/A', type: 'string', category: 'wallet' },
    { key: 'custody_wallet_address', value: 'N/A', type: 'string', category: 'wallet' },
  ],
  bank: [
    { key: 'bank_account_name', value: 'N/A', type: 'string', category: 'bank' },
    { key: 'bank_account_number', value: 'N/A', type: 'string', category: 'bank' },
    { key: 'bank_routing_number', value: 'N/A', type: 'string', category: 'bank' },
    { key: 'bank_swift_code', value: 'N/A', type: 'string', category: 'bank' },
  ],
  security: [
    { key: 'two_factor_required', value: 'false', type: 'boolean', category: 'security' },
    { key: 'ip_whitelist_enabled', value: 'false', type: 'boolean', category: 'security' },
    { key: 'session_timeout_minutes', value: '30', type: 'number', category: 'security' },
    { key: 'max_login_attempts', value: '5', type: 'number', category: 'security' },
  ],
  general: [
    { key: 'platform_name', value: 'Verdexis', type: 'string', category: 'general' },
    { key: 'support_email', value: 'support@verdexis.com', type: 'string', category: 'general' },
    { key: 'maintenance_mode', value: 'false', type: 'boolean', category: 'general' },
    { key: 'signup_bonus_enabled', value: 'false', type: 'boolean', category: 'general' },
    { key: 'signup_bonus_amount', value: '0', type: 'number', category: 'general' },
  ],
}

// Validation schemas
const settingSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'json']),
  category: z.enum(['fees', 'wallet', 'bank', 'security', 'general']),
})

// Validation rules by category
function validateSettingValue(value: string, type: string, category: string): { valid: boolean; error?: string } {
  try {
    switch (type) {
      case 'number': {
        const num = parseFloat(value)
        if (isNaN(num) || !isFinite(num)) return { valid: false, error: 'Must be a valid number' }
        
        // Category-specific range checks
        if (category === 'fees') {
          if (num < 0 || num > 100) return { valid: false, error: 'Fee must be between 0 and 100' }
        } else if (category === 'security') {
          if (num < 0) return { valid: false, error: 'Must be a positive number' }
        }
        return { valid: true }
      }
      case 'boolean': {
        if (value !== 'true' && value !== 'false') return { valid: false, error: 'Must be true or false' }
        return { valid: true }
      }
      case 'json': {
        JSON.parse(value)
        return { valid: true }
      }
      case 'string': {
        if (category === 'wallet') {
          // Ethereum address format or N/A
          if (value !== 'N/A' && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
            return { valid: false, error: 'Must be a valid Ethereum address (0x...) or N/A' }
          }
        }
        if (value.length === 0) return { valid: false, error: 'Cannot be empty' }
        return { valid: true }
      }
      default:
        return { valid: true }
    }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Validation failed' }
  }
}

// Initialize default settings if they don't exist
async function ensureDefaultSettings() {
  try {
    const count = await prisma.appSetting.count()
    if (count === 0) {
      const allSettings = Object.values(DEFAULT_SETTINGS).flat()
      for (const setting of allSettings) {
        await prisma.appSetting.upsert({
          where: { key: setting.key },
          create: {
            key: setting.key,
            value: setting.value,
            type: setting.type,
            category: setting.category,
            verified: true,
            verificationStatus: 'verified',
          },
          update: {},
        })
      }
    }
  } catch (e) {
    console.error('Failed to initialize default settings:', e)
  }
}

// Get all settings
router.get('/settings/all', async (req: AuthedRequest, res) => {
  try {
    await ensureDefaultSettings()
    
    const settings = await prisma.appSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    const logs = await prisma.appSettingLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    res.json({
      settings: settings.map(s => ({
        id: s.id,
        key: s.key,
        value: s.value,
        type: s.type,
        category: s.category,
        lastModified: s.updatedAt,
        modifiedBy: s.updatedBy || 'system',
        verified: s.verified,
        verificationStatus: s.verificationStatus,
        verificationTimestamp: s.verificationTimestamp,
      })),
      logs: logs.map(l => ({
        id: l.id,
        settingKey: l.settingKey,
        oldValue: l.oldValue,
        newValue: l.newValue,
        status: l.status,
        timestamp: l.createdAt,
        adminId: l.adminId,
        adminEmail: l.adminEmail,
        errorMessage: l.errorMessage,
      })),
    })
  } catch (error) {
    console.error('Failed to load settings:', error)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

// Get specific setting
router.get('/settings/:key', async (req: AuthedRequest, res) => {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: req.params.key },
    })

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    res.json({
      setting: {
        id: setting.id,
        key: setting.key,
        value: setting.value,
        type: setting.type,
        category: setting.category,
        lastModified: setting.updatedAt,
        modifiedBy: setting.updatedBy || 'system',
        verified: setting.verified,
        verificationStatus: setting.verificationStatus,
        verificationTimestamp: setting.verificationTimestamp,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load setting' })
  }
})

// Save setting
router.post('/settings/:key/save', async (req: AuthedRequest, res) => {
  const { value } = req.body
  const adminId = req.userId!
  const adminEmail = (req as any).user?.email || 'unknown'

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: req.params.key },
    })

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    // Validate value
    const validation = validateSettingValue(value, setting.type, setting.category)
    if (!validation.valid) {
      await prisma.appSettingLog.create({
        data: {
          settingKey: req.params.key,
          oldValue: setting.value,
          newValue: value,
          status: 'failed',
          adminId,
          adminEmail,
          errorMessage: validation.error,
        },
      })
      return res.status(400).json({ error: validation.error || 'Invalid value' })
    }

    // Update setting
    const updated = await prisma.appSetting.update({
      where: { key: req.params.key },
      data: {
        value,
        verified: false,
        verificationStatus: 'pending',
        updatedBy: adminEmail,
        updatedAt: new Date(),
      },
    })

    // Log the change
    await prisma.appSettingLog.create({
      data: {
        settingKey: req.params.key,
        oldValue: setting.value,
        newValue: value,
        status: 'success',
        adminId,
        adminEmail,
      },
    })

    res.json({
      success: true,
      setting: {
        id: updated.id,
        key: updated.key,
        value: updated.value,
        type: updated.type,
        category: updated.category,
        verified: updated.verified,
        verificationStatus: updated.verificationStatus,
      },
    })
  } catch (error) {
    console.error('Failed to save setting:', error)
    await prisma.appSettingLog.create({
      data: {
        settingKey: req.params.key,
        oldValue: '',
        newValue: value,
        status: 'failed',
        adminId,
        adminEmail,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    }).catch(() => {})
    res.status(500).json({ error: 'Failed to save setting' })
  }
})

// Verify single setting
router.post('/settings/:id/verify', async (req: AuthedRequest, res) => {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { id: req.params.id },
    })

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    // Validate the current value
    const validation = validateSettingValue(setting.value, setting.type, setting.category)

    const updated = await prisma.appSetting.update({
      where: { id: req.params.id },
      data: {
        verified: validation.valid,
        verificationStatus: validation.valid ? 'verified' : 'failed',
        verificationTimestamp: new Date(),
      },
    })

    res.json({
      verified: validation.valid,
      setting: {
        id: updated.id,
        key: updated.key,
        value: updated.value,
        verified: updated.verified,
        verificationStatus: updated.verificationStatus,
      },
      error: validation.error,
    })
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' })
  }
})

// Verify all settings
router.post('/settings/verify-all', async (req: AuthedRequest, res) => {
  try {
    const settings = await prisma.appSetting.findMany()
    let verified = 0
    let failed = 0

    for (const setting of settings) {
      const validation = validateSettingValue(setting.value, setting.type, setting.category)
      
      await prisma.appSetting.update({
        where: { id: setting.id },
        data: {
          verified: validation.valid,
          verificationStatus: validation.valid ? 'verified' : 'failed',
          verificationTimestamp: new Date(),
        },
      })

      if (validation.valid) verified++
      else failed++
    }

    res.json({
      verified,
      failed,
      total: settings.length,
      verificationRate: settings.length > 0 ? Math.round((verified / settings.length) * 100) : 0,
    })
  } catch (error) {
    res.status(500).json({ error: 'Batch verification failed' })
  }
})

// Get settings logs
router.get('/settings/logs', async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '500'), 10) || 500, 5000)
    const filter = req.query.filter as string | undefined

    let where: any = {}
    if (filter === 'success') where.status = 'success'
    else if (filter === 'failed') where.status = 'failed'

    const logs = await prisma.appSettingLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    res.json({
      logs: logs.map(l => ({
        id: l.id,
        settingKey: l.settingKey,
        oldValue: l.oldValue,
        newValue: l.newValue,
        status: l.status,
        timestamp: l.createdAt,
        adminId: l.adminId,
        adminEmail: l.adminEmail,
        errorMessage: l.errorMessage,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load logs' })
  }
})

// Get settings summary
router.get('/settings/summary', async (req: AuthedRequest, res) => {
  try {
    const settings = await prisma.appSetting.findMany()
    const total = settings.length
    const verified = settings.filter(s => s.verified).length
    const failed = settings.filter(s => s.verificationStatus === 'failed').length
    const pending = settings.filter(s => s.verificationStatus === 'pending').length

    const byCategory = settings.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = { total: 0, verified: 0, failed: 0 }
      acc[s.category].total++
      if (s.verified) acc[s.category].verified++
      if (s.verificationStatus === 'failed') acc[s.category].failed++
      return acc
    }, {} as Record<string, { total: number; verified: number; failed: number }>)

    res.json({
      total,
      verified,
      failed,
      pending,
      verificationRate: total > 0 ? Math.round((verified / total) * 100) : 0,
      byCategory,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load summary' })
  }
})

export default router
