import { prisma } from '../db.js'

export interface AdminDashboard {
  users: {
    total: number
    active24h: number
    newToday: number
    suspended: number
  }
  transactions: {
    total24h: number
    totalVolume24h: number
    deposits24h: number
    withdrawals24h: number
  }
  compliance: {
    kycPending: number
    kycApproved: number
    kycRejected: number
    highRiskUsers: number
  }
  system: {
    uptime: number
    errorRate: number
    avgResponseTime: number
  }
}

export class AdminDashboardService {
  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(): Promise<AdminDashboard> {
    const now = new Date()
    const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers24h,
      newUsersToday,
      suspendedUsers,
      transactions24h,
      deposits24h,
      withdrawals24h,
      kycPending,
      kycApproved,
      kycRejected,
      highRiskUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.findMany({
        where: { createdAt: { gte: day24h } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: day24h } } }),
      prisma.user.count({ where: { suspended: true } }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: day24h } },
        select: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { kind: 'deposit', createdAt: { gte: day24h } },
        select: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { kind: 'withdraw', createdAt: { gte: day24h } },
        select: { amount: true },
      }),
      prisma.user.count({ where: { kycStatus: 'pending' } }),
      prisma.user.count({ where: { kycStatus: 'approved' } }),
      prisma.user.count({ where: { kycStatus: 'rejected' } }),
      prisma.riskScore.count({ where: { level: { in: ['high', 'critical'] } } }),
    ])

    const totalVolume24h = transactions24h.reduce((sum, t) => sum + t.amount, 0)
    const depositsVolume = deposits24h.reduce((sum, t) => sum + t.amount, 0)
    const withdrawalsVolume = withdrawals24h.reduce((sum, t) => sum + t.amount, 0)

    return {
      users: {
        total: totalUsers,
        active24h: activeUsers24h.length,
        newToday: newUsersToday,
        suspended: suspendedUsers,
      },
      transactions: {
        total24h: transactions24h.length,
        totalVolume24h,
        deposits24h: depositsVolume,
        withdrawals24h: withdrawalsVolume,
      },
      compliance: {
        kycPending,
        kycApproved,
        kycRejected,
        highRiskUsers,
      },
      system: {
        uptime: 99.9,
        errorRate: 0.1,
        avgResponseTime: 150,
      },
    }
  }

  /**
   * Get user activity report
   */
  static async getUserActivityReport(days: number = 30): Promise<any[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, email: true, createdAt: true },
    })

    const report = []

    for (const user of users) {
      const transactions = await prisma.transaction.count({
        where: { userId: user.id },
      })

      const trades = await prisma.trade.count({
        where: { userId: user.id },
      })

      const lastActivity = await prisma.transaction.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })

      report.push({
        userId: user.id,
        email: user.email,
        joinedAt: user.createdAt,
        transactions,
        trades,
        lastActivity: lastActivity?.createdAt,
      })
    }

    return report
  }

  /**
   * Set custom fee tier for user
   */
  static async setCustomFeeTier(userId: string, withdrawalFeePercent: number, tradingFeePercent: number): Promise<void> {
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

    prefs.customFeeTier = {
      withdrawalFeePercent,
      tradingFeePercent,
      appliedAt: new Date().toISOString(),
    }

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })
  }

  /**
   * Get custom fee tier
   */
  static async getCustomFeeTier(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!user?.prefs) return null

    let prefs: Record<string, unknown> = {}
    try {
      prefs = JSON.parse(user.prefs)
    } catch {
      return null
    }

    return (prefs as { customFeeTier?: unknown }).customFeeTier || null
  }

  /**
   * Set withdrawal limits for user
   */
  static async setWithdrawalLimits(userId: string, dailyLimit: number, monthlyLimit: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyWithdrawLimit: dailyLimit,
        monthlyWithdrawLimit: monthlyLimit,
      },
    })
  }

  /**
   * Get withdrawal limits
   */
  static async getWithdrawalLimits(userId: string): Promise<{ daily: number | null; monthly: number | null }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dailyWithdrawLimit: true, monthlyWithdrawLimit: true },
    })

    return {
      daily: user?.dailyWithdrawLimit || null,
      monthly: user?.monthlyWithdrawLimit || null,
    }
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { id: true, email: true, kycStatus: true, suspended: true },
    })

    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { userId: true, kind: true, amount: true, status: true },
    })

    const kycStats = {
      pending: users.filter(u => u.kycStatus === 'pending').length,
      approved: users.filter(u => u.kycStatus === 'approved').length,
      rejected: users.filter(u => u.kycStatus === 'rejected').length,
    }

    const transactionStats = {
      totalCount: transactions.length,
      totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
      deposits: transactions.filter(t => t.kind === 'deposit').length,
      withdrawals: transactions.filter(t => t.kind === 'withdraw').length,
    }

    const suspendedUsers = users.filter(u => u.suspended).length

    return {
      period: { startDate, endDate },
      newUsers: users.length,
      kycStats,
      transactionStats,
      suspendedUsers,
      generatedAt: new Date(),
    }
  }

  /**
   * Bulk suspend users
   */
  static async bulkSuspendUsers(userIds: string[], reason: string): Promise<number> {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        suspended: true,
        suspendedReason: reason,
        tokenVersion: { increment: 1 },
      },
    })

    return result.count
  }

  /**
   * Bulk unsuspend users
   */
  static async bulkUnsuspendUsers(userIds: string[]): Promise<number> {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        suspended: false,
        suspendedReason: null,
      },
    })

    return result.count
  }

  /**
   * Get high-risk users
   */
  static async getHighRiskUsers(limit: number = 50): Promise<any[]> {
    const riskScores = await prisma.riskScore.findMany({
      where: { level: { in: ['high', 'critical'] } },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, email: true, name: true, kycStatus: true },
        },
      },
    })

    return riskScores.map(rs => ({
      userId: rs.userId,
      email: rs.user?.email,
      name: rs.user?.name,
      riskScore: rs.score,
      riskLevel: rs.level,
      factors: rs.factors,
      kycStatus: rs.user?.kycStatus,
    }))
  }
}

export const adminDashboardService = new AdminDashboardService()
