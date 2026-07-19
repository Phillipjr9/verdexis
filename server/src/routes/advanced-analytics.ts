import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { analyticsEngine } from '../services/analyticsEngine.js'

const router = Router()

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

export default router
