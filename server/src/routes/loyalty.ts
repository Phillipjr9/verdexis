import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { ReferralLoyaltyService } from '../services/referralLoyalty.js'

const router = Router()

/**
 * GET /api/loyalty/me
 * Returns current user's loyalty status, tier, points, 30d volume, and perks
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const status = await ReferralLoyaltyService.getUserLoyaltyStatus(req.userId!)
    res.json({
      tier: status.tier,
      points: status.points,
      volume30d: status.totalSpent || 0,
      totalSpent: status.totalSpent || 0,
      referralsCount: status.referralsCount || 0,
      tierDetails: status.tierDetails,
    })
  } catch (err) {
    console.error('[loyalty] /me error:', err)
    res.status(500).json({ error: 'Failed to load loyalty status' })
  }
})

/**
 * GET /api/loyalty/leaderboard
 * Returns top loyalty users
 */
router.get('/leaderboard', requireAuth, async (_req: AuthedRequest, res) => {
  try {
    const leaderboard = await ReferralLoyaltyService.getLoyaltyLeaderboard(20)
    res.json({ leaderboard })
  } catch (err) {
    console.error('[loyalty] /leaderboard error:', err)
    res.status(500).json({ error: 'Failed to load loyalty leaderboard' })
  }
})

const redeemSchema = z.object({
  points: z.number().int().positive(),
})

/**
 * POST /api/loyalty/redeem
 * Redeem points
 */
router.post('/redeem', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = redeemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid points amount required' })
    return
  }
  try {
    const result = await ReferralLoyaltyService.redeemLoyaltyPoints(req.userId!, parsed.data.points)
    if (!result.success) {
      res.status(400).json({ error: result.message })
      return
    }
    res.json({ ok: true, message: result.message })
  } catch (err) {
    console.error('[loyalty] /redeem error:', err)
    res.status(500).json({ error: 'Failed to redeem loyalty points' })
  }
})

export default router
