import { prisma } from '../db.js'

export interface RateLimit {
  endpoint: string
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstAllowance: number
}

export interface UserQuota {
  userId: string
  dailyTransactionLimit: number
  monthlyTransactionLimit: number
  dailyWithdrawalLimit: number
  monthlyWithdrawalLimit: number
  apiCallsPerDay: number
}

export interface RateLimitStatus {
  remaining: number
  limit: number
  resetAt: Date
  retryAfter?: number
}

export class RateLimitService {
  private static readonly DEFAULT_LIMITS: Record<string, RateLimit> = {
    '/api/auth/login': { endpoint: '/api/auth/login', requestsPerMinute: 5, requestsPerHour: 30, requestsPerDay: 100, burstAllowance: 2 },
    '/api/otp/send-otp': { endpoint: '/api/otp/send-otp', requestsPerMinute: 1, requestsPerHour: 5, requestsPerDay: 20, burstAllowance: 1 },
    '/api/trades': { endpoint: '/api/trades', requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 1000, burstAllowance: 5 },
    '/api/wallet/withdraw': { endpoint: '/api/wallet/withdraw', requestsPerMinute: 2, requestsPerHour: 10, requestsPerDay: 50, burstAllowance: 1 },
  }

  /**
   * Check rate limit
   */
  static async checkRateLimit(userId: string, endpoint: string): Promise<{ allowed: boolean; status: RateLimitStatus }> {
    const limit = this.DEFAULT_LIMITS[endpoint] || this.DEFAULT_LIMITS['/api/auth/login']

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [requestsLastMinute, requestsLastHour, requestsLastDay] = await Promise.all([
      prisma.rateLimitLog.count({
        where: { userId, endpoint, createdAt: { gte: oneMinuteAgo } },
      }),
      prisma.rateLimitLog.count({
        where: { userId, endpoint, createdAt: { gte: oneHourAgo } },
      }),
      prisma.rateLimitLog.count({
        where: { userId, endpoint, createdAt: { gte: oneDayAgo } },
      }),
    ])

    const minuteAllowed = requestsLastMinute < limit.requestsPerMinute
    const hourAllowed = requestsLastHour < limit.requestsPerHour
    const dayAllowed = requestsLastDay < limit.requestsPerDay

    const allowed = minuteAllowed && hourAllowed && dayAllowed

    const resetAt = new Date(now.getTime() + 60 * 1000)

    return {
      allowed,
      status: {
        remaining: Math.max(0, limit.requestsPerMinute - requestsLastMinute),
        limit: limit.requestsPerMinute,
        resetAt,
        retryAfter: allowed ? undefined : 60,
      },
    }
  }

  /**
   * Record rate limit hit
   */
  static async recordRateLimitHit(userId: string, endpoint: string, statusCode: number): Promise<void> {
    await prisma.rateLimitLog.create({
      data: {
        userId,
        endpoint,
        statusCode,
      },
    })
  }

  /**
   * Get user quota
   */
  static async getUserQuota(userId: string): Promise<UserQuota> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        dailyWithdrawLimit: true,
        monthlyWithdrawLimit: true,
        prefs: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    let prefs: Record<string, unknown> = {}
    try {
      if (user.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    const quota = (prefs as { quota?: Partial<UserQuota> }).quota || {}

    return {
      userId,
      dailyTransactionLimit: quota.dailyTransactionLimit || 100,
      monthlyTransactionLimit: quota.monthlyTransactionLimit || 1000,
      dailyWithdrawalLimit: user.dailyWithdrawLimit || 10000,
      monthlyWithdrawalLimit: user.monthlyWithdrawLimit || 50000,
      apiCallsPerDay: quota.apiCallsPerDay || 10000,
    }
  }

  /**
   * Check transaction quota
   */
  static async checkTransactionQuota(userId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const quota = await this.getUserQuota(userId)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const transactionsToday = await prisma.transaction.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    })

    const allowed = transactionsToday < quota.dailyTransactionLimit
    const remaining = Math.max(0, quota.dailyTransactionLimit - transactionsToday)

    return { allowed, remaining, limit: quota.dailyTransactionLimit }
  }

  /**
   * Check withdrawal quota
   */
  static async checkWithdrawalQuota(userId: string, amount: number): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const quota = await this.getUserQuota(userId)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const withdrawalsToday = await prisma.transaction.aggregate({
      where: {
        userId,
        kind: 'withdraw',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    })

    const totalWithdrawnToday = withdrawalsToday._sum.amount || 0
    const allowed = totalWithdrawnToday + amount <= quota.dailyWithdrawalLimit
    const remaining = Math.max(0, quota.dailyWithdrawalLimit - totalWithdrawnToday)

    return { allowed, remaining: remaining - amount, limit: quota.dailyWithdrawalLimit }
  }

  /**
   * Set custom quota
   */
  static async setCustomQuota(userId: string, quota: Partial<UserQuota>): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    prefs.quota = quota

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })
  }

  /**
   * Get rate limit headers
   */
  static getRateLimitHeaders(status: RateLimitStatus): Record<string, string> {
    return {
      'X-RateLimit-Limit': status.limit.toString(),
      'X-RateLimit-Remaining': status.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(status.resetAt.getTime() / 1000).toString(),
      ...(status.retryAfter ? { 'Retry-After': status.retryAfter.toString() } : {}),
    }
  }

  /**
   * Get rate limit stats
   */
  static async getRateLimitStats(userId: string, endpoint: string): Promise<any> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const logs = await prisma.rateLimitLog.findMany({
      where: {
        userId,
        endpoint,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'desc' },
    })

    const successCount = logs.filter(l => l.statusCode < 400).length
    const errorCount = logs.filter(l => l.statusCode >= 400).length

    return {
      endpoint,
      totalRequests: logs.length,
      successCount,
      errorCount,
      successRate: logs.length > 0 ? ((successCount / logs.length) * 100).toFixed(2) + '%' : '0%',
    }
  }

  /**
   * Reset rate limit (admin only)
   */
  static async resetRateLimit(userId: string, endpoint: string): Promise<void> {
    await prisma.rateLimitLog.deleteMany({
      where: { userId, endpoint },
    })
  }
}

export const rateLimitService = new RateLimitService()
