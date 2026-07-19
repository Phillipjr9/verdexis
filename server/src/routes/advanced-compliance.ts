import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { complianceEngine } from '../services/complianceEngine.js'
import { prisma } from '../db.js'

const router = Router()

/**
 * GET /api/compliance/risk-profile
 * Get user risk profile
 */
router.get('/risk-profile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await complianceEngine.getUserRiskProfile(req.userId!)
    res.json({ profile })
  } catch (error) {
    console.error('[compliance] risk-profile error:', error)
    res.status(500).json({ error: 'Failed to get risk profile' })
  }
})

/**
 * POST /api/compliance/screen-transaction
 * Screen transaction for compliance
 */
router.post('/screen-transaction', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { kind, amount, currency } = req.body
    if (!kind || !amount || !currency) {
      res.status(400).json({ error: 'kind, amount, and currency required' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const result = await complianceEngine.monitorTransaction(
      req.userId!,
      { kind, amount, currency } as any,
      user
    )

    res.json({ result })
  } catch (error) {
    console.error('[compliance] screen-transaction error:', error)
    res.status(500).json({ error: 'Failed to screen transaction' })
  }
})

export default router
