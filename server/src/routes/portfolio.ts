import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

interface PortfolioAsset {
  symbol: string
  amount: number
  avgPrice: number
  currentPrice?: number
  value: number
  gainLoss: number
  gainLossPercent: number
  allocation: number
}

router.get('/summary', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.userId! },
    })

    if (holdings.length === 0) {
      res.json({
        totalInvested: 0,
        currentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        assets: [],
        allocation: {},
      })
      return
    }

    let totalInvested = 0
    let totalValue = 0
    const assets: PortfolioAsset[] = []

    holdings.forEach((h) => {
      const invested = h.amount * h.avgPrice
      const value = h.amount * h.avgPrice // In real app, use current price
      const gainLoss = value - invested
      const gainLossPercent = invested > 0 ? (gainLoss / invested) * 100 : 0

      totalInvested += invested
      totalValue += value

      assets.push({
        symbol: h.symbol,
        amount: h.amount,
        avgPrice: h.avgPrice,
        value,
        gainLoss,
        gainLossPercent,
        allocation: 0,
      })
    })

    // Calculate allocations
    assets.forEach((a) => {
      a.allocation = totalValue > 0 ? (a.value / totalValue) * 100 : 0
    })

    const totalGainLoss = totalValue - totalInvested
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

    const allocation: Record<string, number> = {}
    assets.forEach((a) => {
      allocation[a.symbol] = a.allocation
    })

    // Update or create portfolio record
    await prisma.investmentPortfolio.upsert({
      where: { userId: req.userId! },
      create: {
        userId: req.userId!,
        totalInvested,
        currentValue: totalValue,
        totalGainLoss,
        totalGainLossPercent,
      },
      update: {
        totalInvested,
        currentValue: totalValue,
        totalGainLoss,
        totalGainLossPercent,
      },
    })

    res.json({
      totalInvested,
      currentValue: totalValue,
      totalGainLoss,
      totalGainLossPercent,
      assets: assets.sort((a, b) => b.value - a.value),
      allocation,
    })
  } catch (error) {
    console.error('Portfolio summary error:', error)
    res.status(500).json({ error: 'Failed to calculate portfolio' })
  }
})

router.get('/allocation', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const portfolio = await prisma.investmentPortfolio.findUnique({
      where: { userId: req.userId! },
    })

    const holdings = await prisma.holding.findMany({
      where: { userId: req.userId! },
    })

    let totalValue = 0
    holdings.forEach((h) => {
      totalValue += h.amount * h.avgPrice
    })

    const current: Record<string, number> = {}
    holdings.forEach((h) => {
      const value = h.amount * h.avgPrice
      current[h.symbol] = totalValue > 0 ? (value / totalValue) * 100 : 0
    })

    const target = portfolio?.targetAllocation ? JSON.parse(portfolio.targetAllocation) : {}

    const variance: Record<string, number> = {}
    Object.keys({ ...current, ...target }).forEach((symbol) => {
      variance[symbol] = (current[symbol] ?? 0) - (target[symbol] ?? 0)
    })

    res.json({
      current,
      target,
      variance,
      rebalanceFrequency: portfolio?.rebalanceFrequency ?? 'monthly',
      lastRebalancedAt: portfolio?.lastRebalancedAt,
    })
  } catch (error) {
    console.error('Allocation error:', error)
    res.status(500).json({ error: 'Failed to calculate allocation' })
  }
})

router.get('/performance', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30

    const balanceHistory = await prisma.balanceHistory.findMany({
      where: {
        userId: req.userId!,
        snapshotAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotAt: 'asc' },
    })

    const timeline: Array<{
      date: string
      value: number
      gainLoss: number
      gainLossPercent: number
    }> = []

    const valueByDate: Record<string, number> = {}
    balanceHistory.forEach((h) => {
      const date = h.snapshotAt.toISOString().split('T')[0]!
      valueByDate[date] = (valueByDate[date] ?? 0) + h.totalWorthUsd
    })

    const firstValue = Object.values(valueByDate)[0] ?? 0
    Object.entries(valueByDate).forEach(([date, value]) => {
      const gainLoss = value - firstValue
      const gainLossPercent = firstValue > 0 ? (gainLoss / firstValue) * 100 : 0
      timeline.push({ date, value, gainLoss, gainLossPercent })
    })

    res.json({ timeline, days })
  } catch (error) {
    console.error('Performance error:', error)
    res.status(500).json({ error: 'Failed to calculate performance' })
  }
})

router.post('/rebalance-suggestion', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { targetAllocation } = z.object({
      targetAllocation: z.record(z.number()),
    }).parse(req.body)

    const holdings = await prisma.holding.findMany({
      where: { userId: req.userId! },
    })

    let totalValue = 0
    holdings.forEach((h) => {
      totalValue += h.amount * h.avgPrice
    })

    const suggestions: Array<{
      symbol: string
      currentAllocation: number
      targetAllocation: number
      variance: number
      action: 'buy' | 'sell' | 'hold'
      suggestedAmount: number
    }> = []

    Object.entries(targetAllocation).forEach(([symbol, target]) => {
      const holding = holdings.find((h) => h.symbol === symbol)
      const currentValue = holding ? holding.amount * holding.avgPrice : 0
      const currentAllocation = totalValue > 0 ? (currentValue / totalValue) * 100 : 0
      const variance = currentAllocation - target
      const targetValue = (target / 100) * totalValue
      const suggestedAmount = Math.abs(targetValue - currentValue)

      let action: 'buy' | 'sell' | 'hold' = 'hold'
      if (variance < -2) action = 'buy'
      if (variance > 2) action = 'sell'

      suggestions.push({
        symbol,
        currentAllocation,
        targetAllocation: target,
        variance,
        action,
        suggestedAmount,
      })
    })

    res.json({ suggestions })
  } catch (error) {
    console.error('Rebalance suggestion error:', error)
    res.status(500).json({ error: 'Failed to generate suggestions' })
  }
})

router.put('/target-allocation', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { allocation, frequency } = z.object({
      allocation: z.record(z.number()),
      frequency: z.enum(['weekly', 'monthly', 'quarterly']).optional(),
    }).parse(req.body)

    const portfolio = await prisma.investmentPortfolio.upsert({
      where: { userId: req.userId! },
      create: {
        userId: req.userId!,
        targetAllocation: JSON.stringify(allocation),
        rebalanceFrequency: frequency ?? 'monthly',
      },
      update: {
        targetAllocation: JSON.stringify(allocation),
        rebalanceFrequency: frequency ?? 'monthly',
      },
    })

    res.json({ portfolio })
  } catch (error) {
    console.error('Target allocation error:', error)
    res.status(500).json({ error: 'Failed to update allocation' })
  }
})

export default router
