import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

// Dashboard stats
router.get('/dashboard/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [
      totalUsers,
      totalWithdrawals,
      pendingWithdrawals,
      totalStakingPositions,
      activeStakingPositions,
      totalYieldEarned,
      portfoliosCreated,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.withdrawalRequest.count(),
      prisma.withdrawalRequest.count({ where: { status: 'pending' } }),
      prisma.stakingPosition.count(),
      prisma.stakingPosition.count({ where: { unstakedAt: null } }),
      prisma.yieldReward.aggregate({ _sum: { amount: true } }),
      prisma.investmentPortfolio.count(),
    ])

    res.json({
      users: totalUsers,
      withdrawals: {
        total: totalWithdrawals,
        pending: pendingWithdrawals,
      },
      staking: {
        totalPositions: totalStakingPositions,
        activePositions: activeStakingPositions,
        totalYieldEarned: totalYieldEarned._sum.amount ?? 0,
      },
      portfolios: portfoliosCreated,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Withdrawals management
router.get('/withdrawals/pending', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const pending = await prisma.withdrawalRequest.findMany({
      where: { status: 'pending' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        walletLink: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    res.json({ withdrawals: pending })
  } catch (error) {
    console.error('Pending withdrawals error:', error)
    res.status(500).json({ error: 'Failed to fetch withdrawals' })
  }
})

router.get('/withdrawals/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const stats = await prisma.withdrawalRequest.groupBy({
      by: ['status'],
      _count: true,
      _sum: { amount: true },
    })

    const byAsset = await prisma.withdrawalRequest.groupBy({
      by: ['asset'],
      _count: true,
      _sum: { amount: true },
    })

    res.json({ byStatus: stats, byAsset })
  } catch (error) {
    console.error('Withdrawal stats error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Staking management
router.get('/staking/positions', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const positions = await prisma.stakingPosition.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        yieldRewards: { take: 5 },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    })

    res.json({ positions })
  } catch (error) {
    console.error('Staking positions error:', error)
    res.status(500).json({ error: 'Failed to fetch positions' })
  }
})

router.get('/staking/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [totalPositions, activePositions, totalAmount, totalYield] = await Promise.all([
      prisma.stakingPosition.count(),
      prisma.stakingPosition.count({ where: { unstakedAt: null } }),
      prisma.stakingPosition.aggregate({ _sum: { amount: true } }),
      prisma.yieldReward.aggregate({ _sum: { amount: true } }),
    ])

    const byAsset = await prisma.stakingPosition.groupBy({
      by: ['asset'],
      _count: true,
      _sum: { amount: true },
    })

    res.json({
      totalPositions,
      activePositions,
      totalAmount: totalAmount._sum.amount ?? 0,
      totalYield: totalYield._sum.amount ?? 0,
      byAsset,
    })
  } catch (error) {
    console.error('Staking stats error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Portfolio management
router.get('/portfolios', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const portfolios = await prisma.investmentPortfolio.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    res.json({ portfolios })
  } catch (error) {
    console.error('Portfolios error:', error)
    res.status(500).json({ error: 'Failed to fetch portfolios' })
  }
})

router.get('/portfolios/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const stats = await prisma.investmentPortfolio.aggregate({
      _sum: {
        totalInvested: true,
        currentValue: true,
        totalGainLoss: true,
      },
      _avg: {
        totalGainLossPercent: true,
      },
    })

    res.json({
      totalInvested: stats._sum.totalInvested ?? 0,
      currentValue: stats._sum.currentValue ?? 0,
      totalGainLoss: stats._sum.totalGainLoss ?? 0,
      avgGainLossPercent: stats._avg.totalGainLossPercent ?? 0,
    })
  } catch (error) {
    console.error('Portfolio stats error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Wallet verification management
router.get('/wallet-verifications', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const verifications = await prisma.walletVerification.findMany({
      include: {
        walletLink: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    res.json({ verifications })
  } catch (error) {
    console.error('Wallet verifications error:', error)
    res.status(500).json({ error: 'Failed to fetch verifications' })
  }
})

router.get('/wallet-verifications/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const total = await prisma.walletVerification.count()
    const verified = await prisma.walletVerification.count({ where: { verifiedAt: { not: null } } })
    const pending = total - verified

    res.json({ total, verified, pending })
  } catch (error) {
    console.error('Verification stats error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Transaction exports management
router.get('/transaction-exports', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const exports = await prisma.transactionExport.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    res.json({ exports })
  } catch (error) {
    console.error('Transaction exports error:', error)
    res.status(500).json({ error: 'Failed to fetch exports' })
  }
})

// User limits management
router.get('/users/:userId/limits-summary', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const [depositLimits, withdrawalLimits] = await Promise.all([
      prisma.depositLimit.findMany({ where: { userId: req.params.userId } }),
      prisma.withdrawalLimit.findMany({ where: { userId: req.params.userId } }),
    ])

    res.json({ depositLimits, withdrawalLimits })
  } catch (error) {
    console.error('User limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

// Compliance reports
router.get('/compliance/deposits', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const deposits = await prisma.pendingDeposit.findMany({
      where: { createdAt: { gte: startDate } },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const summary = {
      total: deposits.length,
      byStatus: {} as Record<string, number>,
      totalAmount: 0,
      byAsset: {} as Record<string, number>,
    }

    deposits.forEach((d) => {
      summary.byStatus[d.status] = (summary.byStatus[d.status] ?? 0) + 1
      summary.totalAmount += d.amount
      summary.byAsset[d.asset] = (summary.byAsset[d.asset] ?? 0) + d.amount
    })

    res.json({ deposits, summary })
  } catch (error) {
    console.error('Compliance deposits error:', error)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

router.get('/compliance/withdrawals', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { createdAt: { gte: startDate } },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const summary = {
      total: withdrawals.length,
      byStatus: {} as Record<string, number>,
      totalAmount: 0,
      byAsset: {} as Record<string, number>,
    }

    withdrawals.forEach((w) => {
      summary.byStatus[w.status] = (summary.byStatus[w.status] ?? 0) + 1
      summary.totalAmount += w.amount
      summary.byAsset[w.asset] = (summary.byAsset[w.asset] ?? 0) + w.amount
    })

    res.json({ withdrawals, summary })
  } catch (error) {
    console.error('Compliance withdrawals error:', error)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

router.get('/compliance/staking', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const positions = await prisma.stakingPosition.findMany({
      where: { createdAt: { gte: startDate } },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const summary = {
      total: positions.length,
      active: positions.filter((p) => !p.unstakedAt).length,
      totalAmount: positions.reduce((sum, p) => sum + p.amount, 0),
      totalYield: positions.reduce((sum, p) => sum + p.totalYieldEarned, 0),
      byAsset: {} as Record<string, { count: number; amount: number }>,
    }

    positions.forEach((p) => {
      const bucket = summary.byAsset[p.asset] ?? { count: 0, amount: 0 }
      bucket.count += 1
      bucket.amount += p.amount
      summary.byAsset[p.asset] = bucket
    })

    res.json({ positions, summary })
  } catch (error) {
    console.error('Compliance staking error:', error)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

export default router
