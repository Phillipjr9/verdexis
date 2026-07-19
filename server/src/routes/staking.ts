import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

const stakingSchema = z.object({
  asset: z.string().min(1).max(12),
  amount: z.number().positive().max(1_000_000),
  apy: z.number().positive().max(100),
  yieldFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
})

router.post('/positions', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = stakingSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { asset, amount, apy, yieldFrequency } = parsed.data

    const result = await prisma.$transaction(async (tx) => {
      // Check balance
      const balance = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId: req.userId!, currency: asset } },
      })
      if (!balance || balance.available < amount) {
        throw Object.assign(new Error('Insufficient balance'), { status: 400 })
      }

      // Create staking position
      const position = await tx.stakingPosition.create({
        data: {
          userId: req.userId!,
          asset,
          amount,
          apy,
          yieldFrequency: yieldFrequency ?? 'daily',
        },
      })

      // Lock balance
      await tx.walletBalance.update({
        where: { id: balance.id },
        data: { available: balance.available - amount },
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: req.userId!,
          kind: 'staking',
          currency: asset,
          amount,
          status: 'completed',
          reference: position.id,
        },
      })

      // Notify user
      await tx.notification.create({
        data: {
          userId: req.userId!,
          kind: 'staking',
          title: `Staking started: ${amount} ${asset}`,
          body: `APY: ${apy}%. Yield frequency: ${yieldFrequency ?? 'daily'}`,
        },
      })

      return position
    })

    res.status(201).json({ position: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    res.status(error.status || 500).json({ error: error.message })
  }
})

router.get('/positions', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const positions = await prisma.stakingPosition.findMany({
      where: { userId: req.userId! },
      include: { yieldRewards: { orderBy: { earnedAt: 'desc' }, take: 10 } },
      orderBy: { startedAt: 'desc' },
    })

    const enriched = positions.map((p) => ({
      ...p,
      status: p.unstakedAt ? 'unstaked' : 'active',
      totalYieldEarned: p.totalYieldEarned,
      yieldRewards: p.yieldRewards,
    }))

    res.json({ positions: enriched })
  } catch (error) {
    console.error('Staking positions error:', error)
    res.status(500).json({ error: 'Failed to fetch positions' })
  }
})

router.get('/positions/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const position = await prisma.stakingPosition.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { yieldRewards: { orderBy: { earnedAt: 'desc' } } },
    })

    if (!position) {
      res.status(404).json({ error: 'Position not found' })
      return
    }

    res.json({ position })
  } catch (error) {
    console.error('Staking position error:', error)
    res.status(500).json({ error: 'Failed to fetch position' })
  }
})

router.post('/positions/:id/unstake', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const position = await tx.stakingPosition.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      })

      if (!position) {
        throw Object.assign(new Error('Position not found'), { status: 404 })
      }
      if (position.unstakedAt) {
        throw Object.assign(new Error('Position already unstaked'), { status: 400 })
      }

      // Update position
      const updated = await tx.stakingPosition.update({
        where: { id: req.params.id },
        data: { unstakedAt: new Date() },
      })

      // Unlock balance
      const balance = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId: req.userId!, currency: position.asset } },
      })
      if (balance) {
        await tx.walletBalance.update({
          where: { id: balance.id },
          data: { available: balance.available + position.amount },
        })
      }

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: req.userId!,
          kind: 'unstaking',
          currency: position.asset,
          amount: position.amount,
          status: 'completed',
          reference: position.id,
        },
      })

      // Notify user
      await tx.notification.create({
        data: {
          userId: req.userId!,
          kind: 'staking',
          title: `Unstaking completed: ${position.amount} ${position.asset}`,
          body: `Total yield earned: ${position.totalYieldEarned} ${position.asset}`,
        },
      })

      return updated
    })

    res.json({ position: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    res.status(error.status || 500).json({ error: error.message })
  }
})

router.get('/rewards', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rewards = await prisma.yieldReward.findMany({
      where: { userId: req.userId! },
      include: { stakingPosition: true },
      orderBy: { earnedAt: 'desc' },
      take: 100,
    })

    const summary = {
      totalEarned: 0,
      totalClaimed: 0,
      byCurrency: {} as Record<string, { earned: number; claimed: number }>,
    }

    rewards.forEach((r) => {
      summary.totalEarned += r.amount
      if (r.claimedAt) summary.totalClaimed += r.amount

      if (!summary.byCurrency[r.asset]) {
        summary.byCurrency[r.asset] = { earned: 0, claimed: 0 }
      }
      summary.byCurrency[r.asset]!.earned += r.amount
      if (r.claimedAt) summary.byCurrency[r.asset]!.claimed += r.amount
    })

    res.json({ rewards, summary })
  } catch (error) {
    console.error('Rewards error:', error)
    res.status(500).json({ error: 'Failed to fetch rewards' })
  }
})

router.post('/rewards/:id/claim', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reward = await tx.yieldReward.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      })

      if (!reward) {
        throw Object.assign(new Error('Reward not found'), { status: 404 })
      }
      if (reward.claimedAt) {
        throw Object.assign(new Error('Reward already claimed'), { status: 400 })
      }

      // Update reward
      const updated = await tx.yieldReward.update({
        where: { id: req.params.id },
        data: { claimedAt: new Date() },
      })

      // Add to balance
      const balance = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId: req.userId!, currency: reward.asset } },
      })
      if (balance) {
        await tx.walletBalance.update({
          where: { id: balance.id },
          data: {
            balance: balance.balance + reward.amount,
            available: balance.available + reward.amount,
          },
        })
      } else {
        await tx.walletBalance.create({
          data: {
            userId: req.userId!,
            currency: reward.asset,
            symbol: reward.asset,
            balance: reward.amount,
            available: reward.amount,
          },
        })
      }

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: req.userId!,
          kind: 'yield_claim',
          currency: reward.asset,
          amount: reward.amount,
          status: 'completed',
          reference: reward.id,
        },
      })

      // Notify user
      await tx.notification.create({
        data: {
          userId: req.userId!,
          kind: 'staking',
          title: `Yield claimed: ${reward.amount} ${reward.asset}`,
          body: `Reward has been added to your balance`,
        },
      })

      return updated
    })

    res.json({ reward: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    res.status(error.status || 500).json({ error: error.message })
  }
})

export default router
