import { Router, Request, Response } from 'express'
import { db } from '../db'
import { verifyAdminAuth } from '../middleware/securityMiddleware'

const router = Router()

// Types
interface AdminSetting {
  id: string
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  category: 'fees' | 'wallet' | 'bank' | 'security' | 'general'
  lastModified: string
  modifiedBy: string
  verified: boolean
  verificationStatus: 'pending' | 'verified' | 'failed'
  verificationTimestamp?: string
}

interface SettingsSaveLog {
  id: string
  settingKey: string
  oldValue: string
  newValue: string
  status: 'success' | 'failed'
  timestamp: string
  adminId: string
  adminEmail: string
  errorMessage?: string
}

// Get all settings
router.get('/settings/all', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const settings = await db.query(
      `SELECT * FROM admin_settings ORDER BY category, key`
    )
    const logs = await db.query(
      `SELECT * FROM admin_settings_logs ORDER BY timestamp DESC LIMIT 100`
    )
    res.json({ settings: settings.rows, logs: logs.rows })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

// Get specific setting
router.get('/settings/:key', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM admin_settings WHERE key = $1`,
      [req.params.key]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' })
    }
    res.json({ setting: result.rows[0] })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load setting' })
  }
})

// Save setting
router.post('/settings/:key/save', verifyAdminAuth, async (req: Request, res: Response) => {
  const { value } = req.body
  const adminId = (req as any).user.id
  const adminEmail = (req as any).user.email

  try {
    // Get old value
    const oldResult = await db.query(
      `SELECT value FROM admin_settings WHERE key = $1`,
      [req.params.key]
    )
    const oldValue = oldResult.rows[0]?.value || 'N/A'

    // Validate value based on type
    const settingResult = await db.query(
      `SELECT type FROM admin_settings WHERE key = $1`,
      [req.params.key]
    )
    const settingType = settingResult.rows[0]?.type

    if (!validateSettingValue(value, settingType)) {
      await logSettingChange(req.params.key, oldValue, value, 'failed', adminId, adminEmail, 'Invalid value type')
      return res.status(400).json({ error: 'Invalid value for this setting type' })
    }

    // Update setting
    await db.query(
      `UPDATE admin_settings 
       SET value = $1, lastModified = NOW(), modifiedBy = $2, verified = false, verificationStatus = 'pending'
       WHERE key = $3`,
      [value, adminEmail, req.params.key]
    )

    // Log the change
    await logSettingChange(req.params.key, oldValue, value, 'success', adminId, adminEmail)

    res.json({ success: true, message: 'Setting saved successfully' })
  } catch (error) {
    await logSettingChange(req.params.key, '', value, 'failed', adminId, adminEmail, String(error))
    res.status(500).json({ error: 'Failed to save setting' })
  }
})

// Verify single setting
router.post('/settings/:id/verify', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM admin_settings WHERE id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    const setting = result.rows[0]

    // Perform verification based on category
    const verified = await verifySetting(setting)

    if (verified) {
      await db.query(
        `UPDATE admin_settings 
         SET verified = true, verificationStatus = 'verified', verificationTimestamp = NOW()
         WHERE id = $1`,
        [req.params.id]
      )
      res.json({ verified: true, message: 'Setting verified successfully' })
    } else {
      await db.query(
        `UPDATE admin_settings 
         SET verified = false, verificationStatus = 'failed', verificationTimestamp = NOW()
         WHERE id = $1`,
        [req.params.id]
      )
      res.json({ verified: false, error: 'Verification failed' })
    }
  } catch (error) {
    res.status(500).json({ error: 'Verification error' })
  }
})

// Verify all settings
router.post('/settings/verify-all', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const settings = await db.query(`SELECT * FROM admin_settings`)
    let verified = 0
    let failed = 0

    for (const setting of settings.rows) {
      const isValid = await verifySetting(setting)
      if (isValid) {
        await db.query(
          `UPDATE admin_settings 
           SET verified = true, verificationStatus = 'verified', verificationTimestamp = NOW()
           WHERE id = $1`,
          [setting.id]
        )
        verified++
      } else {
        await db.query(
          `UPDATE admin_settings 
           SET verified = false, verificationStatus = 'failed', verificationTimestamp = NOW()
           WHERE id = $1`,
          [setting.id]
        )
        failed++
      }
    }

    res.json({ verified, failed, total: settings.rows.length })
  } catch (error) {
    res.status(500).json({ error: 'Batch verification failed' })
  }
})

// Get save logs
router.get('/settings/logs', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM admin_settings_logs ORDER BY timestamp DESC LIMIT 500`
    )
    res.json({ logs: result.rows })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load logs' })
  }
})

// Helper functions
function validateSettingValue(value: any, type: string): boolean {
  switch (type) {
    case 'number':
      return !isNaN(Number(value)) && isFinite(Number(value))
    case 'boolean':
      return typeof value === 'boolean' || value === 'true' || value === 'false'
    case 'json':
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    case 'string':
    default:
      return typeof value === 'string'
  }
}

async function verifySetting(setting: any): Promise<boolean> {
  try {
    switch (setting.category) {
      case 'fees':
        // Verify fee is between 0 and 100
        const feeValue = parseFloat(setting.value)
        return !isNaN(feeValue) && feeValue >= 0 && feeValue <= 100

      case 'wallet':
        // Verify wallet address format
        return /^0x[a-fA-F0-9]{40}$/.test(setting.value) || setting.value === 'N/A'

      case 'bank':
        // Verify bank account details
        return setting.value.length > 0 && setting.value !== 'N/A'

      case 'security':
        // Verify security settings
        return setting.value === 'true' || setting.value === 'false' || setting.value === 'enabled' || setting.value === 'disabled'

      case 'general':
        // General validation
        return setting.value.length > 0

      default:
        return true
    }
  } catch (error) {
    return false
  }
}

async function logSettingChange(
  key: string,
  oldValue: string,
  newValue: string,
  status: 'success' | 'failed',
  adminId: string,
  adminEmail: string,
  errorMessage?: string
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO admin_settings_logs (settingKey, oldValue, newValue, status, adminId, adminEmail, errorMessage, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [key, oldValue, newValue, status, adminId, adminEmail, errorMessage || null]
    )
  } catch (error) {
    console.error('Failed to log setting change:', error)
  }
}

export default router
