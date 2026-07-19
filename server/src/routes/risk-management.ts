import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import {
  calculatePortfolioMetrics,
  calculateAssetCorrelations,
  getRiskProfile,
  getPerformanceAttribution,
} from '../metricsService.js'
import { getPricesBatch } from '../priceService.js'

const router = Router()

// Get comprehensive risk dashboard
router.get('/dashboard', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [metrics, correlations, riskProfile, attribution] = await Promise.all([
      calculatePortfolioMetrics(req.userId!),
      calculateAssetCorrelations(req.userId!),
      getRiskProfile(req.userId!),
      getPerformanceAttribution(req.userId!),
    ])

    res.json({
      metrics,
      correlations,
      riskProfile,
      attribution,
    })
  } catch (error) {
    console.error('Risk dashboard error:', error)
    res.status(500).json({ error: 'Failed to fetch risk dashboard' })
  }
})

// Calculate Value at Risk (VaR)
router.get('/var', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const confidenceLevel = parseFloat(req.query.confidence as string) || 0.95
    const periodDays = parseInt(req.query.days as string) || 365

    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId: req.userId!,
        snapshotAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotAt: 'asc' },
    })

    if (balanceHistory.length < 2) {
      res.status(400).json({ error: 'Insufficient data for VaR calculation' })
      return
    }

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 1; i < balanceHistory.length; i++) {
      const previous = balanceHistory[i - 1]
      const current = balanceHistory[i]
      if (!previous || !current) continue

      const prevValue = previous.totalWorthUsd
      const currentValue = current.totalWorthUsd
      const dailyReturn = (currentValue - prevValue) / prevValue
      returns.push(dailyReturn)
    }

    // Sort returns
    returns.sort((a, b) => a - b)

    // Calculate VaR at confidence level
    const varIndex = Math.floor((1 - confidenceLevel) * returns.length)
    const varReturn = returns[varIndex]

    // Get current portfolio value
    const currentPortfolio = balanceHistory[balanceHistory.length - 1]?.totalWorthUsd ?? 0

    // Calculate VaR in dollars
    const varDollars = currentPortfolio * Math.abs(varReturn ?? 0)

    // Calculate CVaR (Conditional VaR / Expected Shortfall)
    const cvarReturns = returns.slice(0, varIndex + 1)
    const cvarReturn = cvarReturns.reduce((a, b) => a + b, 0) / cvarReturns.length
    const cvarDollars = currentPortfolio * Math.abs(cvarReturn)

    res.json({
      var: {
        percentage: (varReturn ?? 0) * 100,
        dollars: varDollars,
        confidenceLevel,
      },
      cvar: {
        percentage: cvarReturn * 100,
        dollars: cvarDollars,
        confidenceLevel,
      },
      currentPortfolioValue: currentPortfolio,
    })
  } catch (error) {
    console.error('VaR calculation error:', error)
    res.status(500).json({ error: 'Failed to calculate VaR' })
  }
})

// Get concentration risk
router.get('/concentration', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.userId! },
    })

    if (holdings.length === 0) {
      res.json({ concentration: {}, herfindahlIndex: 0, recommendation: 'No holdings' })
      return
    }

    const symbols = holdings.map((h) => h.symbol)
    const prices = await getPricesBatch(symbols)

    let totalValue = 0
    const concentration: Record<string, number> = {}

    holdings.forEach((holding) => {
      const livePrice = prices[holding.symbol.toUpperCase()] || holding.avgPrice
      const value = holding.amount * livePrice
      totalValue += value
      concentration[holding.symbol] = value
    })

    // Calculate percentages and Herfindahl index
    let herfindahlIndex = 0
    const concentrationPercent: Record<string, number> = {}

    for (const symbol in concentration) {
      const symbolValue = concentration[symbol] ?? 0
      const percent = totalValue > 0 ? (symbolValue / totalValue) * 100 : 0
      concentrationPercent[symbol] = percent
      herfindahlIndex += Math.pow(percent / 100, 2)
    }

    // Determine diversification level
    let recommendation = 'Well diversified'
    if (herfindahlIndex > 0.25) {
      recommendation = 'Highly concentrated - consider diversifying'
    } else if (herfindahlIndex > 0.15) {
      recommendation = 'Moderately concentrated - consider adding more assets'
    }

    res.json({
      concentration: concentrationPercent,
      herfindahlIndex,
      recommendation,
      topHolding: Object.entries(concentrationPercent).sort((a, b) => b[1] - a[1])[0],
    })
  } catch (error) {
    console.error('Concentration risk error:', error)
    res.status(500).json({ error: 'Failed to calculate concentration risk' })
  }
})

// Get liquidity risk
router.get('/liquidity', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.userId! },
    })

    if (holdings.length === 0) {
      res.json({ liquidityRisk: 'low', holdings: [] })
      return
    }

    // Simplified liquidity assessment
    // In production, would integrate with exchange APIs for real volume data
    const liquidityMap: Record<string, 'high' | 'medium' | 'low'> = {
      BTC: 'high',
      ETH: 'high',
      USDC: 'high',
      USDT: 'high',
      BNB: 'high',
      XRP: 'medium',
      ADA: 'medium',
      SOL: 'medium',
      DOGE: 'medium',
      MATIC: 'medium',
    }

    const holdingLiquidity = holdings.map((h) => ({
      symbol: h.symbol,
      amount: h.amount,
      liquidity: liquidityMap[h.symbol] || 'low',
    }))

    const lowLiquidityCount = holdingLiquidity.filter((h) => h.liquidity === 'low').length
    let overallRisk = 'low'

    if (lowLiquidityCount > holdings.length * 0.5) {
      overallRisk = 'high'
    } else if (lowLiquidityCount > 0) {
      overallRisk = 'medium'
    }

    res.json({
      liquidityRisk: overallRisk,
      holdings: holdingLiquidity,
      recommendation:
        overallRisk === 'high'
          ? 'Consider reducing exposure to low-liquidity assets'
          : 'Liquidity risk is acceptable',
    })
  } catch (error) {
    console.error('Liquidity risk error:', error)
    res.status(500).json({ error: 'Failed to calculate liquidity risk' })
  }
})

// Get correlation matrix
router.get('/correlation-matrix', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const correlations = await calculateAssetCorrelations(req.userId!)

    // Build correlation matrix
    const symbols = new Set<string>()
    correlations.forEach((c) => {
      symbols.add(c.asset1)
      symbols.add(c.asset2)
    })

    const symbolArray = Array.from(symbols).sort()
    const matrix: Record<string, Record<string, number>> = {}

    // Initialize matrix
    symbolArray.forEach((s1) => {
      if (!matrix[s1]) matrix[s1] = {}
      symbolArray.forEach((s2) => {
        if (!matrix[s1]) matrix[s1] = {}
        matrix[s1]![s2] = s1 === s2 ? 1 : 0
      })
    })

    // Fill in correlations
    correlations.forEach((c) => {
      if (!matrix[c.asset1]) matrix[c.asset1] = {}
      if (!matrix[c.asset2]) matrix[c.asset2] = {}
      matrix[c.asset1]![c.asset2] = c.correlation
      matrix[c.asset2]![c.asset1] = c.correlation
    })

    res.json({
      matrix,
      symbols: symbolArray,
      correlations,
    })
  } catch (error) {
    console.error('Correlation matrix error:', error)
    res.status(500).json({ error: 'Failed to calculate correlation matrix' })
  }
})

// Get stress test scenarios
router.get('/stress-test', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.userId! },
    })

    if (holdings.length === 0) {
      res.json({ scenarios: [] })
      return
    }

    const symbols = holdings.map((h) => h.symbol)
    const prices = await getPricesBatch(symbols)

    let currentValue = 0
    holdings.forEach((h) => {
      const price = prices[h.symbol.toUpperCase()] || h.avgPrice
      currentValue += h.amount * price
    })

    // Define stress scenarios
    const scenarios = [
      {
        name: 'Market Crash (-20%)',
        change: -0.2,
        portfolioValue: currentValue * 0.8,
        loss: currentValue * 0.2,
      },
      {
        name: 'Market Crash (-50%)',
        change: -0.5,
        portfolioValue: currentValue * 0.5,
        loss: currentValue * 0.5,
      },
      {
        name: 'Crypto Winter (-70%)',
        change: -0.7,
        portfolioValue: currentValue * 0.3,
        loss: currentValue * 0.7,
      },
      {
        name: 'Market Rally (+20%)',
        change: 0.2,
        portfolioValue: currentValue * 1.2,
        gain: currentValue * 0.2,
      },
      {
        name: 'Market Rally (+50%)',
        change: 0.5,
        portfolioValue: currentValue * 1.5,
        gain: currentValue * 0.5,
      },
    ]

    res.json({
      currentValue,
      scenarios,
    })
  } catch (error) {
    console.error('Stress test error:', error)
    res.status(500).json({ error: 'Failed to run stress test' })
  }
})

// Get risk alerts
router.get('/alerts', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [metrics, riskProfile] = await Promise.all([
      calculatePortfolioMetrics(req.userId!),
      getRiskProfile(req.userId!),
    ])

    const alerts: Array<{
      severity: 'low' | 'medium' | 'high'
      message: string
      recommendation: string
    }> = []

    // Check Sharpe ratio
    if (metrics.sharpeRatio < 0) {
      alerts.push({
        severity: 'high',
        message: 'Negative Sharpe ratio indicates poor risk-adjusted returns',
        recommendation: 'Review your portfolio allocation and consider rebalancing',
      })
    }

    // Check max drawdown
    if (metrics.maxDrawdown > 0.3) {
      alerts.push({
        severity: 'high',
        message: 'Maximum drawdown exceeds 30%',
        recommendation: 'Consider reducing portfolio volatility',
      })
    }

    // Check volatility
    if (metrics.volatility > 0.5) {
      alerts.push({
        severity: 'medium',
        message: 'Portfolio volatility is very high',
        recommendation: 'Consider diversifying into less volatile assets',
      })
    }

    // Risk profile recommendation
    if (riskProfile.riskLevel === 'high') {
      alerts.push({
        severity: 'medium',
        message: riskProfile.recommendation,
        recommendation: 'Review your risk tolerance and adjust accordingly',
      })
    }

    res.json({ alerts })
  } catch (error) {
    console.error('Risk alerts error:', error)
    res.status(500).json({ error: 'Failed to fetch risk alerts' })
  }
})

export default router
