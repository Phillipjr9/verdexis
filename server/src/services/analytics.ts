import { prisma } from '../db.js'

export interface UserMetrics {
  totalUsers: number
  activeUsers24h: number
  activeUsers7d: number
  activeUsers30d: number
  newUsers24h: number
  newUsers7d: number
  newUsers30d: number
  churnRate: number
}

export interface RevenueMetrics {
  totalDeposits: number
  totalWithdrawals: number
  totalFees: number
  avgDepositAmount: number
  avgWithdrawalAmount: number
  depositsCount: number
  withdrawalsCount: number
}

export interface CohortData {
  cohortDate: string
  cohortSize: number
  retention: Record<string, number>
}

export class AnalyticsService {
  /**
   * Get user engagement metrics
   */
  static async getUserMetrics(): Promise<UserMetrics> {
    const now = new Date()
    const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const day7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const day30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [totalUsers, activeUsers24h, activeUsers7d, activeUsers30d, newUsers24h, newUsers7d, newUsers30d] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.findMany({
        where: { createdAt: { gte: day24h } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: day7d } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: day30d } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: day24h } } }),
      prisma.user.count({ where: { createdAt: { gte: day7d } } }),
      prisma.user.count({ where: { createdAt: { gte: day30d } } }),
    ])

    // Calculate churn rate (users who were active 30d ago but not in last 7d)
    const day37d = new Date(now.getTime() - 37 * 24 * 60 * 60 * 1000)
    const wasActiveMonth = await prisma.transaction.findMany({
      where: { createdAt: { gte: day37d, lt: day30d } },
      distinct: ['userId'],
      select: { userId: true },
    })

    const churnedUsers = wasActiveMonth.filter(u => !activeUsers7d.some(a => a.userId === u.userId)).length
    const churnRate = wasActiveMonth.length > 0 ? (churnedUsers / wasActiveMonth.length) * 100 : 0

    return {
      totalUsers,
      activeUsers24h: activeUsers24h.length,
      activeUsers7d: activeUsers7d.length,
      activeUsers30d: activeUsers30d.length,
      newUsers24h,
      newUsers7d,
      newUsers30d,
      churnRate,
    }
  }

  /**
   * Get revenue metrics
   */
  static async getRevenueMetrics(days: number = 30): Promise<RevenueMetrics> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const deposits = await prisma.transaction.findMany({
      where: {
        kind: 'deposit',
        status: 'completed',
        createdAt: { gte: since },
      },
      select: { amount: true },
    })

    const withdrawals = await prisma.transaction.findMany({
      where: {
        kind: 'withdraw',
        status: 'completed',
        createdAt: { gte: since },
      },
      select: { amount: true },
    })

    const fees = await prisma.transaction.findMany({
      where: {
        kind: 'fee',
        status: 'completed',
        createdAt: { gte: since },
      },
      select: { amount: true },
    })

    const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0)
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + t.amount, 0)
    const totalFees = fees.reduce((sum, t) => sum + t.amount, 0)

    return {
      totalDeposits,
      totalWithdrawals,
      totalFees,
      avgDepositAmount: deposits.length > 0 ? totalDeposits / deposits.length : 0,
      avgWithdrawalAmount: withdrawals.length > 0 ? totalWithdrawals / withdrawals.length : 0,
      depositsCount: deposits.length,
      withdrawalsCount: withdrawals.length,
    }
  }

  /**
   * Get cohort analysis
   */
  static async getCohortAnalysis(months: number = 6): Promise<CohortData[]> {
    const cohorts: CohortData[] = []

    for (let i = 0; i < months; i++) {
      const cohortStart = new Date()
      cohortStart.setMonth(cohortStart.getMonth() - i)
      cohortStart.setDate(1)
      cohortStart.setHours(0, 0, 0, 0)

      const cohortEnd = new Date(cohortStart)
      cohortEnd.setMonth(cohortEnd.getMonth() + 1)

      // Get users created in this cohort
      const cohortUsers = await prisma.user.findMany({
        where: {
          createdAt: { gte: cohortStart, lt: cohortEnd },
        },
        select: { id: true, createdAt: true },
      })

      const cohortSize = cohortUsers.length

      if (cohortSize === 0) continue

      const retention: Record<string, number> = {}

      // Check retention for each month after cohort
      for (let month = 0; month <= months - i; month++) {
        const checkStart = new Date(cohortStart)
        checkStart.setMonth(checkStart.getMonth() + month)
        const checkEnd = new Date(checkStart)
        checkEnd.setMonth(checkEnd.getMonth() + 1)

        const activeInMonth = await prisma.transaction.findMany({
          where: {
            userId: { in: cohortUsers.map(u => u.id) },
            createdAt: { gte: checkStart, lt: checkEnd },
          },
          distinct: ['userId'],
          select: { userId: true },
        })

        const retentionRate = (activeInMonth.length / cohortSize) * 100
        retention[`month_${month}`] = Math.round(retentionRate)
      }

      cohorts.push({
        cohortDate: cohortStart.toISOString().split('T')[0],
        cohortSize,
        retention,
      })
    }

    return cohorts
  }

  /**
   * Get churn prediction
   */
  static async predictChurn(): Promise<Array<{ userId: string; churnRisk: number }>> {
    const now = new Date()
    const day30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const day60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Get users active in last 30 days
    const recentUsers = await prisma.transaction.findMany({
      where: { createdAt: { gte: day30d } },
      distinct: ['userId'],
      select: { userId: true },
    })

    const predictions: Array<{ userId: string; churnRisk: number }> = []

    for (const { userId } of recentUsers) {
      // Get activity metrics
      const txCount30d = await prisma.transaction.count({
        where: { userId, createdAt: { gte: day30d } },
      })

      const txCount60d = await prisma.transaction.count({
        where: { userId, createdAt: { gte: day60d, lt: day30d } },
      })

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, emailVerified: true, phoneVerified: true },
      })

      // Calculate churn risk score (0-100)
      let riskScore = 0

      // Declining activity
      if (txCount30d < txCount60d * 0.5) {
        riskScore += 30
      }

      // Low activity
      if (txCount30d < 5) {
        riskScore += 20
      }

      // Not verified
      if (!user?.emailVerified || !user?.phoneVerified) {
        riskScore += 15
      }

      // New user (less than 7 days)
      const daysSinceCreation = (now.getTime() - user!.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCreation < 7) {
        riskScore += 10
      }

      predictions.push({ userId, churnRisk: Math.min(100, riskScore) })
    }

    return predictions.sort((a, b) => b.churnRisk - a.churnRisk)
  }

  /**
   * Get user lifetime value
   */
  static async getUserLTV(userId: string): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      select: { kind: true, amount: true },
    })

    let ltv = 0

    for (const tx of transactions) {
      if (tx.kind === 'deposit') {
        ltv += tx.amount * 0.02 // Assume 2% fee on deposits
      } else if (tx.kind === 'withdraw') {
        ltv += tx.amount * 0.03 // Assume 3% fee on withdrawals
      } else if (tx.kind === 'fee') {
        ltv += tx.amount
      }
    }

    return ltv
  }
}

export const analyticsService = new AnalyticsService()
