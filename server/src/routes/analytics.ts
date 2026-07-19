import { Router } from 'express'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { analyticsService } from '../services/analytics.js'

const router = Router()

/**
 * Get user engagement metrics (admin only)
 */
router.get('/users/metrics', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const metrics = await analyticsService.getUserMetrics()
    res.json(metrics)
  } catch (error) {
    console.error('[analytics] Failed to get user metrics:', error)
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

/**
 * Get revenue metrics (admin only)
 */
router.get('/revenue/metrics', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10), 365)
    const metrics = await analyticsService.getRevenueMetrics(days)
    res.json(metrics)
  } catch (error) {
    console.error('[analytics] Failed to get revenue metrics:', error)
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

/**
 * Get cohort analysis (admin only)
 */
router.get('/cohort/analysis', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const months = Math.min(parseInt(String(req.query.months ?? '6'), 10), 24)
    const cohorts = await analyticsService.getCohortAnalysis(months)
    res.json({ cohorts })
  } catch (error) {
    console.error('[analytics] Failed to get cohort analysis:', error)
    res.status(500).json({ error: 'Failed to get cohort analysis' })
  }
})

/**
 * Get churn predictions (admin only)
 */
router.get('/churn/predictions', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const predictions = await analyticsService.predictChurn()
    res.json({ predictions })
  } catch (error) {
    console.error('[analytics] Failed to predict churn:', error)
    res.status(500).json({ error: 'Failed to predict churn' })
  }
})

/**
 * Get user lifetime value
 */
router.get('/ltv/:userId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.userId

    // Users can only see their own LTV, admins can see anyone's
    if (userId !== req.userId) {
      const user = await require('../db.js').prisma.user.findUnique({
        where: { id: req.userId! },
        select: { role: true },
      })

      if (user?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
    }

    const ltv = await analyticsService.getUserLTV(userId)
    res.json({ userId, ltv })
  } catch (error) {
    console.error('[analytics] Failed to get LTV:', error)
    res.status(500).json({ error: 'Failed to get LTV' })
  }
})

/**
 * Get dashboard summary (admin only)
 */
router.get('/dashboard/summary', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const [userMetrics, revenueMetrics, churnPredictions] = await Promise.all([
      analyticsService.getUserMetrics(),
      analyticsService.getRevenueMetrics(30),
      analyticsService.predictChurn(),
    ])

    const highRiskUsers = churnPredictions.filter(p => p.churnRisk > 70).slice(0, 10)

    res.json({
      users: userMetrics,
      revenue: revenueMetrics,
      highRiskUsers,
      summary: {
        totalUsers: userMetrics.totalUsers,
        activeUsers30d: userMetrics.activeUsers30d,
        churnRate: userMetrics.churnRate.toFixed(2) + '%',
        totalRevenue: revenueMetrics.totalFees,
        avgDepositAmount: revenueMetrics.avgDepositAmount.toFixed(2),
      },
    })
  } catch (error) {
    console.error('[analytics] Failed to get dashboard summary:', error)
    res.status(500).json({ error: 'Failed to get dashboard summary' })
  }
})

export default router
