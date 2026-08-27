import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAdmin, requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

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
    { key: 'support_email', value: 'https://www.verdexisgroup.com/support', type: 'string', category: 'general' },
    { key: 'maintenance_mode', value: 'false', type: 'boolean', category: 'general' },
    { key: 'signup_bonus_enabled', value: 'false', type: 'boolean', category: 'general' },
    { key: 'signup_bonus_amount', value: '0', type: 'number', category: 'general' },
    { key: 'signup_bonus_note', value: '', type: 'string', category: 'general' },
  ],
  governance: [
    { key: 'requireOtpForWithdrawals', value: 'true', type: 'boolean', category: 'governance' },
    { key: 'requireKycForWithdrawals', value: 'true', type: 'boolean', category: 'governance' },
    { key: 'autoVerifySettings', value: 'true', type: 'boolean', category: 'governance' },
    { key: 'flagSuspiciousLogins', value: 'true', type: 'boolean', category: 'governance' },
  ],
}

function getSettingMeta(key: string) {
  const all = Object.values(DEFAULT_SETTINGS).flat() as Array<{ key: string; type: string; category: string }>
  const found = all.find(s => s.key === key)
  return { type: found?.type ?? 'string', category: found?.category ?? 'general' }
}

function validateSettingValue(value: string, type: string, category: string) {
  try {
    switch (type) {
      case 'number': {
        const num = parseFloat(value)
        if (isNaN(num) || !isFinite(num)) return { valid: false, error: 'Must be a valid number' }
        if (category === 'fees' && (num < 0 || num > 100)) return { valid: false, error: 'Fee must be between 0 and 100' }
        if (category === 'security' && num < 0) return { valid: false, error: 'Must be a positive number' }
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
        if (category === 'wallet' && value !== 'N/A' && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
          return { valid: false, error: 'Must be a valid Ethereum address (0x...) or N/A' }
        }
        // Allow empty for optional notes (e.g. signup_bonus_note)
        if (value.length === 0 && keyLooksRequired(category)) return { valid: false, error: 'Cannot be empty' }
        return { valid: true }
      }
      default:
        return { valid: true }
    }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' }
  }
}

function keyLooksRequired(category: string) {
  return category === 'wallet' || category === 'bank'
}

async function ensureDefaultSettings() {
  try {
    const count = await prisma.appSetting.count()
    if (count === 0) {
      const allSettings = Object.values(DEFAULT_SETTINGS).flat()
      for (const setting of allSettings) {
        await prisma.appSetting.upsert({
          where: { key: setting.key },
          create: { key: setting.key, value: setting.value },
          update: {},
        })
      }
    }
  } catch (error) {
    console.error('Failed to initialize default settings:', error)
  }
}

function buildFallbackSettings() {
  return Object.values(DEFAULT_SETTINGS).flat().map(setting => ({
    key: setting.key,
    value: setting.value,
    updatedAt: new Date(),
    updatedBy: 'system',
  }))
}

/** Admin Settings page panel APIs under /api/admin/settings/panel/* */
router.get('/panel/withdrawal-fee', async (_req: AuthedRequest, res) => {
  try {
    await ensureDefaultSettings()
    let row = await prisma.appSetting.findUnique({ where: { key: 'withdrawal_fee_percent' } })
    if (!row) {
      row = await prisma.appSetting.create({ data: { key: 'withdrawal_fee_percent', value: '11.8', updatedBy: 'system' } })
    }
    const ratePct = Number(row.value)
    res.json({ ratePct: Number.isFinite(ratePct) ? ratePct : 11.8, key: 'withdrawal_fee_percent' })
  } catch (e) {
    console.error('[settings] withdrawal-fee load', e)
    res.status(500).json({ error: 'Failed to load fee' })
  }
})

router.put('/panel/withdrawal-fee', async (req: AuthedRequest, res) => {
  try {
    const ratePct = Number(req.body?.ratePct ?? req.body?.value)
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      res.status(400).json({ error: 'ratePct must be between 0 and 100' })
      return
    }
    const adminId = String(req.userId ?? 'admin')
    const row = await prisma.appSetting.upsert({
      where: { key: 'withdrawal_fee_percent' },
      create: { key: 'withdrawal_fee_percent', value: String(ratePct), updatedBy: adminId },
      update: { value: String(ratePct), updatedBy: adminId },
    })
    res.json({ ratePct: Number(row.value), key: 'withdrawal_fee_percent' })
  } catch (e) {
    console.error('[settings] withdrawal-fee save', e)
    res.status(500).json({ error: 'Failed to save fee' })
  }
})

router.get('/panel/signup-bonus', async (_req: AuthedRequest, res) => {
  try {
    await ensureDefaultSettings()
    const keys = ['signup_bonus_enabled', 'signup_bonus_amount', 'signup_bonus_note']
    const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } })
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    res.json({
      enabled: (map['signup_bonus_enabled'] ?? 'false') === 'true',
      amountUsd: Number(map['signup_bonus_amount'] ?? '0') || 0,
      note: map['signup_bonus_note'] ?? '',
    })
  } catch (e) {
    console.error('[settings] signup-bonus load', e)
    res.status(500).json({ error: 'Failed to load signup bonus settings' })
  }
})

router.put('/panel/signup-bonus', async (req: AuthedRequest, res) => {
  try {
    const enabled = Boolean(req.body?.enabled)
    const amountUsd = Number(req.body?.amountUsd)
    const note = String(req.body?.note ?? '')
    if (!Number.isFinite(amountUsd) || amountUsd < 0 || amountUsd > 1_000_000) {
      res.status(400).json({ error: 'amountUsd must be between 0 and 1000000' })
      return
    }
    const adminId = String(req.userId ?? 'admin')
    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: 'signup_bonus_enabled' },
        create: { key: 'signup_bonus_enabled', value: enabled ? 'true' : 'false', updatedBy: adminId },
        update: { value: enabled ? 'true' : 'false', updatedBy: adminId },
      }),
      prisma.appSetting.upsert({
        where: { key: 'signup_bonus_amount' },
        create: { key: 'signup_bonus_amount', value: String(amountUsd), updatedBy: adminId },
        update: { value: String(amountUsd), updatedBy: adminId },
      }),
      prisma.appSetting.upsert({
        where: { key: 'signup_bonus_note' },
        create: { key: 'signup_bonus_note', value: note, updatedBy: adminId },
        update: { value: note, updatedBy: adminId },
      }),
    ])
    res.json({ enabled, amountUsd, note })
  } catch (e) {
    console.error('[settings] signup-bonus save', e)
    res.status(500).json({ error: 'Failed to save signup bonus settings' })
  }
})

router.get('/panel/otp-analytics', async (_req: AuthedRequest, res) => {
  try {
    const [totalUsers, otpEnabledCount] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }).catch(() => 0),
      prisma.user.count({ where: { deletedAt: null, twoFactor: true } }).catch(() => 0),
    ])
    const adoptionRate = totalUsers > 0 ? `${Math.round((otpEnabledCount / totalUsers) * 1000) / 10}%` : '0%'
    res.json({
      totalUsers,
      otpEnabledCount,
      adoptionRate,
      methods: {},
      requirements: { login: 1, transactions: 0, withdrawals: 1, twoFactor: otpEnabledCount },
      activity24h: { totalOTPs: 0, failedOTPs: 0, successRate: '100%' },
    })
  } catch (e) {
    console.error('[settings] otp-analytics', e)
    res.status(500).json({ error: 'Failed to load OTP analytics' })
  }
})

router.get('/all', async (req: AuthedRequest, res) => {
  try {
    await ensureDefaultSettings()
    let settings = [] as Array<{ key: string; value: string; updatedAt: Date; updatedBy: string | null }>
    try {
      settings = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } })
    } catch (error) {
      console.error('Failed to read app settings from DB, using defaults:', error)
      settings = buildFallbackSettings()
    }

    if (settings.length === 0) {
      settings = buildFallbackSettings()
    }

    const logs: any[] = []
    res.json({
      settings: settings.map(setting => {
        const meta = getSettingMeta(setting.key)
        return {
          id: setting.key,
          key: setting.key,
          value: setting.value,
          type: meta.type,
          category: meta.category,
          lastModified: setting.updatedAt,
          modifiedBy: setting.updatedBy ?? 'system',
          verified: false,
          verificationStatus: 'unknown',
          verificationTimestamp: null,
        }
      }),
      logs,
    })
  } catch (error) {
    console.error('Failed to load settings:', error)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.get('/logs', async (req: AuthedRequest, res) => {
  try {
    res.json({ logs: [] })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load logs' })
  }
})

router.get('/summary', async (req: AuthedRequest, res) => {
  try {
    const settings = await prisma.appSetting.findMany()
    const byCategory = {} as Record<string, { total: number; verified: number; failed: number }>
    let verified = 0
    let failed = 0
    for (const setting of settings) {
      const meta = getSettingMeta(setting.key)
      const validation = validateSettingValue(setting.value, meta.type, meta.category)
      const isValid = validation.valid
      if (!byCategory[meta.category]) byCategory[meta.category] = { total: 0, verified: 0, failed: 0 }
      byCategory[meta.category].total++
      if (isValid) byCategory[meta.category].verified++
      else byCategory[meta.category].failed++
      if (isValid) verified++
      else failed++
    }
    res.json({ total: settings.length, verified, failed, verificationRate: settings.length ? Math.round((verified / settings.length) * 100) : 0, byCategory })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load summary' })
  }
})

router.get('/:key', async (req: AuthedRequest, res) => {
  try {
    await ensureDefaultSettings()
    let setting = await prisma.appSetting.findUnique({ where: { key: req.params.key } })
    if (!setting) {
      const meta = getSettingMeta(req.params.key)
      const defaults = Object.values(DEFAULT_SETTINGS).flat() as Array<{ key: string; value: string }>
      const def = defaults.find(d => d.key === req.params.key)
      if (!def) return res.status(404).json({ error: 'Setting not found' })
      setting = await prisma.appSetting.upsert({
        where: { key: req.params.key },
        create: { key: req.params.key, value: def.value, updatedBy: 'system' },
        update: {},
      })
    }
    const meta = getSettingMeta(setting.key)
    res.json({ setting: {
      id: setting.key,
      key: setting.key,
      value: setting.value,
      type: meta.type,
      category: meta.category,
      lastModified: setting.updatedAt,
      modifiedBy: setting.updatedBy ?? 'system',
      verified: false,
      verificationStatus: 'unknown',
      verificationTimestamp: null,
    } })
  } catch (error) {
    console.error('Failed to load setting:', error)
    res.status(500).json({ error: 'Failed to load setting' })
  }
})

router.post('/:key/save', async (req: AuthedRequest, res) => {
  const { value } = req.body
  const adminEmail = (req as any).user?.email ?? req.userId ?? 'unknown'
  const key = String(req.params.key || '').trim()
  if (!key) {
    res.status(400).json({ error: 'Setting key required' })
    return
  }

  try {
    await ensureDefaultSettings()
    const meta = getSettingMeta(key)
    const validation = validateSettingValue(String(value ?? ''), meta.type, meta.category)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error || 'Invalid value' })
    }

    const updated = await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: String(value), updatedBy: String(adminEmail) },
      update: { value: String(value), updatedBy: String(adminEmail) },
    })
    res.json({ success: true, setting: {
      id: updated.key,
      key: updated.key,
      value: updated.value,
      type: getSettingMeta(updated.key).type,
      category: getSettingMeta(updated.key).category,
      verified: false,
      verificationStatus: 'unknown',
    } })
  } catch (error) {
    console.error('Failed to save setting:', error)
    res.status(500).json({ error: 'Failed to save setting' })
  }
})

router.post('/:id/verify', async (req: AuthedRequest, res) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: req.params.id } })
    if (!setting) return res.status(404).json({ error: 'Setting not found' })
    const meta = getSettingMeta(setting.key)
    const validation = validateSettingValue(setting.value, meta.type, meta.category)
    res.json({ verified: validation.valid, verificationStatus: validation.valid ? 'verified' : 'failed', error: validation.error })
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' })
  }
})

router.post('/verify-all', async (req: AuthedRequest, res) => {
  try {
    const settings = await prisma.appSetting.findMany()
    let verified = 0
    let failed = 0
    for (const setting of settings) {
      const meta = getSettingMeta(setting.key)
      const validation = validateSettingValue(setting.value, meta.type, meta.category)
      if (validation.valid) verified++
      else failed++
    }
    res.json({ verified, failed, total: settings.length, verificationRate: settings.length ? Math.round((verified / settings.length) * 100) : 0 })
  } catch (error) {
    res.status(500).json({ error: 'Batch verification failed' })
  }
})

export default router
