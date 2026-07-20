import { Router } from 'express'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { AnalyticsService } from '../services/analytics.js'
import { prisma } from '../db.js'

const router = Router()

router.get('/users/metrics', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const metrics = await AnalyticsService.getUserMetrics()
    res.json(metrics)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

router.get('/revenue/metrics', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10), 365)
    const metrics = await AnalyticsService.getRevenueMetrics(days)
    res.json(metrics)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

router.get('/cohort/analysis', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const months = Math.min(parseInt(String(req.query.months ?? '6'), 10), 24)
    const cohorts = await AnalyticsService.getCohortAnalysis(months)
    res.json({ cohorts })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cohort analysis' })
  }
})

router.get('/churn/predictions', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const predictions = await AnalyticsService.predictChurn()
    res.json({ predictions })
  } catch (error) {
    res.status(500).json({ error: 'Failed to predict churn' })
  }
})

router.get('/ltv/:userId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.userId
    if (userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } })
      if (user?.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return }
    }
    const ltv = await AnalyticsService.getUserLTV(userId)
    res.json({ userId, ltv })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get LTV' })
  }
})

router.get('/dashboard/summary', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const [userMetrics, revenueMetrics, churnPredictions] = await Promise.all([
      AnalyticsService.getUserMetrics(),
      AnalyticsService.getRevenueMetrics(30),
      AnalyticsService.predictChurn(),
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
    res.status(500).json({ error: 'Failed to get dashboard summary' })
  }
})

export default router
