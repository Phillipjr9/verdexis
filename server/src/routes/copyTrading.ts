import { Router } from 'express'
import { prisma } from '../db.js'
import jwt from 'jsonwebtoken'

const router = Router()

// Middleware to extract userId from JWT
function auth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { sub: string }
    req.userId = decoded.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// GET /api/copy-trading/leaderboard
// Returns top traders sorted by ROI
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
    const period = (req.query.period as string) || '30d'
    
    const sortField = period === '90d' ? 'roi90d' : period === 'all' ? 'roisAllTime' : 'roi30d'
    
    const traders = await prisma.traderProfile.findMany({
      where: {
        isPublic: true,
        allowCopying: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { [sortField]: 'desc' },
      take: limit,
    })

    res.json({
      traders: traders.map((t, idx) => ({
        id: t.id,
        userId: t.userId,
        displayName: t.displayName,
        bio: t.bio,
        rank: t.rank || idx + 1,
        roi30d: t.roi30d,
        roi90d: t.roi90d,
        roiAllTime: t.roisAllTime,
        winRate: t.winRate,
        totalTrades: t.totalTrades,
        totalCopiers: t.totalCopiers,
        activeCopiers: t.activeCopiers,
        verified: t.verified,
        performanceFee: t.performanceFee,
        minCopyAmount: t.minCopyAmount,
        maxCopiers: t.maxCopiers,
        lastTradeAt: t.lastTradeAt,
        user: {
          name: t.user.name,
          username: t.user.username,
          avatar: t.user.avatar,
        },
      })),
    })
  } catch (err) {
    console.error('[copy-trading] leaderboard error:', err)
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
})

// GET /api/copy-trading/trader/:userId
// Get detailed trader profile
router.get('/trader/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    const profile = await prisma.traderProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
    })

    if (!profile || !profile.isPublic) {
      return res.status(404).json({ error: 'Trader not found' })
    }

    // Get recent trades (last 20)
    const recentTrades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        symbol: true,
        side: true,
        amount: true,
        price: true,
        total: true,
        createdAt: true,
      },
    })

    // Get copier count
    const copiers = await prisma.copyRelationship.count({
      where: {
        traderId: userId,
        status: 'active',
      },
    })

    res.json({
      profile: {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        bio: profile.bio,
        verified: profile.verified,
        roi30d: profile.roi30d,
        roi90d: profile.roi90d,
        roiAllTime: profile.roisAllTime,
        winRate: profile.winRate,
        totalTrades: profile.totalTrades,
        totalPnl: profile.totalPnl,
        totalPnlPercent: profile.totalPnlPercent,
        activeCopiers: copiers,
        performanceFee: profile.performanceFee,
        minCopyAmount: profile.minCopyAmount,
        maxCopiers: profile.maxCopiers,
        allowCopying: profile.allowCopying,
        lastTradeAt: profile.lastTradeAt,
        createdAt: profile.createdAt,
        user: profile.user,
      },
      recentTrades,
    })
  } catch (err) {
    console.error('[copy-trading] trader detail error:', err)
    res.status(500).json({ error: 'Failed to fetch trader' })
  }
})

// GET /api/copy-trading/my-profile
// Get or create current user's trader profile
router.get('/my-profile', auth, async (req: any, res) => {
  try {
    let profile = await prisma.traderProfile.findUnique({
      where: { userId: req.userId },
    })

    if (!profile) {
      // Auto-create profile
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { name: true, username: true },
      })

      profile = await prisma.traderProfile.create({
        data: {
          userId: req.userId,
          displayName: user?.username || user?.name || 'Trader',
        },
      })
    }

    res.json({ profile })
  } catch (err) {
    console.error('[copy-trading] my-profile error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PATCH /api/copy-trading/my-profile
// Update trader profile settings
router.patch('/my-profile', auth, async (req: any, res) => {
  try {
    const { displayName, bio, isPublic, allowCopying, minCopyAmount, maxCopiers, performanceFee } = req.body

    const updates: any = {}
    if (displayName !== undefined) updates.displayName = String(displayName).slice(0, 50)
    if (bio !== undefined) updates.bio = String(bio).slice(0, 500)
    if (typeof isPublic === 'boolean') updates.isPublic = isPublic
    if (typeof allowCopying === 'boolean') updates.allowCopying = allowCopying
    if (typeof minCopyAmount === 'number') updates.minCopyAmount = Math.max(0, minCopyAmount)
    if (typeof maxCopiers === 'number') updates.maxCopiers = Math.max(1, Math.min(1000, maxCopiers))
    if (typeof performanceFee === 'number') updates.performanceFee = Math.max(0, Math.min(30, performanceFee))

    const profile = await prisma.traderProfile.upsert({
      where: { userId: req.userId },
      update: updates,
      create: {
        userId: req.userId,
        displayName: displayName || 'Trader',
        ...updates,
      },
    })

    res.json({ profile })
  } catch (err) {
    console.error('[copy-trading] update profile error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// GET /api/copy-trading/following
// Get users I'm copying
router.get('/following', auth, async (req: any, res) => {
  try {
    const relationships = await prisma.copyRelationship.findMany({
      where: { followerId: req.userId },
      include: {
        trader: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      following: relationships.map(r => ({
        id: r.id,
        traderId: r.traderId,
        traderName: r.trader.name,
        traderUsername: r.trader.username,
        traderAvatar: r.trader.avatar,
        allocationUsd: r.allocationUsd,
        allocationPercent: r.allocationPercent,
        status: r.status,
        totalCopied: r.totalCopied,
        totalPnl: r.totalPnl,
        totalPnlPercent: r.totalPnlPercent,
        copyCount: r.copyCount,
        pausedAt: r.pausedAt,
        createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    console.error('[copy-trading] following error:', err)
    res.status(500).json({ error: 'Failed to fetch following' })
  }
})

// GET /api/copy-trading/followers
// Get users copying me
router.get('/followers', auth, async (req: any, res) => {
  try {
    const relationships = await prisma.copyRelationship.findMany({
      where: { traderId: req.userId },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      followers: relationships.map(r => ({
        id: r.id,
        followerId: r.followerId,
        followerName: r.follower.name,
        followerUsername: r.follower.username,
        followerAvatar: r.follower.avatar,
        allocationUsd: r.allocationUsd,
        status: r.status,
        totalCopied: r.totalCopied,
        copyCount: r.copyCount,
        createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    console.error('[copy-trading] followers error:', err)
    res.status(500).json({ error: 'Failed to fetch followers' })
  }
})

// POST /api/copy-trading/follow
// Start copying a trader
router.post('/follow', auth, async (req: any, res) => {
  try {
    const { traderId, allocationUsd, allocationPercent = 100 } = req.body

    if (!traderId) return res.status(400).json({ error: 'traderId required' })
    if (traderId === req.userId) return res.status(400).json({ error: 'Cannot copy yourself' })
    if (!allocationUsd || allocationUsd < 10) return res.status(400).json({ error: 'Minimum allocation is $10' })

    // Check if trader exists and allows copying
    const traderProfile = await prisma.traderProfile.findUnique({
      where: { userId: traderId },
    })

    if (!traderProfile || !traderProfile.allowCopying) {
      return res.status(400).json({ error: 'Trader not available for copying' })
    }

    if (allocationUsd < traderProfile.minCopyAmount) {
      return res.status(400).json({ error: `Minimum copy amount is $${traderProfile.minCopyAmount}` })
    }

    // Check copier limit
    const currentCopiers = await prisma.copyRelationship.count({
      where: { traderId, status: 'active' },
    })

    if (currentCopiers >= traderProfile.maxCopiers) {
      return res.status(400).json({ error: 'Trader has reached maximum copiers' })
    }

    // Create relationship
    const relationship = await prisma.copyRelationship.create({
      data: {
        followerId: req.userId,
        traderId,
        allocationUsd,
        allocationPercent: Math.min(100, Math.max(0, allocationPercent)),
      },
    })

    // Update copier count
    await prisma.traderProfile.update({
      where: { userId: traderId },
      data: { activeCopiers: { increment: 1 } },
    })

    return res.json({ relationship })
  } catch (err) {
    console.error('[copy-trading] follow error:', err)
    return res.status(500).json({ error: 'Failed to start copying' })
  }
})

// POST /api/copy-trading/unfollow
// Stop copying a trader
router.post('/unfollow', auth, async (req: any, res) => {
  try {
    const { traderId } = req.body

    const relationship = await prisma.copyRelationship.findUnique({
      where: {
        followerId_traderId: {
          followerId: req.userId,
          traderId,
        },
      },
    })

    if (!relationship) {
      return res.status(404).json({ error: 'Not following this trader' })
    }

    await prisma.copyRelationship.update({
      where: { id: relationship.id },
      data: { status: 'stopped', pausedAt: new Date() },
    })

    // Update copier count
    await prisma.traderProfile.update({
      where: { userId: traderId },
      data: { activeCopiers: { decrement: 1 } },
    })

    res.json({ success: true })
  } catch (err) {
    console.error('[copy-trading] unfollow error:', err)
    res.status(500).json({ error: 'Failed to stop copying' })
  }
})

// GET /api/copy-trading/my-copy-trades
// Get my copy trade history
router.get('/my-copy-trades', auth, async (req: any, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
    
    const copyTrades = await prisma.copyTrade.findMany({
      where: { followerId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    res.json({ copyTrades })
  } catch (err) {
    console.error('[copy-trading] copy trades error:', err)
    res.status(500).json({ error: 'Failed to fetch copy trades' })
  }
})

export default router
