import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

const advancedOrderSchema = z.object({
  symbol: z.string().min(1).max(20),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  basePrice: z.number().positive(),
  orderType: z.enum(['market', 'limit', 'stop', 'trailing_stop']),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  trailAmount: z.number().positive().optional(),
  trailType: z.enum(['fixed', 'percent']).optional(),
  takeProfitPrice: z.number().positive().optional(),
  stopLossPrice: z.number().positive().optional(),
  timeInForce: z.enum(['GTC', 'IOC', 'FOK']).default('GTC'),
  expiresAt: z.string().datetime().optional(),
})

// Create advanced order with stop-loss and take-profit
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = advancedOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const {
      symbol,
      side,
      amount,
      basePrice,
      orderType,
      limitPrice,
      stopPrice,
      trailAmount,
      trailType,
      takeProfitPrice,
      stopLossPrice,
      timeInForce,
      expiresAt,
    } = parsed.data

    const result = await prisma.$transaction(async (tx) => {
      // Create main order
      const mainOrder = await tx.order.create({
        data: {
          userId: req.userId!,
          symbol,
          side,
          type: orderType,
          status: 'open',
          basePrice,
          amount,
          limitPrice: limitPrice || null,
          stopPrice: stopPrice || null,
          trailAmount: trailAmount || null,
          trailType: trailType || null,
          takeProfitPrice: takeProfitPrice || null,
          stopLossPrice: stopLossPrice || null,
          timeInForce,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      })

      // Create take-profit order if specified
      if (takeProfitPrice) {
        await tx.order.create({
          data: {
            userId: req.userId!,
            symbol,
            side: side === 'buy' ? 'sell' : 'buy',
            type: 'limit',
            status: 'pending',
            basePrice: takeProfitPrice,
            amount,
            limitPrice: takeProfitPrice,
            timeInForce: 'GTC',
            parentOrderId: mainOrder.id,
          },
        })
      }

      // Create stop-loss order if specified
      if (stopLossPrice) {
        await tx.order.create({
          data: {
            userId: req.userId!,
            symbol,
            side: side === 'buy' ? 'sell' : 'buy',
            type: 'stop',
            status: 'pending',
            basePrice: stopLossPrice,
            amount,
            stopPrice: stopLossPrice,
            timeInForce: 'GTC',
            parentOrderId: mainOrder.id,
          },
        })
      }

      return mainOrder
    }, {
      timeout: 20_000,
      maxWait: 10_000,
    })

    res.status(201).json({ order: result })
  } catch (error) {
    console.error('Advanced order creation error:', error)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

// Get active orders
router.get('/active', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        userId: req.userId!,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ orders })
  } catch (error) {
    console.error('Get active orders error:', error)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

// Get order history
router.get('/history', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = parseInt(req.query.offset as string) || 0

    const orders = await prisma.order.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await prisma.order.count({
      where: { userId: req.userId! },
    })

    res.json({ orders, total, limit, offset })
  } catch (error) {
    console.error('Get order history error:', error)
    res.status(500).json({ error: 'Failed to fetch order history' })
  }
})

// Cancel order
router.post('/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    if (order.status !== 'open' && order.status !== 'pending') {
      res.status(400).json({ error: 'Cannot cancel order in current status' })
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cancel main order
      const cancelled = await tx.order.update({
        where: { id: req.params.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      })

      // Cancel related orders (take-profit, stop-loss)
      if (order.parentOrderId) {
        await tx.order.updateMany({
          where: { parentOrderId: order.parentOrderId },
          data: { status: 'cancelled', cancelledAt: new Date() },
        })
      } else {
        await tx.order.updateMany({
          where: { parentOrderId: order.id },
          data: { status: 'cancelled', cancelledAt: new Date() },
        })
      }

      return cancelled
    }, {
      timeout: 20_000,
      maxWait: 10_000,
    })

    res.json({ order: result })
  } catch (error) {
    console.error('Cancel order error:', error)
    res.status(500).json({ error: 'Failed to cancel order' })
  }
})

// Modify order
router.put('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { limitPrice, stopPrice, amount, expiresAt } = z
      .object({
        limitPrice: z.number().positive().optional(),
        stopPrice: z.number().positive().optional(),
        amount: z.number().positive().optional(),
        expiresAt: z.string().datetime().optional(),
      })
      .parse(req.body)

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    if (order.status !== 'open' && order.status !== 'pending') {
      res.status(400).json({ error: 'Cannot modify order in current status' })
      return
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        limitPrice: limitPrice ?? order.limitPrice,
        stopPrice: stopPrice ?? order.stopPrice,
        amount: amount ?? order.amount,
        expiresAt: expiresAt ? new Date(expiresAt) : order.expiresAt,
      },
    })

    res.json({ order: updated })
  } catch (error) {
    console.error('Modify order error:', error)
    res.status(500).json({ error: 'Failed to modify order' })
  }
})

// Get order details
router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    // Get related orders (take-profit, stop-loss)
    const relatedOrders = await prisma.order.findMany({
      where: {
        OR: [{ parentOrderId: order.id }, { parentOrderId: order.parentOrderId }],
      },
    })

    res.json({ order, relatedOrders })
  } catch (error) {
    console.error('Get order error:', error)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

// Get order statistics
router.get('/stats/summary', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [totalOrders, openOrders, filledOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({ where: { userId: req.userId! } }),
      prisma.order.count({ where: { userId: req.userId!, status: 'open' } }),
      prisma.order.count({ where: { userId: req.userId!, status: 'filled' } }),
      prisma.order.count({ where: { userId: req.userId!, status: 'cancelled' } }),
    ])

    const avgFillTime = await prisma.order.aggregate({
      where: { userId: req.userId!, filledAt: { not: null } },
      _avg: {
        filledAmount: true,
      },
    })

    res.json({
      totalOrders,
      openOrders,
      filledOrders,
      cancelledOrders,
      fillRate: totalOrders > 0 ? (filledOrders / totalOrders) * 100 : 0,
    })
  } catch (error) {
    console.error('Get order stats error:', error)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

export default router
