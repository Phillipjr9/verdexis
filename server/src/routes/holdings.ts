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

export default router
