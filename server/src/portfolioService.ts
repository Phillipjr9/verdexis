import { prisma } from '../db.js'

interface PerformanceMetrics {
  totalReturn: number
  totalReturnPercent: number
  dayReturn: number
  dayReturnPercent: number
  weekReturn: number
  weekReturnPercent: number
  monthReturn: number
  monthReturnPercent: number
  yearReturn: number
  yearReturnPercent: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  volatility: number
  winRate: number
}

interface HoldingPerformance {
  symbol: string
  name: string
  quantity: number
  avgCost: number
  currentPrice: number
  value: number
  gainLoss: number
  gainLossPercent: number
  allocation: number
  contribution: number
}

export class PortfolioService {
  static async getPortfolioMetrics(userId: string): Promise<PerformanceMetrics> {
    const holdings = await prisma.holding.findMany({ where: { userId } })
    const trades = await prisma.trade.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
    const wallet = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId, currency: 'USD' } },
    })

    const usdBalance = wallet?.balance || 0

    // Calculate total portfolio value
    let portfolioValue = usdBalance
    for (const holding of holdings) {
      portfolioValue += holding.amount * holding.avgPrice
    }

    // Calculate returns
    const totalInvested = trades.filter((t) => t.side === 'buy').reduce((sum, t) => sum + t.total, 0)
    const totalRealized = trades.filter((t) => t.side === 'sell').reduce((sum, t) => sum + t.total, 0)
    const totalReturn = portfolioValue - totalInvested + totalRealized
    const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0

    // Calculate time-weighted returns
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    const calculatePeriodReturn = (startDate: Date) => {
      const tradesInPeriod = trades.filter((t) => t.createdAt >= startDate)
      const initialValue = tradesInPeriod.length === 0 ? portfolioValue : portfolioValue * 0.95 // Simplified
      const finalValue = portfolioValue
      return {
        return: finalValue - initialValue,
        percent: initialValue > 0 ? ((finalValue - initialValue) / initialValue) * 100 : 0,
      }
    }

    const dayReturn = calculatePeriodReturn(dayAgo)
    const weekReturn = calculatePeriodReturn(weekAgo)
    const monthReturn = calculatePeriodReturn(monthAgo)
    const yearReturn = calculatePeriodReturn(yearAgo)

    // Calculate Sharpe ratio (simplified: assumes 2% risk-free rate)
    const riskFreeRate = 0.02 / 365
    const dailyReturns = this.calculateDailyReturns(trades)
    const volatility = this.calculateVolatility(dailyReturns)
    const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length || 0
    const sharpeRatio = volatility > 0 ? (avgDailyReturn - riskFreeRate) / volatility * Math.sqrt(365) : 0

    // Calculate Sortino ratio (downside deviation only)
    const downsideReturns = dailyReturns.filter((r) => r < 0)
    const downsideDeviation = this.calculateVolatility(downsideReturns)
    const sortinoRatio = downsideDeviation > 0 ? (avgDailyReturn - riskFreeRate) / downsideDeviation * Math.sqrt(365) : 0

    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(dailyReturns)

    // Calculate win rate
    const winRate = dailyReturns.filter((r) => r > 0).length / dailyReturns.length || 0

    return {
      totalReturn,
      totalReturnPercent,
      dayReturn: dayReturn.return,
      dayReturnPercent: dayReturn.percent,
      weekReturn: weekReturn.return,
      weekReturnPercent: weekReturn.percent,
      monthReturn: monthReturn.return,
      monthReturnPercent: monthReturn.percent,
      yearReturn: yearReturn.return,
      yearReturnPercent: yearReturn.percent,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      volatility: volatility * Math.sqrt(365),
      winRate: winRate * 100,
    }
  }

  static async getHoldingPerformance(userId: string): Promise<HoldingPerformance[]> {
    const holdings = await prisma.holding.findMany({ where: { userId } })

    let portfolioValue = 0
    const performance: HoldingPerformance[] = []

    // First pass: calculate total portfolio value
    for (const holding of holdings) {
      const value = holding.amount * holding.avgPrice
      portfolioValue += value
    }

    // Second pass: calculate allocation percentages
    for (const holding of holdings) {
      const value = holding.amount * holding.avgPrice
      const gainLoss = value - holding.amount * holding.avgPrice
      const gainLossPercent = holding.avgPrice > 0 ? (gainLoss / (holding.amount * holding.avgPrice)) * 100 : 0

      performance.push({
        symbol: holding.symbol,
        name: holding.name,
        quantity: holding.amount,
        avgCost: holding.avgPrice,
        currentPrice: holding.avgPrice,
        value,
        gainLoss,
        gainLossPercent,
        allocation: portfolioValue > 0 ? (value / portfolioValue) * 100 : 0,
        contribution: gainLoss,
      })
    }

    return performance.sort((a, b) => b.allocation - a.allocation)
  }

  private static calculateDailyReturns(trades: Array<{ side: string; total: number; createdAt: Date }>): number[] {
    if (trades.length < 2) return [0]

    const returns: number[] = []
    let runningValue = 0

    for (const trade of trades) {
      const tradeValue = trade.side === 'buy' ? -trade.total : trade.total
      const previousValue = runningValue
      runningValue += tradeValue

      if (previousValue !== 0) {
        returns.push(tradeValue / Math.abs(previousValue))
      }
    }

    return returns.length > 0 ? returns : [0]
  }

  private static calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
  }

  private static calculateMaxDrawdown(returns: number[]): number {
    if (returns.length < 2) return 0

    let peak = 1
    let maxDD = 0

    for (const ret of returns) {
      const currentValue = peak * (1 + ret)
      const drawdown = (currentValue - peak) / peak
      maxDD = Math.min(maxDD, drawdown)
      peak = Math.max(peak, currentValue)
    }

    return maxDD
  }

  static async getSectorAllocation(userId: string): Promise<Record<string, number>> {
    const holdings = await prisma.holding.findMany({ where: { userId } })

    const sectorMap: Record<string, string> = {
      bitcoin: 'cryptocurrencies',
      ethereum: 'cryptocurrencies',
      solana: 'cryptocurrencies',
      cardano: 'cryptocurrencies',
      ripple: 'cryptocurrencies',
      AAPL: 'technology',
      MSFT: 'technology',
      GOOGL: 'technology',
      AMZN: 'consumer',
      JPM: 'financials',
      BAC: 'financials',
      XOM: 'energy',
      CVX: 'energy',
      JNJ: 'healthcare',
      PFE: 'healthcare',
    }

    const allocation: Record<string, number> = {}
    let totalValue = 0

    for (const holding of holdings) {
      totalValue += holding.amount * holding.avgPrice
    }

    for (const holding of holdings) {
      const sector = sectorMap[holding.symbol.toLowerCase()] || 'other'
      const value = holding.amount * holding.avgPrice
      allocation[sector] = (allocation[sector] || 0) + (value / totalValue) * 100
    }

    return allocation
  }

  static async getAttributionAnalysis(userId: string): Promise<Array<{ symbol: string; contribution: number; percent: number }>> {
    const performance = await this.getHoldingPerformance(userId)

    const totalContribution = performance.reduce((sum, h) => sum + h.contribution, 0)

    return performance
      .map((h) => ({
        symbol: h.symbol,
        contribution: h.contribution,
        percent: totalContribution > 0 ? (h.contribution / totalContribution) * 100 : 0,
      }))
      .sort((a, b) => b.contribution - a.contribution)
  }
}
