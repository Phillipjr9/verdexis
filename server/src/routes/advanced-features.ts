import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { analyticsEngine } from '../services/analyticsEngine.js'
import { taxOptimizationService } from '../services/taxOptimizationService.js'
import { complianceEngine } from '../services/complianceEngine.js'
import { pushNotificationService } from '../services/pushNotificationService.js'
import { prisma } from '../db.js'

const router = Router()

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

/**
 * GET /api/analytics/performance
 * Get comprehensive performance metrics
 */
router.get('/performance', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 365
    const metrics = await analyticsEngine.calculatePerformanceMetrics(req.userId!, days)
    res.json({ metrics, period: days })
  } catch (error) {
    console.error('[analytics] performance error:', error)
    res.status(500).json({ error: 'Failed to calculate performance metrics' })
  }
})

/**
 * GET /api/analytics/risk
 * Get risk metrics
 */
router.get('/risk', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 365
    const risk = await analyticsEngine.calculateRiskMetrics(req.userId!, days)
    res.json({ risk, period: days })
  } catch (error) {
    console.error('[analytics] risk error:', error)
    res.status(500).json({ error: 'Failed to calculate risk metrics' })
  }
})

/**
 * GET /api/analytics/attribution
 * Get portfolio attribution analysis
 */
router.get('/attribution', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const attribution = await analyticsEngine.analyzeAttribution(req.userId!)
    res.json({ attribution })
  } catch (error) {
    console.error('[analytics] attribution error:', error)
    res.status(500).json({ error: 'Failed to analyze attribution' })
  }
})

/**
 * GET /api/analytics/recommendations
 * Get portfolio recommendations
 */
router.get('/recommendations', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const recommendations = await analyticsEngine.generateRecommendations(req.userId!)
    res.json({ recommendations })
  } catch (error) {
    console.error('[analytics] recommendations error:', error)
    res.status(500).json({ error: 'Failed to generate recommendations' })
  }
})

/**
 * GET /api/analytics/full
 * Get complete analytics dashboard
 */
router.get('/full', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 365
    const [performance, risk, attribution, recommendations] = await Promise.all([
      analyticsEngine.calculatePerformanceMetrics(req.userId!, days),
      analyticsEngine.calculateRiskMetrics(req.userId!, days),
      analyticsEngine.analyzeAttribution(req.userId!),
      analyticsEngine.generateRecommendations(req.userId!)
    ])

    res.json({
      performance,
      risk,
      attribution,
      recommendations,
      period: days
    })
  } catch (error) {
    console.error('[analytics] full error:', error)
    res.status(500).json({ error: 'Failed to generate analytics' })
  }
})

// ============================================================================
// TAX OPTIMIZATION ROUTES
// ============================================================================

/**
 * GET /api/tax/opportunities
 * Find tax-loss harvesting opportunities
 */
router.get('/opportunities', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const opportunities = await taxOptimizationService.findTaxLossHarvestingOpportunities(req.userId!)
    res.json({ opportunities })
  } catch (error) {
    console.error('[tax] opportunities error:', error)
    res.status(500).json({ error: 'Failed to find opportunities' })
  }
})

/**
 * POST /api/tax/harvest
 * Execute tax-loss harvest
 */
router.post('/harvest', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { symbol, quantity } = req.body
    if (!symbol || !quantity) {
      res.status(400).json({ error: 'symbol and quantity required' })
      return
    }

    const result = await taxOptimizationService.executeTaxLossHarvest(req.userId!, symbol, quantity)
    res.json(result)
  } catch (error) {
    console.error('[tax] harvest error:', error)
    res.status(500).json({ error: 'Failed to execute harvest' })
  }
})

/**
 * GET /api/tax/report/:year
 * Generate tax report for year
 */
router.get('/report/:year', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const year = parseInt(req.params.year)
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      res.status(400).json({ error: 'Invalid year' })
      return
    }

    const report = await taxOptimizationService.generateTaxReport(req.userId!, year)
    res.json({ report })
  } catch (error) {
    console.error('[tax] report error:', error)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

/**
 * GET /api/tax/form8949/:year
 * Export Form 8949 as CSV
 */
router.get('/form8949/:year', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const year = parseInt(req.params.year)
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      res.status(400).json({ error: 'Invalid year' })
      return
    }

    const csv = await taxOptimizationService.generateForm8949CSV(req.userId!, year)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="form8949-${year}.csv"`)
    res.send(csv)
  } catch (error) {
    console.error('[tax] form8949 error:', error)
    res.status(500).json({ error: 'Failed to generate Form 8949' })
  }
})

/**
 * GET /api/tax/recommendations
 * Get tax recommendations
 */
router.get('/recommendations', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const recommendations = await taxOptimizationService.getTaxRecommendations(req.userId!)
    res.json({ recommendations })
  } catch (error) {
    console.error('[tax] recommendations error:', error)
    res.status(500).json({ error: 'Failed to get recommendations' })
  }
})

// ============================================================================
// COMPLIANCE ROUTES
// ============================================================================

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

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const prefs = await pushNotificationService.getUserPreferences(req.userId!)
    res.json({ preferences: prefs })
  } catch (error) {
    console.error('[notifications] preferences error:', error)
    res.status(500).json({ error: 'Failed to get preferences' })
  }
})

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const prefs = req.body
    await pushNotificationService.updateUserPreferences(req.userId!, prefs)
    res.json({ ok: true })
  } catch (error) {
    console.error('[notifications] update preferences error:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

/**
 * POST /api/notifications/mark-read/:id
 * Mark notification as read
 */
router.post('/mark-read/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await pushNotificationService.markAsRead(req.params.id)
    res.json({ ok: true })
  } catch (error) {
    console.error('[notifications] mark-read error:', error)
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/mark-all-read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await pushNotificationService.markAllAsRead(req.userId!)
    res.json({ ok: true })
  } catch (error) {
    console.error('[notifications] mark-all-read error:', error)
    res.status(500).json({ error: 'Failed to mark all as read' })
  }
})

export default router
