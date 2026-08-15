import { prisma } from './db.js'
import { getPricesBatch } from './priceService.js'

interface PortfolioMetrics {
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  volatility: number
  beta: number
  alpha: number
  informationRatio: number
  treynorRatio: number
  calmarRatio: number
}

interface AssetCorrelation {
  asset1: string
  asset2: string
  correlation: number
}

const RISK_FREE_RATE = 0.02 // 2% annual risk-free rate

export async function calculateSharpeRatio(
  userId: string,
  periodDays: number = 365
): Promise<number> {
  try {
    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId,
        snapshotAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotAt: 'asc' },
    })

    if (balanceHistory.length < 2) return 0

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 1; i < balanceHistory.length; i++) {
      const prevValue = balanceHistory[i - 1].totalWorthUsd
      const currentValue = balanceHistory[i].totalWorthUsd
      const dailyReturn = (currentValue - prevValue) / prevValue
      returns.push(dailyReturn)
    }

    // Calculate average return and standard deviation
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)

    // Annualize metrics
    const annualizedReturn = avgReturn * 252 // 252 trading days
    const annualizedStdDev = stdDev * Math.sqrt(252)

    // Calculate Sharpe Ratio
    const sharpeRatio = (annualizedReturn - RISK_FREE_RATE) / annualizedStdDev

    return isFinite(sharpeRatio) ? sharpeRatio : 0
  } catch (error) {
    console.error('[metrics-service] Error calculating Sharpe ratio:', error)
    return 0
  }
}

export async function calculateSortinoRatio(
  userId: string,
  periodDays: number = 365
): Promise<number> {
  try {
    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId,
        snapshotAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotAt: 'asc' },
    })

    if (balanceHistory.length < 2) return 0

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 1; i < balanceHistory.length; i++) {
      const prevValue = balanceHistory[i - 1].totalWorthUsd
      const currentValue = balanceHistory[i].totalWorthUsd
      const dailyReturn = (currentValue - prevValue) / prevValue
      returns.push(dailyReturn)
    }

    // Calculate average return
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length

    // Calculate downside deviation (only negative returns)
    const downReturns = returns.filter((r) => r < 0)
    const downVariance =
      downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length
    const downStdDev = Math.sqrt(downVariance)

    // Annualize metrics
    const annualizedReturn = avgReturn * 252
    const annualizedDownStdDev = downStdDev * Math.sqrt(252)

    // Calculate Sortino Ratio
    const sortinoRatio = (annualizedReturn - RISK_FREE_RATE) / annualizedDownStdDev

    return isFinite(sortinoRatio) ? sortinoRatio : 0
  } catch (error) {
    console.error('[metrics-service] Error calculating Sortino ratio:', error)
    return 0
  }
}

export async function calculateMaxDrawdown(userId: string, periodDays: number = 365): Promise<number> {
  try {
    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId,
        snapshotAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotAt: 'asc' },
    })

    if (balanceHistory.length < 2) return 0

    let maxDrawdown = 0
    let peak = balanceHistory[0].totalWorthUsd

    for (const snapshot of balanceHistory) {
      if (snapshot.totalWorthUsd > peak) {
        peak = snapshot.totalWorthUsd
      }

      const drawdown = (peak - snapshot.totalWorthUsd) / peak
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    return maxDrawdown
  } catch (error) {
    console.error('[metrics-service] Error calculating max drawdown:', error)
    return 0
  }
}

export async function calculateVolatility(userId: string, periodDays: number = 365): Promise<number> {
  try {
    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId,
        snapshotAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotAt: 'asc' },
    })

    if (balanceHistory.length < 2) return 0

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 1; i < balanceHistory.length; i++) {
      const prevValue = balanceHistory[i - 1].totalWorthUsd
      const currentValue = balanceHistory[i].totalWorthUsd
      const dailyReturn = (currentValue - prevValue) / prevValue
      returns.push(dailyReturn)
    }

    // Calculate standard deviation
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)

    // Annualize volatility
    const annualizedVolatility = stdDev * Math.sqrt(252)

    return isFinite(annualizedVolatility) ? annualizedVolatility : 0
  } catch (error) {
    console.error('[metrics-service] Error calculating volatility:', error)
    return 0
  }
}

export async function calculatePortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
  try {
    const [sharpeRatio, sortinoRatio, maxDrawdown, volatility] = await Promise.all([
      calculateSharpeRatio(userId),
      calculateSortinoRatio(userId),
      calculateMaxDrawdown(userId),
      calculateVolatility(userId),
    ])

    return {
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      volatility,
      beta: 1.0, // Placeholder - would need market data
      alpha: 0, // Placeholder - would need benchmark data
      informationRatio: 0, // Placeholder
      treynorRatio: 0, // Placeholder
      calmarRatio: volatility > 0 ? (0.1 / maxDrawdown) : 0, // Simplified
    }
  } catch (error) {
    console.error('[metrics-service] Error calculating portfolio metrics:', error)
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      beta: 0,
      alpha: 0,
      informationRatio: 0,
      treynorRatio: 0,
      calmarRatio: 0,
    }
  }
}

export async function calculateAssetCorrelations(userId: string): Promise<AssetCorrelation[]> {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId },
    })

    if (holdings.length < 2) return []

    const symbols = holdings.map((h) => h.symbol)
    const correlations: AssetCorrelation[] = []

    // Get price history for each asset
    const priceHistories: Record<string, number[]> = {}

    for (const symbol of symbols) {
      const trades = await prisma.trade.findMany({
        where: { userId, symbol },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })

      if (trades.length > 1) {
        const prices = trades.map((t) => t.price)
        priceHistories[symbol] = prices
      }
    }

    // Calculate correlations between pairs
    const symbolList = Object.keys(priceHistories)
    for (let i = 0; i < symbolList.length; i++) {
      for (let j = i + 1; j < symbolList.length; j++) {
        const symbol1 = symbolList[i]!
        const symbol2 = symbolList[j]!

        const prices1 = priceHistories[symbol1]
        const prices2 = priceHistories[symbol2]

        if (prices1.length > 1 && prices2.length > 1) {
          const minLength = Math.min(prices1.length, prices2.length)
          const p1 = prices1.slice(-minLength)
          const p2 = prices2.slice(-minLength)

          const correlation = calculatePearsonCorrelation(p1, p2)
          correlations.push({
            asset1: symbol1,
            asset2: symbol2,
            correlation,
          })
        }
      }
    }

    return correlations
  } catch (error) {
    console.error('[metrics-service] Error calculating correlations:', error)
    return []
  }
}

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const meanX = x.reduce((a, b) => a + b, 0) / x.length
  const meanY = y.reduce((a, b) => a + b, 0) / y.length

  let numerator = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  const denominator = Math.sqrt(sumX2 * sumY2)
  if (denominator === 0) return 0

  return numerator / denominator
}

export async function getRiskProfile(userId: string): Promise<{
  riskLevel: 'low' | 'medium' | 'high'
  volatility: number
  maxDrawdown: number
  sharpeRatio: number
  recommendation: string
}> {
  try {
    const metrics = await calculatePortfolioMetrics(userId)

    let riskLevel: 'low' | 'medium' | 'high' = 'medium'
    let recommendation = 'Your portfolio has moderate risk.'

    if (metrics.volatility < 0.15) {
      riskLevel = 'low'
      recommendation = 'Your portfolio has low volatility. Consider diversifying for growth.'
    } else if (metrics.volatility > 0.4) {
      riskLevel = 'high'
      recommendation = 'Your portfolio has high volatility. Consider rebalancing to reduce risk.'
    }

    return {
      riskLevel,
      volatility: metrics.volatility,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      recommendation,
    }
  } catch (error) {
    console.error('[metrics-service] Error getting risk profile:', error)
    return {
      riskLevel: 'medium',
      volatility: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      recommendation: 'Unable to calculate risk profile.',
    }
  }
}

export async function getPerformanceAttribution(
  userId: string,
  periodDays: number = 30
): Promise<Record<string, { contribution: number; percentage: number }>> {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId },
    })

    if (holdings.length === 0) return {}

    const symbols = holdings.map((h) => h.symbol)
    const prices = (await getPricesBatch(symbols)) ?? {}

    const attribution: Record<string, { contribution: number; percentage: number }> = {}
    let totalContribution = 0

    for (const holding of holdings) {
      const currentPrice = prices[holding.symbol.toUpperCase()] || holding.avgPrice
      const gainLoss = (currentPrice - holding.avgPrice) * holding.amount
      const contribution = gainLoss

      attribution[holding.symbol] = {
        contribution,
        percentage: 0,
      }

      totalContribution += contribution
    }

    // Calculate percentages
    if (totalContribution !== 0) {
      for (const symbol in attribution) {
        attribution[symbol].percentage = (attribution[symbol].contribution / totalContribution) * 100
      }
    }

    return attribution
  } catch (error) {
    console.error('[metrics-service] Error calculating performance attribution:', error)
    return {}
  }
}
