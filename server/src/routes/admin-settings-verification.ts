import { Router, Request, Response } from 'express'
import { prisma } from '../db.js'
import { verifyAdminAuth } from '../middleware/securityMiddleware'

const router = Router()

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
  ],
}

function getSettingMeta(key: string) {
  const all = Object.values(DEFAULT_SETTINGS).flat() as Array<{ key: string; type: string; category: string }>
  const found = all.find(s => s.key === key)
  return { type: found?.type ?? 'string', category: found?.category ?? 'general' }
}

function validateSettingValue(value: string, type: string) {
  switch (type) {
    case 'number':
      return !isNaN(Number(value)) && isFinite(Number(value))
    case 'boolean':
      return value === 'true' || value === 'false'
    case 'json':
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    default:
      return typeof value === 'string'
  }
}

function verifySetting(setting: { key: string; value: string }) {
  const meta = getSettingMeta(setting.key)
  const value = setting.value
  if (meta.category === 'fees') {
    const numberValue = Number(value)
    return !isNaN(numberValue) && numberValue >= 0 && numberValue <= 100
  }
  if (meta.category === 'wallet') {
    return /^0x[a-fA-F0-9]{40}$/.test(value) || value === 'N/A'
  }
  if (meta.category === 'bank') {
    return value.length > 0 && value !== 'N/A'
  }
  if (meta.category === 'security') {
    return value === 'true' || value === 'false'
  }
  return value.length > 0
}

function formatSetting(setting: { key: string; value: string; updatedAt: Date; updatedBy: string | null }) {
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
}

router.get('/settings/all', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } })
    res.json({ settings: settings.map(formatSetting), logs: [] })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.post('/settings/:id/verify', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: req.params.id } })
    if (!setting) return res.status(404).json({ error: 'Setting not found' })
    const verified = verifySetting(setting)
    res.json({
      setting: formatSetting(setting),
      verified,
      verificationStatus: verified ? 'verified' : 'failed',
    })
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' })
  }
})

router.post('/settings/verify-all', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.appSetting.findMany()
    let verified = 0
    let failed = 0
    for (const setting of settings) {
      if (verifySetting(setting)) verified++
      else failed++
    }
    res.json({ verified, failed, total: settings.length })
  } catch (error) {
    res.status(500).json({ error: 'Batch verification failed' })
  }
})

router.get('/settings/logs', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    res.json({ logs: [] })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load logs' })
  }
})

export default router
