import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { notifyTransaction } from '../services/emailHooks.js'

const router = Router()

const swapLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip || 'anon',
})

const swapSchema = z.object({
  fromSymbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  toSymbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  fromAmount: z.number().positive(),
  fromPrice: z.number().positive(), // Current price of fromSymbol in USD
  toPrice: z.number().positive(),   // Current price of toSymbol in USD
  toName: z.string().min(1).max(100).optional(),
})

// Swap fee: 0.25% (higher than regular trades since it's more convenient)
const SWAP_FEE_RATE = 0.0025

router.post('/', requireAuth, swapLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const parsed = swapSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { fromSymbol, toSymbol, fromAmount, fromPrice, toPrice, toName } = parsed.data

  if (fromSymbol === toSymbol) {
    res.status(400).json({ error: 'Cannot swap to the same asset' })
    return
  }

  // Calculate swap amounts
  const fromValueUsd = fromAmount * fromPrice
  const feeUsd = fromValueUsd * SWAP_FEE_RATE
  const netValueUsd = fromValueUsd - feeUsd
  const toAmount = netValueUsd / toPrice

  const result = await prisma.$transaction(async (tx) => {
    // 1. Check and deduct FROM holdings
    const fromHolding = await tx.holding.findUnique({
      where: { userId_symbol: { userId, symbol: fromSymbol } },
    })
    
    if (!fromHolding || fromHolding.amount < fromAmount) {
      throw Object.assign(
        new Error(`Insufficient ${fromSymbol}: need ${fromAmount}, have ${fromHolding?.amount ?? 0}`),
        { status: 400 }
      )
    }

    const remainingFrom = fromHolding.amount - fromAmount
    if (remainingFrom > 0) {
      await tx.holding.update({
        where: { id: fromHolding.id },
        data: { amount: remainingFrom },
      })
    } else {
      await tx.holding.delete({ where: { id: fromHolding.id } })
    }

    // 2. Add TO holdings with weighted-average cost
    const toHolding = await tx.holding.findUnique({
      where: { userId_symbol: { userId, symbol: toSymbol } },
    })

    const newToAmount = (toHolding?.amount ?? 0) + toAmount
    const newAvgPrice = toHolding && toHolding.amount > 0
      ? ((toHolding.amount * toHolding.avgPrice) + (toAmount * toPrice)) / newToAmount
      : toPrice

    await tx.holding.upsert({
      where: { userId_symbol: { userId, symbol: toSymbol } },
      create: {
        userId,
        symbol: toSymbol,
        name: toName || toSymbol,
        amount: toAmount,
        avgPrice: toPrice,
        type: 'crypto',
      },
      update: {
        amount: newToAmount,
        avgPrice: newAvgPrice,
      },
    })

    // 3. Record the swap as two trades (sell + buy)
    const sellTrade = await tx.trade.create({
      data: {
        userId,
        symbol: fromSymbol,
        side: 'sell',
        amount: fromAmount,
        price: fromPrice,
        total: fromValueUsd,
      },
    })

    const buyTrade = await tx.trade.create({
      data: {
        userId,
        symbol: toSymbol,
        side: 'buy',
        amount: toAmount,
        price: toPrice,
        total: netValueUsd,
      },
    })

    return { sellTrade, buyTrade, toAmount, feeUsd }
  }, {
    timeout: 20_000,
    maxWait: 10_000,
  }).catch((err: Error & { status?: number }) => ({ 
    error: err.message, 
    status: err.status || 500 
  }))

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }

  const swapper = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
  if (swapper) {
    void notifyTransaction(swapper, {
      id: result.buyTrade.id,
      type: 'Swap',
      amount: `${fromAmount} ${fromSymbol} → ${result.toAmount.toFixed(8)} ${toSymbol}`,
      currency: 'USD',
      from: fromSymbol,
      to: toSymbol,
      fee: String(result.feeUsd),
    })
  }

  res.status(201).json({
    swap: {
      from: { symbol: fromSymbol, amount: fromAmount, valueUsd: fromAmount * fromPrice },
      to: { symbol: toSymbol, amount: result.toAmount, valueUsd: result.toAmount * toPrice },
      feeUsd: result.feeUsd,
      feeRate: SWAP_FEE_RATE,
    },
    trades: [result.sellTrade, result.buyTrade],
  })
})

export default router
