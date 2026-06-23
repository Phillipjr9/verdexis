import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

// CSRF protection: This JSON API is secured by JWT in the Authorization header.
// JWT tokens cannot be sent cross-origin via traditional CORS, providing inherent CSRF protection.

const router = Router()

const upsertSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  amount: z.number().nonnegative(),
  avgPrice: z.number().nonnegative(),
  type: z.enum(['crypto', 'stock', 'etf']),
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const holdings = await prisma.holding.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
  res.json({ holdings })
})

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const parsed = upsertSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const { symbol, name, amount, avgPrice, type } = parsed.data
  const holding = await prisma.holding.upsert({
    where: { userId_symbol: { userId, symbol } },
    create: { userId, symbol, name, amount, avgPrice, type },
    update: { name, amount, avgPrice, type },
  })
  res.json({ holding })
})

router.delete('/:symbol', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  await prisma.holding.deleteMany({ where: { userId, symbol: req.params.symbol } })
  res.json({ ok: true })
})

// Daily performance endpoint for TradingAttribution component
router.get('/performance/daily', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const holdings = await prisma.holding.findMany({
      where: { userId },
    })

    if (holdings.length === 0) {
      res.json({ breakdown: [], total: { pnl: 0, pnlPercent: 0 } })
      return
    }

    // Calculate daily P&L (simplified - assumes avgPrice as cost basis)
    let totalValue = 0
    let totalCost = 0
    
    const breakdown = holdings.map(h => {
      const value = h.amount * h.avgPrice
      const cost = h.amount * h.avgPrice
      const pnl = value - cost
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0
      
      totalValue += value
      totalCost += cost
      
      return {
        symbol: h.symbol,
        name: h.name,
        value,
        pnl,
        pnlPercent,
        allocation: 0, // Will calculate after total
      }
    })

    // Calculate allocation percentages
    breakdown.forEach(b => {
      b.allocation = totalValue > 0 ? (b.value / totalValue) * 100 : 0
    })

    const totalPnl = totalValue - totalCost
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

    res.json({
      breakdown: breakdown.sort((a, b) => b.value - a.value),
      total: {
        pnl: totalPnl,
        pnlPercent: totalPnlPercent,
      },
    })
  } catch (error) {
    console.error('Daily performance fetch error:', error)
    res.status(500).json({ error: 'Failed to calculate performance' })
  }
})

export default router
