import { prisma } from '../db'
import { getCurrentCryptoPrice } from '../historicalPrice'
import type { Order, Trade, Prisma } from '@prisma/client'

export type AdvancedOrderType = 'stop_loss' | 'take_profit' | 'limit'
export type AdvancedOrderStatus = 'active' | 'triggered' | 'filled' | 'cancelled'

export type AdvancedOrderRecord = Order

/**
 * Advanced Orders Service: Manages stop-loss, take-profit, and limit orders
 */
export class AdvancedOrdersService {
  /**
   * Create an advanced order
   */
  async createOrder(
    userId: string,
    {
      symbol,
      orderType,
      side,
      quantity,
      triggerPrice,
      limitPrice,
    }: {
      symbol: string
      orderType: AdvancedOrderType
      side: 'buy' | 'sell'
      quantity: number
      triggerPrice: number
      limitPrice?: number
    }
  ): Promise<AdvancedOrderRecord> {
    // Validate inputs
    if (quantity <= 0) throw new Error('Quantity must be positive')
    if (triggerPrice <= 0) throw new Error('Trigger price must be positive')
    if (orderType === 'take_profit' && side === 'buy') {
      throw new Error('Take-profit orders must be sell orders')
    }
    if (orderType === 'stop_loss' && side === 'sell') {
      throw new Error('Stop-loss orders must be sell orders')
    }
    if (limitPrice && limitPrice <= 0) throw new Error('Limit price must be positive')

    // Fetch current price to store as basePrice and validate limit if needed
    const currentPrice = await getCurrentCryptoPrice(symbol)
    if (!currentPrice) throw new Error(`Cannot fetch current price for ${symbol}`)

    // For limit orders, ensure limit price is on correct side of market
    if (orderType === 'limit') {
      if (side === 'buy' && limitPrice && limitPrice > currentPrice) {
        throw new Error(`Buy limit price must be below market price ($${currentPrice})`)
      }
      if (side === 'sell' && limitPrice && limitPrice < currentPrice) {
        throw new Error(`Sell limit price must be above market price ($${currentPrice})`)
      }
    }

    // Use the generic `Order` model to persist advanced orders (keeps schema in sync)
    return prisma.order.create({
      data: {
        userId,
        symbol,
        type: orderType,
        side,
        amount: quantity,
        basePrice: currentPrice,
        limitPrice: orderType === 'limit' ? limitPrice ?? triggerPrice : null,
        stopPrice: orderType === 'stop_loss' ? triggerPrice : null,
        takeProfitPrice: orderType === 'take_profit' ? triggerPrice : null,
        status: 'active',
      },
    })
  }

  /**
   * Get all active orders for a user
   */
  async getUserOrders(userId: string, status?: AdvancedOrderStatus): Promise<AdvancedOrderRecord[]> {
    return prisma.order.findMany({
      where: {
        userId,
        type: { in: ['stop_loss', 'take_profit', 'limit'] },
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get a single order
   */
  async getOrder(id: string, userId: string): Promise<AdvancedOrderRecord | null> {
    return prisma.order.findFirst({
      where: { id, userId },
    })
  }

  /**
   * Cancel an order
   */
  async cancelOrder(id: string, userId: string): Promise<AdvancedOrderRecord> {
    const order = await this.getOrder(id, userId)
    if (!order) throw new Error('Order not found')
    if (order.status !== 'active') throw new Error(`Cannot cancel ${order.status} order`)

    return prisma.order.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })
  }

  /**
   * Check all active orders and trigger those that meet conditions
   * Returns array of triggered Order records (not Trade records)
   */
  async checkAndTriggerOrders(): Promise<AdvancedOrderRecord[]> {
    const activeOrders = await prisma.order.findMany({
      where: { status: 'active', type: { in: ['stop_loss', 'take_profit', 'limit'] } },
      include: { user: true },
    })

    const triggeredOrders: AdvancedOrderRecord[] = []

    for (const order of activeOrders) {
      try {
        const currentPrice = await getCurrentCryptoPrice(order.symbol)
        if (!currentPrice) continue

        let shouldTrigger = false
        let triggerPrice = 0

        if (order.type === 'stop_loss') {
          triggerPrice = order.stopPrice ?? order.stopLossPrice ?? 0
          if (triggerPrice > 0 && currentPrice <= triggerPrice) {
            shouldTrigger = true
          }
        }

        if (order.type === 'take_profit') {
          triggerPrice = order.takeProfitPrice ?? 0
          if (triggerPrice > 0 && currentPrice >= triggerPrice) {
            shouldTrigger = true
          }
        }

        if (order.type === 'limit') {
          const limitPrice = order.limitPrice ?? order.stopPrice ?? order.takeProfitPrice ?? order.basePrice
          if (order.side === 'buy' && currentPrice <= limitPrice) {
            shouldTrigger = true
          } else if (order.side === 'sell' && currentPrice >= limitPrice) {
            shouldTrigger = true
          }
        }

        if (shouldTrigger) {
          // Update order status to triggered, then execute
          const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { status: 'triggered' },
          })
          await this.executeOrder(order)
          triggeredOrders.push(updatedOrder)
        }
      } catch (err) {
        console.error(`[AdvancedOrders] Error checking order ${order.id}:`, err)
      }
    }

    return triggeredOrders
  }

  /**
   * Execute an order (convert to market trade)
   */
  private async executeOrder(order: Order): Promise<Trade> {
    const currentPrice = await getCurrentCryptoPrice(order.symbol)
    if (!currentPrice) throw new Error(`No price available for ${order.symbol}`)

    const total = order.amount * currentPrice

    // Execute atomically
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create trade record with schema-aligned fields
      const t = await tx.trade.create({
        data: {
          userId: order.userId,
          symbol: order.symbol,
          side: order.side,
          amount: order.amount,
          price: currentPrice,
          total,
        },
      })

      // Update holdings and wallet balances
      const holding = await tx.holding.findUnique({
        where: { userId_symbol: { userId: order.userId, symbol: order.symbol } },
      })

      if (order.side === 'buy') {
        // Increase or create holding
        if (holding) {
          const newAmount = holding.amount + order.amount
          const newAvg = (holding.avgPrice * holding.amount + currentPrice * order.amount) / newAmount
          await tx.holding.update({ where: { id: holding.id }, data: { amount: newAmount, avgPrice: newAvg } })
        } else {
          await tx.holding.create({
            data: {
              userId: order.userId,
              symbol: order.symbol,
              name: order.symbol,
              amount: order.amount,
              avgPrice: currentPrice,
              type: 'crypto',
            },
          })
        }

        // Deduct USD wallet balance
        await tx.walletBalance.update({
          where: { userId_currency: { userId: order.userId, currency: 'USD' } },
          data: { balance: { decrement: total }, available: { decrement: total } },
        })
      } else {
        // SELL: ensure holding exists and has enough
        if (!holding || holding.amount < order.amount) {
          throw new Error('Insufficient asset balance to execute sell')
        }

        const remaining = holding.amount - order.amount
        if (remaining === 0) {
          await tx.holding.delete({ where: { id: holding.id } })
        } else {
          await tx.holding.update({ where: { id: holding.id }, data: { amount: remaining } })
        }

        // Credit USD balance
        await tx.walletBalance.update({
          where: { userId_currency: { userId: order.userId, currency: 'USD' } },
          data: { balance: { increment: total }, available: { increment: total } },
        })
      }

      // Mark original order as filled
      await tx.order.update({ where: { id: order.id }, data: { status: 'filled', filledAt: new Date() } })

      return t
    })

    return result
  }
}

export const advancedOrdersService = new AdvancedOrdersService()
