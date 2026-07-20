import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { TOTPService } from '../services/totp.js'
import { prisma } from '../db.js'

const router = Router()

/**
 * Enable 2FA - Generate secret and backup codes
 */
router.post('/enable', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { secret, backupCodes, qrCodeUrl } = await TOTPService.enableTwoFactor(req.userId!)

    res.json({
      secret,
      backupCodes,
      qrCodeUrl,
      message: 'Scan the QR code with your authenticator app and verify with a code to complete setup',
    })
  } catch (error) {
    console.error('[2fa] Failed to enable:', error)
    res.status(500).json({ error: 'Failed to enable 2FA' })
  }
})

/**
 * Verify 2FA setup
 */
const verifySetupSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
})

router.post('/verify-setup', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = verifySetupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const isValid = await TOTPService.verifyTwoFactor(req.userId!, parsed.data.code)

  if (!isValid) {
    res.status(400).json({ error: 'Invalid code' })
    return
  }

  // 2FA is now enabled (already set in enableTwoFactor)
  res.json({ verified: true, message: '2FA enabled successfully' })
})

/**
 * Disable 2FA
 */
const disableSchema = z.object({
  password: z.string().min(1),
})

router.post('/disable', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = disableSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { passwordHash: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Verify password
  const bcrypt = await import('bcryptjs')
  const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash)

  if (!isValid) {
    res.status(401).json({ error: 'Invalid password' })
    return
  }

  await TOTPService.disableTwoFactor(req.userId!)

  res.json({ disabled: true, message: '2FA disabled successfully' })
})

/**
 * Get 2FA status
 */
router.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { twoFactor: true, prefs: true },
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

  const backupCodesCount = ((prefs as { twoFactorBackupCodes?: string[] }).twoFactorBackupCodes || []).length

  res.json({
    enabled: user.twoFactor,
    backupCodesRemaining: backupCodesCount,
    enabledAt: (prefs as { twoFactorEnabledAt?: string }).twoFactorEnabledAt || null,
  })
})

/**
 * Verify 2FA code during login
 */
const verifyCodeSchema = z.object({
  code: z.string().regex(/^(\d{6}|[A-F0-9]{8})$/, 'Code must be 6 digits or 8-char backup code'),
})

router.post('/verify', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const code = parsed.data.code

  // Try TOTP first
  if (code.length === 6) {
    const isValid = await TOTPService.verifyTwoFactor(req.userId!, code)
    if (isValid) {
      res.json({ verified: true })
      return
    }
  }

  // Try backup code
  if (code.length === 8) {
    const isValid = await TOTPService.useBackupCode(req.userId!, code)
    if (isValid) {
      res.json({ verified: true, backupCodeUsed: true })
      return
    }
  }

  res.status(400).json({ error: 'Invalid code' })
})

/**
 * Regenerate backup codes
 */
router.post('/regenerate-backup-codes', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { twoFactor: true },
  })

  if (!user?.twoFactor) {
    res.status(400).json({ error: '2FA not enabled' })
    return
  }

  const backupCodes = TOTPService.generateBackupCodes()
  const hashedCodes = backupCodes.map(code => TOTPService.hashBackupCode(code))

  const userRecord = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { prefs: true },
  })

  let prefs: Record<string, unknown> = {}
  try {
    if (userRecord?.prefs) prefs = JSON.parse(userRecord.prefs)
  } catch {
    prefs = {}
  }

  prefs.twoFactorBackupCodes = hashedCodes

  await prisma.user.update({
    where: { id: req.userId! },
    data: { prefs: JSON.stringify(prefs) },
  })

  res.json({
    backupCodes,
    message: 'Save these codes in a safe place. Each code can only be used once.',
  })
})

export default router
