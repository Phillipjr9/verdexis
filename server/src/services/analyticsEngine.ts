import { prisma } from '../db.js'

export interface PerformanceMetrics {
  totalReturn: number
  totalReturnPercent: number
  annualizedReturn: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  calmarRatio: number
  winRate: number
  profitFactor: number
  averageWin: number
  averageLoss: number
  riskRewardRatio: number
}

export interface RiskMetrics {
  volatility: number
  beta: number
  correlation: Record<string, number>
  valueAtRisk95: number
  conditionalValueAtRisk95: number
  expectedShortfall: number
}

export interface PortfolioAnalysis {
  performance: PerformanceMetrics
  risk: RiskMetrics
  attribution: AttributionAnalysis
  recommendations: string[]
}

export interface AttributionAnalysis {
  topContributors: Array<{ symbol: string; contribution: number; percent: number }>
  topDetractors: Array<{ symbol: string; contribution: number; percent: number }>
  sectorAllocation: Record<string, number>
  geographicAllocation: Record<string, number>
}

/**
 * Advanced Analytics Engine
 * Calculates performance metrics, risk analysis, and portfolio attribution
 */
export class AnalyticsEngine {
  /**
   * Calculate comprehensive performance metrics
   */
  async calculatePerformanceMetrics(userId: string, days: number = 365): Promise<PerformanceMetrics> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get balance history
    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId,
        snapshotAt: { gte: startDate }
      },
      orderBy: { snapshotAt: 'asc' }
    })

    if (balanceHistory.length < 2) {
      return this.getDefaultMetrics()
    }

    const values = balanceHistory.map(b => b.totalWorthUsd)
    const startValue = values[0] ?? 0
    const endValue = values[values.length - 1] ?? 0

    // Total return
    const totalReturn = endValue - startValue
    const totalReturnPercent = startValue > 0 ? (totalReturn / startValue) * 100 : 0

    // Annualized return
    const yearsElapsed = days / 365
    const annualizedReturn = yearsElapsed > 0 ? Math.pow(endValue / startValue, 1 / yearsElapsed) - 1 : 0

    // Calculate daily returns for volatility
    const dailyReturns: number[] = []
    for (let i = 1; i < values.length; i++) {
      const ret = values[i - 1] > 0 ? (values[i] - values[i - 1]) / values[i - 1] : 0
      dailyReturns.push(ret)
    }

    // Volatility (standard deviation of daily returns)
    const volatility = this.calculateStdDev(dailyReturns)
    const annualizedVolatility = volatility * Math.sqrt(252) // 252 trading days

    // Sharpe Ratio (assuming 2% risk-free rate)
    const riskFreeRate = 0.02
    const sharpeRatio = annualizedVolatility > 0
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility
      : 0

    // Sortino Ratio (only downside volatility)
    const downReturns = dailyReturns.filter(r => r < 0)
    const downVolatility = this.calculateStdDev(downReturns)
    const annualizedDownVolatility = downVolatility * Math.sqrt(252)
    const sortinoRatio = annualizedDownVolatility > 0
      ? (annualizedReturn - riskFreeRate) / annualizedDownVolatility
      : 0

    // Maximum Drawdown
    let maxDrawdown = 0
    let peak = values[0] ?? 0
    for (const value of values) {
      if (value > peak) peak = value
      const drawdown = (peak - value) / peak
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }

    // Calmar Ratio
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0

    // Win Rate (trades)
    const trades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    let winCount = 0
    let totalProfit = 0
    let totalLoss = 0
    let winSum = 0
    let lossSum = 0

    for (const trade of trades) {
      const pnl = (trade.price - (trade.price * 0.98)) * trade.amount // Simplified
      if (pnl > 0) {
        winCount++
        winSum += pnl
      } else {
        lossSum += Math.abs(pnl)
      }
      totalProfit += Math.max(0, pnl)
      totalLoss += Math.max(0, -pnl)
    }

    const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 100 : 0
    const averageWin = winCount > 0 ? winSum / winCount : 0
    const averageLoss = (trades.length - winCount) > 0 ? lossSum / (trades.length - winCount) : 0
    const riskRewardRatio = averageLoss > 0 ? averageWin / averageLoss : 0

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn: annualizedReturn * 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      maxDrawdown: maxDrawdown * 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      winRate,
      profitFactor: Math.round(profitFactor * 100) / 100,
      averageWin,
      averageLoss,
      riskRewardRatio: Math.round(riskRewardRatio * 100) / 100
    }
  }

  /**
   * Calculate risk metrics
   */
  async calculateRiskMetrics(userId: string, days: number = 365): Promise<RiskMetrics> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId,
        snapshotAt: { gte: startDate }
      },
      orderBy: { snapshotAt: 'asc' }
    })

    const values = balanceHistory.map(b => b.totalWorthUsd)
    const dailyReturns = this.calculateDailyReturns(values)

    // Volatility
    const volatility = this.calculateStdDev(dailyReturns) * Math.sqrt(252)

    // Value at Risk (95% confidence)
    const sortedReturns = [...dailyReturns].sort((a, b) => a - b)
    const var95Index = Math.floor(sortedReturns.length * 0.05)
    const valueAtRisk95 = Math.abs(sortedReturns[var95Index] ?? 0) * 100

    // Conditional Value at Risk (average of worst 5%)
    const cvarReturns = sortedReturns.slice(0, var95Index + 1)
    const conditionalValueAtRisk95 = cvarReturns.length > 0
      ? Math.abs(cvarReturns.reduce((a, b) => a + b, 0) / cvarReturns.length) * 100
      : 0

    // Expected Shortfall (similar to CVaR)
    const expectedShortfall = conditionalValueAtRisk95

    // Beta (would need market index data in production)
    const beta = 1.0 // Placeholder

    // Correlation (would need multiple assets)
    const correlation: Record<string, number> = {}

    return {
      volatility: Math.round(volatility * 100) / 100,
      beta,
      correlation,
      valueAtRisk95: Math.round(valueAtRisk95 * 100) / 100,
      conditionalValueAtRisk95: Math.round(conditionalValueAtRisk95 * 100) / 100,
      expectedShortfall: Math.round(expectedShortfall * 100) / 100
    }
  }

  /**
   * Analyze portfolio attribution
   */
  async analyzeAttribution(userId: string): Promise<AttributionAnalysis> {
    const holdings = await prisma.holding.findMany({
      where: { userId }
    })

    const totalValue = holdings.reduce((sum, h) => sum + (h.amount * h.avgPrice), 0)

    // Top contributors/detractors
    const contributions = holdings
      .map(h => ({
        symbol: h.symbol,
        value: h.amount * h.avgPrice,
        contribution: (h.amount * h.avgPrice) - (h.amount * h.avgPrice * 0.95), // Simplified
        percent: totalValue > 0 ? ((h.amount * h.avgPrice) / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.contribution - a.contribution)

    const topContributors = contributions.slice(0, 5)
    const topDetractors = contributions.slice(-5).reverse()

    // Sector allocation (simplified)
    const sectorAllocation: Record<string, number> = {}
    for (const holding of holdings) {
      const sector = this.getSector(holding.symbol)
      sectorAllocation[sector] = (sectorAllocation[sector] ?? 0) + (holding.amount * holding.avgPrice)
    }

    // Geographic allocation (simplified)
    const geographicAllocation: Record<string, number> = {
      'United States': totalValue * 0.6,
      'Europe': totalValue * 0.2,
      'Asia': totalValue * 0.15,
      'Other': totalValue * 0.05
    }

    return {
      topContributors: topContributors.map(c => ({
        symbol: c.symbol,
        contribution: c.contribution,
        percent: c.percent
      })),
      topDetractors: topDetractors.map(c => ({
        symbol: c.symbol,
        contribution: c.contribution,
        percent: c.percent
      })),
      sectorAllocation,
      geographicAllocation
    }
  }

  /**
   * Generate portfolio recommendations
   */
  async generateRecommendations(userId: string): Promise<string[]> {
    const recommendations: string[] = []

    const portfolio = await prisma.investmentPortfolio.findUnique({
      where: { userId }
    })

    const holdings = await prisma.holding.findMany({
      where: { userId }
    })

    // Check concentration
    const totalValue = holdings.reduce((sum, h) => sum + (h.amount * h.avgPrice), 0)
    const topHolding = holdings.reduce((max, h) => {
      const value = h.amount * h.avgPrice
      return value > (max.amount * max.avgPrice) ? h : max
    })

    const topHoldingPercent = totalValue > 0 ? ((topHolding.amount * topHolding.avgPrice) / totalValue) * 100 : 0
    if (topHoldingPercent > 30) {
      recommendations.push(`Your largest position (${topHolding.symbol}) represents ${topHoldingPercent.toFixed(1)}% of your portfolio. Consider diversifying.`)
    }

    // Check rebalancing
    if (portfolio?.targetAllocation) {
      try {
        const target = JSON.parse(portfolio.targetAllocation) as Record<string, number>
        const variance = Object.entries(target).map(([symbol, targetPct]) => {
          const holding = holdings.find(h => h.symbol === symbol)
          const currentPct = totalValue > 0 ? ((holding?.amount ?? 0) * (holding?.avgPrice ?? 0) / totalValue) * 100 : 0
          return Math.abs(currentPct - targetPct)
        })

        const maxVariance = Math.max(...variance)
        if (maxVariance > 5) {
          recommendations.push('Your portfolio allocation has drifted from target. Consider rebalancing.')
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for underperforming assets
    if (holdings.length > 0) {
      const underperformers = holdings.filter(h => {
        // Simplified: check if price is below average cost
        return h.avgPrice > 0 && h.avgPrice * 1.1 < h.avgPrice // This logic needs fixing
      })

      if (underperformers.length > 0) {
        recommendations.push(`You have ${underperformers.length} underperforming positions. Review for tax-loss harvesting opportunities.`)
      }
    }

    // Check for cash drag
    const cashBalance = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId, currency: 'USD' } }
    })

    if ((cashBalance?.available ?? 0) > totalValue * 0.2) {
      recommendations.push('You have significant cash holdings. Consider deploying capital into your portfolio.')
    }

    return recommendations.length > 0 ? recommendations : ['Your portfolio looks well-balanced. Keep monitoring your positions.']
  }

  /**
   * Helper: Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }

  /**
   * Helper: Calculate daily returns
   */
  private calculateDailyReturns(values: number[]): number[] {
    const returns: number[] = []
    for (let i = 1; i < values.length; i++) {
      const ret = values[i - 1] > 0 ? (values[i] - values[i - 1]) / values[i - 1] : 0
      returns.push(ret)
    }
    return returns
  }

  /**
   * Helper: Get sector for symbol
   */
  private getSector(symbol: string): string {
    const sectorMap: Record<string, string> = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'JPM': 'Financials',
      'BAC': 'Financials',
      'XOM': 'Energy',
      'CVX': 'Energy',
      'JNJ': 'Healthcare',
      'PFE': 'Healthcare',
      'BTC': 'Cryptocurrency',
      'ETH': 'Cryptocurrency',
      'SOL': 'Cryptocurrency'
    }
    return sectorMap[symbol] ?? 'Other'
  }

  /**
   * Helper: Get default metrics
   */
  private getDefaultMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      calmarRatio: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      riskRewardRatio: 0
    }
  }
}

export const analyticsEngine = new AnalyticsEngine()
