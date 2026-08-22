import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import {
  getReferralSummary,
  getUserReferrals,
  creditReferralBonus,
  activateReferralOnDeposit,
  readReferralSettings,
  validateReferralCode,
  normalizeReferralCode,
  isValidReferralCodeFormat,
} from '../referrals.js'

const router = Router()

const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many validation requests. Please wait a moment.' },
})

/**
 * GET /api/referrals/validate?code=VERDX-XXXXXX
 * Public — format + existence check for signup UI (no auth).
 * Does not expose email or user id.
 */
router.get('/validate', validateLimiter, async (req, res) => {
  try {
    const raw = String(req.query.code || req.query.ref || '').trim()
    const result = await validateReferralCode(raw)
    const messages: Record<string, string> = {
      empty: 'Enter a referral code',
      invalid_format: 'Invalid code format. Use something like VERDX-ABC123',
      not_found: 'This referral code was not found',
      referrer_suspended: 'This referral code is not available',
      ok: 'Valid referral code',
    }
    res.json({
      valid: result.valid,
      code: result.code || null,
      reason: result.reason,
      message: messages[result.reason] || result.reason,
      referrerName: result.valid ? result.referrerName ?? null : null,
      formatOk: raw ? isValidReferralCodeFormat(raw) : false,
      normalized: normalizeReferralCode(raw) || null,
    })
  } catch (e) {
    console.error('[referrals] validate', e)
    res.status(500).json({ error: 'Validation failed', valid: false })
  }
})

/**
 * GET /api/referrals/me
 * Get current user's referral summary (code, earnings, counts)
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const summary = await getReferralSummary(userId)
    res.json(summary)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch referral summary' })
  }
})

/**
 * GET /api/referrals/list
 * Get all referrals for the current user with details
 */
router.get('/list', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const referrals = await getUserReferrals(userId)
    res.json({
      referrals,
      count: referrals.length,
    })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch referrals' })
  }
})

/**
 * POST /api/referrals/confirm-deposit
 */
router.post('/confirm-deposit', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const { amount } = req.body as { amount?: number }
  const settings = await readReferralSettings()
  if (!settings.enabled) {
    res.status(400).json({ error: 'Referral program is currently disabled' })
    return
  }
  const minDeposit = settings.minDepositUsd
  if (!amount || amount < minDeposit) {
    res.status(400).json({ error: `Deposit amount must be at least $${minDeposit}` })
    return
  }

  try {
    const result = await activateReferralOnDeposit(userId, amount)
    if (!result.activated) {
      res.status(400).json({ error: result.reason || 'Could not activate referral', result })
      return
    }
    res.json({ success: true, message: 'Referral activated and bonuses created', result })
  } catch (e) {
    res.status(500).json({ error: 'Failed to activate referral' })
  }
})

/**
 * GET /api/referrals/bonuses
 */
router.get('/bonuses', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const bonuses = await prisma.referralBonus.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const stats = {
      pending: bonuses
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + b.amount, 0),
      credited: bonuses
        .filter((b) => b.status === 'credited')
        .reduce((sum, b) => sum + b.amount, 0),
    }

    res.json({ bonuses, stats })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bonuses' })
  }
})

/**
 * POST /api/referrals/claim-bonus
 */
router.post('/claim-bonus', requireAuth, async (req: AuthedRequest, res) => {
  const { bonusId, paymentMethod } = req.body as {
    bonusId?: string
    paymentMethod?: 'trading_credit' | 'cash_deposit'
  }

  if (!bonusId) {
    res.status(400).json({ error: 'bonusId required' })
    return
  }

  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const bonus = await prisma.referralBonus.findUnique({ where: { id: bonusId } })
  if (!bonus || bonus.userId !== userId) {
    res.status(403).json({ error: 'Bonus not found or access denied' })
    return
  }

  if (bonus.status !== 'pending') {
    res.status(400).json({ error: 'Bonus already claimed or cancelled' })
    return
  }

  try {
    const result = await creditReferralBonus(bonusId, paymentMethod || 'trading_credit')
    res.json({ success: true, result })
  } catch (e) {
    res.status(500).json({ error: 'Failed to claim bonus' })
  }
})

export default router
