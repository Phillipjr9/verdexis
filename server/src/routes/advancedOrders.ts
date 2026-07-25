import { Router, type Response } from 'express'
import { z } from 'zod'
import { advancedOrdersService } from '../services/advancedOrdersService.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

// Schemas
const createOrderSchema = z.object({
  symbol: z.string().min(2).max(10),
  orderType: z.enum(['stop_loss', 'take_profit', 'limit']),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  triggerPrice: z.number().positive(),
  limitPrice: z.number().positive().optional(),
})

/**
 * GET /api/advanced-orders
 * List all active orders for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const status = (req.query.status as string) || undefined
    const orders = await advancedOrdersService.getUserOrders(
      req.userId!,
      status as any
    )
    return res.json(orders)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch orders' })
  }
})

/**
 * GET /api/advanced-orders/:id
 * Get a single advanced order
 */
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const order = await advancedOrdersService.getOrder(req.params.id, req.userId!)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    return res.json(order)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch order' })
  }
})

/**
 * POST /api/advanced-orders
 * Create a new advanced order
 */
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const body = createOrderSchema.parse(req.body) as {
      symbol: string
      orderType: 'stop_loss' | 'take_profit' | 'limit'
      side: 'buy' | 'sell'
      quantity: number
      triggerPrice: number
      limitPrice?: number
    }
    const order = await advancedOrdersService.createOrder(req.userId!, body)
    return res.status(201).json(order)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0].message })
    }
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create order' })
  }
})

/**
 * DELETE /api/advanced-orders/:id
 * Cancel an advanced order
 */
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const order = await advancedOrdersService.cancelOrder(req.params.id, req.userId!)
    return res.json(order)
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to cancel order' })
  }
})

export default router
