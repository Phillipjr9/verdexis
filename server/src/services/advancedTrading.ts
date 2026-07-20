import { prisma } from '../db.js'

export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit'
export type OrderStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'expired'

export interface Order {
  id: string
  userId: string
  symbol: string
  type: OrderType
  side: 'buy' | 'sell'
  quantity: number
  price: number
  stopPrice?: number
  status: OrderStatus
  filledQuantity: number
  createdAt: Date
  expiresAt?: Date
}

export interface TradeAnalytics {
  totalTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  sortinoRatio: number
}

export interface PortfolioMetrics {
  totalValue: number
  totalCost: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  realizedPnL: number
  concentration: Record<string, number>
}

export class AdvancedTradingService {
  /**
   * Create limit order
   */
  static async createLimitOrder(
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    expiresAt?: Date,
  ): Promise<Order> {
    const order = await prisma.order.create({
      data: {
        userId,
        symbol,
        type: 'limit',
        side,
        amount: quantity,
        basePrice: price,
        status: 'pending',
        filledAmount: 0,
        expiresAt,
      },
    })

    return { ...order, quantity: order.amount, price: order.basePrice, filledQuantity: order.filledAmount } as unknown as Order
  }

  /**
   * Create stop-loss order
   */
  static async createStopLossOrder(
    userId: string,
    symbol: string,
    quantity: number,
    stopPrice: number,
    limitPrice?: number,
  ): Promise<Order> {
    const order = await prisma.order.create({
      data: {
        userId,
        symbol,
        type: 'stop_loss',
        side: 'sell',
        amount: quantity,
        basePrice: limitPrice || stopPrice,
        stopPrice,
        status: 'pending',
        filledAmount: 0,
      },
    })

    return { ...order, quantity: order.amount, price: order.basePrice, filledQuantity: order.filledAmount } as unknown as Order
  }

  /**
   * Create take-profit order
   */
  static async createTakeProfitOrder(
    userId: string,
    symbol: string,
    quantity: number,
    targetPrice: number,
  ): Promise<Order> {
    const order = await prisma.order.create({
      data: {
        userId,
        symbol,
        type: 'take_profit',
        side: 'sell',
        amount: quantity,
        basePrice: targetPrice,
        status: 'pending',
        filledAmount: 0,
      },
    })

    return { ...order, quantity: order.amount, price: order.basePrice, filledQuantity: order.filledAmount } as unknown as Order
  }

  /**
   * Cancel order
   */
  static async cancelOrder(userId: string, orderId: string): Promise<Order> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    })

    return { ...order, quantity: order.amount, price: order.basePrice, filledQuantity: order.filledAmount } as unknown as Order
  }

  /**
   * Get user's orders
   */
  static async getUserOrders(userId: string, status?: OrderStatus): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(o => ({ ...o, quantity: o.amount, price: o.basePrice, filledQuantity: o.filledAmount })) as unknown as Order[]
  }

  /**
   * Calculate trade analytics
   */
  static async calculateTradeAnalytics(userId: string): Promise<TradeAnalytics> {
    const trades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
      }
    }

    // Calculate PnL for each trade
    const pnlValues: number[] = []
    let winCount = 0
    let lossCount = 0
    let totalWins = 0
    let totalLosses = 0

    for (let i = 0; i < trades.length - 1; i++) {
      const entryPrice = trades[i].price
      const exitPrice = trades[i + 1].price
      const pnl = (exitPrice - entryPrice) * trades[i].amount

      pnlValues.push(pnl)

      if (pnl > 0) {
        winCount++
        totalWins += pnl
      } else if (pnl < 0) {
        lossCount++
        totalLosses += Math.abs(pnl)
      }
    }

    const winRate = (winCount / trades.length) * 100
    const avgWin = winCount > 0 ? totalWins / winCount : 0
    const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0

    // Calculate max drawdown
    let maxDrawdown = 0
    let peak = 0
    let cumulative = 0

    for (const pnl of pnlValues) {
      cumulative += pnl
      if (cumulative > peak) {
        peak = cumulative
      }
      const drawdown = peak - cumulative
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    // Calculate Sharpe ratio (assuming 0% risk-free rate)
    const mean = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length
    const variance = pnlValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pnlValues.length
    const stdDev = Math.sqrt(variance)
    const sharpeRatio = stdDev > 0 ? mean / stdDev : 0

    // Calculate Sortino ratio (only downside volatility)
    const downside = pnlValues.filter(p => p < 0)
    const downsideVariance = downside.length > 0 ? downside.reduce((sum, val) => sum + Math.pow(val, 2), 0) / downside.length : 0
    const downsideStdDev = Math.sqrt(downsideVariance)
    const sortinoRatio = downsideStdDev > 0 ? mean / downsideStdDev : 0

    return {
      totalTrades: trades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
    }
  }

  /**
   * Calculate portfolio metrics
   */
  static async calculatePortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
    const holdings = await prisma.holding.findMany({
      where: { userId },
    })

    const walletBalances = await prisma.walletBalance.findMany({
      where: { userId },
    })

    let totalValue = 0
    let totalCost = 0
    let unrealizedPnL = 0
    const concentration: Record<string, number> = {}

    // Calculate holdings value
    for (const holding of holdings) {
      const cost = holding.amount * holding.avgPrice
      totalCost += cost
      // In production, fetch current price from market data
      const currentValue = holding.amount * holding.avgPrice // Placeholder
      totalValue += currentValue
      unrealizedPnL += currentValue - cost
      concentration[holding.symbol] = (currentValue / totalValue) * 100
    }

    // Add cash balances
    for (const balance of walletBalances) {
      totalValue += balance.balance
    }

    const realizedPnL = 0 // Would need to track closed positions

    return {
      totalValue,
      totalCost,
      unrealizedPnL,
      unrealizedPnLPercent: totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0,
      realizedPnL,
      concentration,
    }
  }

  /**
   * Rebalance portfolio
   */
  static async rebalancePortfolio(
    userId: string,
    targetAllocation: Record<string, number>,
  ): Promise<{ orders: Order[]; message: string }> {
    const portfolio = await this.calculatePortfolioMetrics(userId)
    const orders: Order[] = []

    for (const [symbol, targetPercent] of Object.entries(targetAllocation)) {
      const currentPercent = portfolio.concentration[symbol] || 0
      const diff = targetPercent - currentPercent

      if (Math.abs(diff) > 1) {
        // Rebalance if difference > 1%
        const targetValue = (portfolio.totalValue * targetPercent) / 100
        const currentValue = (portfolio.totalValue * currentPercent) / 100
        const adjustmentValue = targetValue - currentValue

        if (adjustmentValue > 0) {
          // Buy
          const order = await this.createLimitOrder(userId, symbol, 'buy', adjustmentValue / 100, 100) // Placeholder price
          orders.push(order)
        } else if (adjustmentValue < 0) {
          // Sell
          const order = await this.createLimitOrder(userId, symbol, 'sell', Math.abs(adjustmentValue) / 100, 100)
          orders.push(order)
        }
      }
    }

    return {
      orders,
      message: `Portfolio rebalanced with ${orders.length} orders`,
    }
  }

  /**
   * Get trade history with analytics
   */
  static async getTradeHistory(userId: string, limit: number = 100): Promise<any[]> {
    return prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  static async calculateVaR(userId: string, confidenceLevel: number = 0.95): Promise<number> {
    const trades = await prisma.trade.findMany({
      where: { userId },
      select: { price: true, amount: true },
    })

    if (trades.length < 2) return 0

    const returns = []
    for (let i = 1; i < trades.length; i++) {
      const ret = (trades[i].price - trades[i - 1].price) / trades[i - 1].price
      returns.push(ret)
    }

    returns.sort((a, b) => a - b)
    const index = Math.floor(returns.length * (1 - confidenceLevel))

    return Math.abs(returns[index])
  }
}

export const advancedTradingService = new AdvancedTradingService()
