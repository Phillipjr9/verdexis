import { prisma } from './db.js'

export interface OrderWithCalculations {
  id: string
  userId: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop' | 'trailing_stop' | 'bracket'
  status: 'open' | 'filled' | 'cancelled' | 'expired'
  basePrice: number
  amount: number
  filledAmount: number
  limitPrice?: number
  stopPrice?: number
  trailAmount?: number // For trailing stop: amount or percentage to trail
  trailType?: 'amount' | 'percent' // Whether trail is fixed amount or percentage
  takeProfitPrice?: number // For bracket orders
  stopLossPrice?: number // For bracket orders
  timeInForce: 'GTC' | 'IOC' | 'FOK' // Good-til-cancel, Immediate-or-cancel, Fill-or-kill
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
}

export class OrderEvaluator {
  // Evaluate if a trailing stop order should trigger
  static evaluateTrailingStop(order: OrderWithCalculations, currentPrice: number, highPrice: number): boolean {
    if (!order.stopPrice || !order.trailAmount || !order.trailType) return false

    if (order.side === 'sell') {
      // For sell trailing stop, trail downward from high
      const trailValue = order.trailType === 'percent'
        ? highPrice * (order.trailAmount / 100)
        : order.trailAmount
      return currentPrice <= highPrice - trailValue
    } else {
      // For buy trailing stop, trail upward from low
      const trailValue = order.trailType === 'percent'
        ? highPrice * (order.trailAmount / 100)
        : order.trailAmount
      return currentPrice >= highPrice - trailValue
    }
  }

  // Evaluate if a stop order should trigger
  static evaluateStop(order: OrderWithCalculations, currentPrice: number): boolean {
    if (!order.stopPrice) return false
    if (order.side === 'buy') return currentPrice <= order.stopPrice
    if (order.side === 'sell') return currentPrice >= order.stopPrice
    return false
  }

  // Evaluate if a limit order should fill
  static evaluateLimit(order: OrderWithCalculations, currentPrice: number): boolean {
    if (!order.limitPrice) return false
    if (order.side === 'buy') return currentPrice <= order.limitPrice
    if (order.side === 'sell') return currentPrice >= order.limitPrice
    return false
  }

  // Check if order has expired
  static isExpired(order: OrderWithCalculations): boolean {
    if (!order.expiresAt) return false
    return new Date() > order.expiresAt
  }

  // Check if order should be closed (filled, cancelled, or expired)
  static isClosed(order: OrderWithCalculations): boolean {
    return ['filled', 'cancelled', 'expired'].includes(order.status)
  }
}

export class TradeExecutor {
  // Execute a market order immediately at current price
  static async executeMarketOrder(
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    currentPrice: number,
  ): Promise<{ orderId: string; executed: boolean; message: string; executedAmount: number; executedPrice: number; total: number }> {
    // In production: forward to broker API (Alpaca, etc.)
    // For now: simulate execution
    const total = amount * currentPrice

    const order = await prisma.trade.create({
      data: {
        userId,
        symbol,
        side,
        amount,
        price: currentPrice,
        total,
      },
    })

    // Update holdings
    const holding = await prisma.holding.findUnique({
      where: { userId_symbol: { userId, symbol } },
    })

    if (side === 'buy') {
      if (holding) {
        const newAmount = holding.amount + amount
        const newAvgPrice = (holding.avgPrice * holding.amount + total) / newAmount
        await prisma.holding.update({
          where: { id: holding.id },
          data: {
            amount: newAmount,
            avgPrice: newAvgPrice,
          },
        })
      } else {
        await prisma.holding.create({
          data: {
            userId,
            symbol,
            name: symbol,
            amount,
            avgPrice: currentPrice,
            type: symbol.length <= 5 ? 'crypto' : 'stock',
          },
        })
      }
    } else if (side === 'sell' && holding) {
      await prisma.holding.update({
        where: { id: holding.id },
        data: {
          amount: Math.max(0, holding.amount - amount),
        },
      })
    }

    return {
      orderId: order.id,
      executed: true,
      message: 'Order executed',
      executedAmount: amount,
      executedPrice: currentPrice,
      total,
    }
  }

  // Execute a limit order (only fills if price meets condition)
  static async executeLimitOrder(
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    limitPrice: number,
    currentPrice: number,
  ): Promise<{ orderId: string; executed: boolean; message: string; executedAmount?: number; executedPrice?: number; total?: number }> {
    const shouldFill =
      (side === 'buy' && currentPrice <= limitPrice) ||
      (side === 'sell' && currentPrice >= limitPrice)

    if (!shouldFill) {
      // Return pending order
      // TODO: Store in database with limit price
      return {
        orderId: 'pending-order-id',
        executed: false,
        message: `Order pending. Awaiting price to reach $${limitPrice}`,
      }
    }

    // Execute at current price (better than limit)
    return TradeExecutor.executeMarketOrder(userId, symbol, side, amount, currentPrice)
  }

  // Execute a trailing stop order
  static async executeTrailingStop(
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    trailAmount: number,
    trailType: 'amount' | 'percent',
    currentPrice: number,
    highPrice: number,
  ): Promise<{ orderId: string; executed: boolean; message: string; executedAmount?: number; executedPrice?: number; total?: number }> {
    const shouldTrigger = OrderEvaluator.evaluateTrailingStop(
      {
        id: '',
        userId,
        symbol,
        side,
        type: 'trailing_stop',
        status: 'open',
        basePrice: currentPrice,
        amount,
        filledAmount: 0,
        stopPrice: highPrice,
        trailAmount,
        trailType,
        timeInForce: 'GTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentPrice,
      highPrice,
    )

    if (!shouldTrigger) {
      return {
        orderId: 'trailing-stop-pending',
        executed: false,
        message: `Trailing stop active. Trail: ${trailAmount}${trailType === 'percent' ? '%' : ''}`,
      }
    }

    // Trigger: execute as market order
    return TradeExecutor.executeMarketOrder(userId, symbol, side, amount, currentPrice)
  }

  // Execute a bracket order (entry + take profit + stop loss)
  static async executeBracketOrder(
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    entryPrice: number,
    takeProfitPrice: number,
    stopLossPrice: number,
    currentPrice: number,
  ): Promise<{ entryOrderId: string; tpOrderId: string; slOrderId: string; executed: boolean }> {
    // Check if entry condition is met (limit order behavior)
    const entryFills =
      (side === 'buy' && currentPrice <= entryPrice) ||
      (side === 'sell' && currentPrice >= entryPrice)

    if (!entryFills) {
      return {
        entryOrderId: 'entry-pending',
        tpOrderId: 'tp-pending',
        slOrderId: 'sl-pending',
        executed: false,
      }
    }

    // Execute entry
    const entry = await TradeExecutor.executeMarketOrder(userId, symbol, side, amount, currentPrice)

    // Create TP and SL orders (would be created in database with status 'pending')
    // In production, these would be created as separate orders linked to the entry

    return {
      entryOrderId: entry.orderId,
      tpOrderId: 'tp-order-id',
      slOrderId: 'sl-order-id',
      executed: true,
    }
  }
}

// Background job to evaluate and execute pending orders
export async function evaluatePendingOrders() {
  console.log('[order-evaluator] Checking pending orders...')

  // Get all pending orders
  // In production, would fetch from database
  // For now, this is a placeholder for the poller

  return 0 // number of orders executed
}
