import { prisma } from './db.js'
import { Request, Response, NextFunction } from 'express'

/**
 * VERDEXIS Database Query Optimizer & Monitoring
 * Week 2: Performance optimization
 */

export interface QueryMetrics {
  query: string
  duration: number
  rows: number
  timestamp: Date
  slow: boolean
}

const SLOW_QUERY_THRESHOLD = 1000 // 1 second in ms
const queryMetrics: QueryMetrics[] = []

/**
 * Query Performance Monitoring Middleware
 * Tracks all database queries and identifies slow ones
 */
export function monitorPrismaQueries() {
  const originalQuery = (prisma as any).$queryRaw
  
  return async function <T>(
    query: TemplateStringsArray | string,
    ...values: any[]
  ): Promise<T> {
    const startTime = Date.now()
    try {
      const result = await originalQuery.apply(prisma, [query, ...values])
      const duration = Date.now() - startTime
      
      recordQueryMetric({
        query: typeof query === 'string' ? query : query.join('?'),
        duration,
        rows: Array.isArray(result) ? result.length : 1,
        timestamp: new Date(),
        slow: duration > SLOW_QUERY_THRESHOLD,
      })
      
      if (duration > SLOW_QUERY_THRESHOLD) {
        console.warn(`[db] Slow query (${duration}ms): ${typeof query === 'string' ? query : query[0]}`)
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[db] Query failed (${duration}ms):`, error)
      throw error
    }
  }
}

/**
 * Record query metrics
 */
function recordQueryMetric(metric: QueryMetrics) {
  queryMetrics.push(metric)
  
  // Keep only last 1000 metrics in memory
  if (queryMetrics.length > 1000) {
    queryMetrics.shift()
  }
}

/**
 * Get query performance stats
 */
export function getQueryStats() {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      slowQueries: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: 0,
    }
  }

  const slowQueries = queryMetrics.filter(m => m.slow)
  const durations = queryMetrics.map(m => m.duration)

  return {
    totalQueries: queryMetrics.length,
    slowQueries: slowQueries.length,
    slowPercentage: ((slowQueries.length / queryMetrics.length) * 100).toFixed(2) + '%',
    averageTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    maxTime: Math.max(...durations),
    minTime: Math.min(...durations),
    recentMetrics: queryMetrics.slice(-10),
  }
}

/**
 * Optimized pagination helper
 */
export function getPaginationParams(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Pagination middleware
 */
export function paginationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { page, limit, skip } = getPaginationParams(req)
  
  res.locals.pagination = {
    page,
    limit,
    skip,
  }
  
  next()
}

/**
 * Optimized user queries
 */
export const optimizedQueries = {
  // Get user with relations efficiently
  async getUserWithRelations(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        suspended: true,
        kycStatus: true,
        kycTier: true,
        dailyWithdrawLimit: true,
        monthlyWithdrawLimit: true,
        createdAt: true,
      },
    })
  },

  // Get user portfolio efficiently
  async getUserPortfolio(userId: string) {
    const [holdings, walletBalances, trades] = await Promise.all([
      prisma.holding.findMany({
        where: { userId },
        select: {
          id: true,
          symbol: true,
          amount: true,
          avgPrice: true,
        },
      }),
      prisma.walletBalance.findMany({
        where: { userId },
        select: {
          currency: true,
          balance: true,
          available: true,
        },
      }),
      prisma.trade.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          symbol: true,
          side: true,
          amount: true,
          price: true,
          createdAt: true,
        },
      }),
    ])

    return { holdings, walletBalances, trades }
  },

  // Get transactions with pagination
  async getUserTransactions(userId: string, skip: number, limit: number) {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          kind: true,
          currency: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.transaction.count({ where: { userId } }),
    ])

    return {
      transactions,
      total,
      pages: Math.ceil(total / limit),
    }
  },

  // Get orders with pagination
  async getUserOrders(userId: string, skip: number, limit: number, status?: string) {
    const where = { userId, ...(status && { status }) }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          symbol: true,
          side: true,
          type: true,
          status: true,
          basePrice: true,
          amount: true,
          filledAmount: true,
          limitPrice: true,
          stopPrice: true,
          createdAt: true,
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders,
      total,
      pages: Math.ceil(total / limit),
    }
  },

  // Get watchlist with pagination
  async getUserWatchlist(userId: string, skip: number, limit: number) {
    const [watchlist, total] = await Promise.all([
      prisma.watchlist.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          symbol: true,
          name: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.watchlist.count({ where: { userId } }),
    ])

    return {
      watchlist,
      total,
      pages: Math.ceil(total / limit),
    }
  },

  // Get alerts with pagination
  async getUserAlerts(userId: string, skip: number, limit: number, active?: boolean) {
    const where = { userId, ...(active !== undefined && { active }) }

    const [alerts, total] = await Promise.all([
      prisma.priceAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          symbol: true,
          direction: true,
          target: true,
          active: true,
          triggered: true,
          createdAt: true,
        },
      }),
      prisma.priceAlert.count({ where }),
    ])

    return {
      alerts,
      total,
      pages: Math.ceil(total / limit),
    }
  },

  // Batch get users for admin
  async getUsersBatch(skip: number, limit: number, kycStatus?: string) {
    const where = kycStatus ? { kycStatus } : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          kycStatus: true,
          kycTier: true,
          suspended: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return {
      users,
      total,
      pages: Math.ceil(total / limit),
    }
  },

  // Get trades for analytics
  async getTradesAnalytics(userId: string, startDate: Date, endDate: Date) {
    return prisma.trade.groupBy({
      by: ['symbol', 'side'],
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
        total: true,
      },
      _count: true,
      _avg: {
        price: true,
      },
    })
  },

  // Count pending transactions
  async getPendingTransactionCount(userId: string) {
    return prisma.transaction.count({
      where: {
        userId,
        status: 'pending',
      },
    })
  },
}

/**
 * Database connection pool status
 */
export async function getConnectionPoolStatus() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`
    return {
      status: 'connected',
      timestamp: new Date(),
    }
  } catch (error) {
    return {
      status: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date(),
    }
  }
}

/**
 * Health check endpoint for database
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: Record<string, any>
}> {
  try {
    const connectionStatus = await getConnectionPoolStatus()
    const queryStats = getQueryStats()
    
    const slowPercentage = queryStats.slowQueries > 0
      ? (queryStats.slowQueries / queryStats.totalQueries) * 100
      : 0

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (connectionStatus.status !== 'connected') {
      status = 'unhealthy'
    } else if (slowPercentage > 10 || queryStats.averageTime > 500) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        connection: connectionStatus,
        queries: queryStats,
        slowPercentage: slowPercentage.toFixed(2) + '%',
      },
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: (error as Error).message,
      },
    }
  }
}

export default {
  monitorPrismaQueries,
  getQueryStats,
  getPaginationParams,
  paginationMiddleware,
  optimizedQueries,
  getConnectionPoolStatus,
  healthCheck,
}
