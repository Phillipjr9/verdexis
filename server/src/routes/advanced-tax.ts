import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { taxOptimizationService } from '../services/taxOptimizationService.js'

const router = Router()

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

export default router
