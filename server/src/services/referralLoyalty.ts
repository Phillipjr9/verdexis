import crypto from 'node:crypto'
import { prisma } from '../db.js'

export interface ReferralProgram {
  referrerId: string
  refereeId: string
  referralCode: string
  status: 'pending' | 'active' | 'completed'
  commissionPercent: number
  commissionAmount: number
  createdAt: Date
  completedAt: Date | null
}

export interface LoyaltyTier {
  name: string
  minPoints: number
  maxPoints: number
  benefits: string[]
  multiplier: number
}

export interface UserLoyalty {
  userId: string
  points: number
  tier: string
  totalSpent: number
  referralsCount: number
  createdAt: Date
}

export class ReferralLoyaltyService {
  private static readonly LOYALTY_TIERS: LoyaltyTier[] = [
    {
      name: 'Bronze',
      minPoints: 0,
      maxPoints: 999,
      benefits: ['1x points multiplier'],
      multiplier: 1,
    },
    {
      name: 'Silver',
      minPoints: 1000,
      maxPoints: 4999,
      benefits: ['1.5x points multiplier', '5% trading fee discount'],
      multiplier: 1.5,
    },
    {
      name: 'Gold',
      minPoints: 5000,
      maxPoints: 9999,
      benefits: ['2x points multiplier', '10% trading fee discount', 'Priority support'],
      multiplier: 2,
    },
    {
      name: 'Platinum',
      minPoints: 10000,
      maxPoints: Infinity,
      benefits: ['3x points multiplier', '15% trading fee discount', 'VIP support', 'Exclusive events'],
      multiplier: 3,
    },
  ]

  /**
   * Generate referral code
   */
  static generateReferralCode(): string {
    return crypto.randomBytes(6).toString('hex').toUpperCase()
  }

  /**
   * Create referral
   */
  static async createReferral(referrerId: string, refereeId: string, commissionPercent: number = 10): Promise<ReferralProgram> {
    const referralCode = this.generateReferralCode()

    const referral = await prisma.referral.create({
      data: {
        referrerId,
        refereeId,
        referralCode,
        status: 'pending',
        commissionPercent,
        commissionAmount: 0,
      },
    })

    return referral
  }

  /**
   * Activate referral (when referee makes first deposit)
   */
  static async activateReferral(referralId: string): Promise<ReferralProgram> {
    const referral = await prisma.referral.update({
      where: { id: referralId },
      data: { status: 'active' },
    })

    return referral
  }

  /**
   * Complete referral (when referee meets conditions)
   */
  static async completeReferral(referralId: string, commissionAmount: number): Promise<ReferralProgram> {
    const referral = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'completed',
        commissionAmount,
        completedAt: new Date(),
      },
    })

    // Award referrer loyalty points
    await this.addLoyaltyPoints(referral.referrerId, Math.floor(commissionAmount / 10))

    return referral
  }

  /**
   * Get user's referrals
   */
  static async getUserReferrals(userId: string): Promise<ReferralProgram[]> {
    return prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Add loyalty points
   */
  static async addLoyaltyPoints(userId: string, points: number): Promise<UserLoyalty> {
    let loyalty = await prisma.userLoyalty.findUnique({
      where: { userId },
    })

    if (!loyalty) {
      loyalty = await prisma.userLoyalty.create({
        data: {
          userId,
          points,
          tier: 'Bronze',
          totalSpent: 0,
          referralsCount: 0,
        },
      })
    } else {
      loyalty = await prisma.userLoyalty.update({
        where: { userId },
        data: { points: { increment: points } },
      })
    }

    // Update tier
    const tier = this.getTierForPoints(loyalty.points)
    if (tier !== loyalty.tier) {
      loyalty = await prisma.userLoyalty.update({
        where: { userId },
        data: { tier },
      })
    }

    return loyalty
  }

  /**
   * Redeem loyalty points
   */
  static async redeemLoyaltyPoints(userId: string, points: number): Promise<{ success: boolean; message: string }> {
    const loyalty = await prisma.userLoyalty.findUnique({
      where: { userId },
    })

    if (!loyalty || loyalty.points < points) {
      return { success: false, message: 'Insufficient loyalty points' }
    }

    await prisma.userLoyalty.update({
      where: { userId },
      data: { points: { decrement: points } },
    })

    // Award trading credit (1 point = $0.01)
    const creditAmount = points * 0.01
    await prisma.walletBalance.upsert({
      where: { userId_currency: { userId, currency: 'USD' } },
      create: {
        userId,
        currency: 'USD',
        symbol: '$',
        balance: creditAmount,
        available: creditAmount,
      },
      update: {
        balance: { increment: creditAmount },
        available: { increment: creditAmount },
      },
    })

    return { success: true, message: `Redeemed ${points} points for $${creditAmount}` }
  }

  /**
   * Get loyalty tier
   */
  static getTierForPoints(points: number): string {
    for (const tier of this.LOYALTY_TIERS) {
      if (points >= tier.minPoints && points <= tier.maxPoints) {
        return tier.name
      }
    }
    return 'Bronze'
  }

  /**
   * Get loyalty tier details
   */
  static getTierDetails(tierName: string): LoyaltyTier | undefined {
    return this.LOYALTY_TIERS.find(t => t.name === tierName)
  }

  /**
   * Get user loyalty status
   */
  static async getUserLoyaltyStatus(userId: string): Promise<UserLoyalty & { tierDetails: LoyaltyTier | undefined }> {
    let loyalty = await prisma.userLoyalty.findUnique({
      where: { userId },
    })

    if (!loyalty) {
      loyalty = await prisma.userLoyalty.create({
        data: {
          userId,
          points: 0,
          tier: 'Bronze',
          totalSpent: 0,
          referralsCount: 0,
        },
      })
    }

    const tierDetails = this.getTierDetails(loyalty.tier)

    return { ...loyalty, tierDetails }
  }

  /**
   * Award points for transaction
   */
  static async awardTransactionPoints(userId: string, amount: number): Promise<void> {
    // 1 point per $1 spent
    const points = Math.floor(amount)

    const loyalty = await prisma.userLoyalty.findUnique({
      where: { userId },
    })

    if (loyalty) {
      await prisma.userLoyalty.update({
        where: { userId },
        data: {
          points: { increment: points },
          totalSpent: { increment: amount },
        },
      })

      // Update tier
      const newLoyalty = await prisma.userLoyalty.findUnique({
        where: { userId },
      })

      if (newLoyalty) {
        const tier = this.getTierForPoints(newLoyalty.points)
        if (tier !== newLoyalty.tier) {
          await prisma.userLoyalty.update({
            where: { userId },
            data: { tier },
          })
        }
      }
    }
  }

  /**
   * Get referral leaderboard
   */
  static async getReferralLeaderboard(limit: number = 10): Promise<any[]> {
    const referrals = await prisma.referral.findMany({
      where: { status: 'completed' },
      select: { referrerId: true, commissionAmount: true },
    })

    const grouped: Record<string, number> = {}
    for (const ref of referrals) {
      grouped[ref.referrerId] = (grouped[ref.referrerId] || 0) + ref.commissionAmount
    }

    const leaderboard = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, totalCommission]) => ({ userId, totalCommission }))

    // Enrich with user info
    const enriched = []
    for (const entry of leaderboard) {
      const user = await prisma.user.findUnique({
        where: { id: entry.userId },
        select: { email: true, name: true },
      })

      enriched.push({
        ...entry,
        email: user?.email,
        name: user?.name,
      })
    }

    return enriched
  }

  /**
   * Get loyalty leaderboard
   */
  static async getLoyaltyLeaderboard(limit: number = 10): Promise<any[]> {
    const loyalties = await prisma.userLoyalty.findMany({
      orderBy: { points: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    })

    return loyalties.map(l => ({
      userId: l.userId,
      email: l.user?.email,
      name: l.user?.name,
      points: l.points,
      tier: l.tier,
      totalSpent: l.totalSpent,
    }))
  }
}

export const referralLoyaltyService = new ReferralLoyaltyService()
