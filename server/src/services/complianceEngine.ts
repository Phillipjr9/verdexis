import { prisma } from '../db.js'
import type { User, Transaction } from '@prisma/client'

export interface ComplianceCheckResult {
  passed: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  flags: string[]
  requiresReview: boolean
  blockTransaction: boolean
  reason?: string
}

export interface AMLScreeningResult {
  sanctioned: boolean
  pepMatch: boolean
  adverseMedia: boolean
  riskScore: number
  flags: string[]
}

/**
 * Automated Compliance Engine
 * Performs real-time AML/sanctions screening and transaction monitoring
 */
export class ComplianceEngine {
  /**
   * Screen user against sanctions lists and PEP databases
   */
  async screenUser(user: User): Promise<AMLScreeningResult> {
    const flags: string[] = []
    let riskScore = 0

    // Check for high-risk countries
    const highRiskCountries = ['KP', 'IR', 'SY', 'CU'] // North Korea, Iran, Syria, Cuba
    if (user.kycCountry && highRiskCountries.includes(user.kycCountry)) {
      flags.push(`High-risk country: ${user.kycCountry}`)
      riskScore += 40
    }

    // Check for suspicious name patterns (basic check)
    if (user.kycFirstName && user.kycLastName) {
      const fullName = `${user.kycFirstName} ${user.kycLastName}`.toLowerCase()
      // This would integrate with real PEP/sanctions databases in production
      // For now, we'll do basic pattern matching
      if (this.matchesSanctionsList(fullName)) {
        flags.push('Potential PEP/sanctions match')
        riskScore += 50
      }
    }

    // Check for rapid account creation + large transactions (structuring indicator)
    const accountAge = Date.now() - new Date(user.createdAt).getTime()
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24)
    
    if (daysSinceCreation < 7) {
      const recentTransactions = await prisma.transaction.aggregate({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        _sum: { amount: true }
      })

      if ((recentTransactions._sum.amount ?? 0) > 50000) {
        flags.push('Large transaction volume within 7 days of account creation')
        riskScore += 30
      }
    }

    // Check for multiple failed KYC attempts
    const kycAttempts = await prisma.adminAudit.count({
      where: {
        targetUserId: user.id,
        action: 'kyc_rejected'
      }
    })

    if (kycAttempts >= 3) {
      flags.push(`Multiple KYC rejections: ${kycAttempts}`)
      riskScore += 25
    }

    return {
      sanctioned: riskScore >= 50,
      pepMatch: flags.some(f => f.includes('PEP')),
      adverseMedia: flags.some(f => f.includes('adverse')),
      riskScore: Math.min(100, riskScore),
      flags
    }
  }

  /**
   * Monitor transaction for suspicious patterns
   */
  async monitorTransaction(
    userId: string,
    transaction: Partial<Transaction>,
    user: User
  ): Promise<ComplianceCheckResult> {
    const flags: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    let blockTransaction = false

    // Check transaction amount
    const amount = transaction.amount ?? 0
    if (amount > 100000) {
      flags.push('Large transaction amount (>$100k)')
      riskLevel = 'high'
    } else if (amount > 50000) {
      flags.push('Medium-large transaction amount (>$50k)')
      riskLevel = 'medium'
    }

    // Check for structuring (multiple transactions just below reporting threshold)
    const last24hTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })

    const total24h = last24hTransactions.reduce((sum, t) => sum + t.amount, 0)
    if (last24hTransactions.length >= 5 && total24h > 50000) {
      flags.push('Potential structuring: multiple transactions in 24h')
      riskLevel = 'high'
      blockTransaction = true
    }

    // Check for rapid withdrawal after deposit (money laundering indicator)
    if (transaction.kind === 'withdraw') {
      const recentDeposit = await prisma.transaction.findFirst({
        where: {
          userId,
          kind: 'deposit',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
        },
        orderBy: { createdAt: 'desc' }
      })

      if (recentDeposit && recentDeposit.amount === amount) {
        flags.push('Rapid withdrawal after deposit (same amount)')
        riskLevel = 'critical'
        blockTransaction = true
      }
    }

    // Check if user is in high-risk country
    const screening = await this.screenUser(user)
    if (screening.sanctioned) {
      flags.push('User on sanctions list')
      riskLevel = 'critical'
      blockTransaction = true
    }

    // Check for unusual geographic patterns
    if (transaction.kind === 'withdraw' && user.walletAddress) {
      // This would check if withdrawal address is in different country than user
      // Requires IP geolocation integration
    }

    // Check velocity (transactions per hour)
    const lastHourTransactions = await prisma.transaction.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    })

    if (lastHourTransactions > 10) {
      flags.push(`High transaction velocity: ${lastHourTransactions} in last hour`)
      riskLevel = 'high'
    }

    // Check if user is verified
    if (user.kycStatus !== 'approved') {
      if (amount > 10000) {
        flags.push('Large transaction from unverified user')
        riskLevel = 'high'
      }
    }

    return {
      passed: !blockTransaction,
      riskLevel,
      flags,
      requiresReview: riskLevel === 'high' || riskLevel === 'critical',
      blockTransaction,
      reason: flags.length > 0 ? flags[0] : undefined
    }
  }

  /**
   * Create suspicious activity report
   */
  async createSuspiciousActivityReport(
    userId: string,
    reason: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await prisma.securityEvent.create({
      data: {
        userId,
        eventType: 'suspicious_activity',
        severity: 'high',
        description: reason,
        metadata: JSON.stringify(metadata),
        resolved: false
      }
    })

    // Create admin audit log
    await prisma.adminAudit.create({
      data: {
        actorId: 'system',
        targetUserId: userId,
        action: 'suspicious_activity_detected',
        payload: JSON.stringify({ reason, metadata })
      }
    })
  }

  /**
   * Check if name matches known sanctions/PEP lists
   * In production, this would call real databases like:
   * - OFAC SDN list
   * - EU sanctions list
   * - UN sanctions list
   * - World-Check
   */
  private matchesSanctionsList(name: string): boolean {
    // Placeholder: would integrate with real sanctions databases
    // For now, just check against a basic list
    const knownSanctioned = [
      'kim jong',
      'bashar al-assad',
      'vladimir putin',
      'nicolás maduro'
    ]

    return knownSanctioned.some(sanctioned => name.includes(sanctioned.toLowerCase()))
  }

  /**
   * Get user risk profile
   */
  async getUserRiskProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return null

    const screening = await this.screenUser(user)
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })

    const securityEvents = await prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return {
      userId,
      riskScore: screening.riskScore,
      sanctioned: screening.sanctioned,
      pepMatch: screening.pepMatch,
      kycStatus: user.kycStatus,
      kycTier: user.kycTier,
      transactionCount30d: recentTransactions.length,
      totalVolume30d: recentTransactions.reduce((sum, t) => sum + t.amount, 0),
      recentSecurityEvents: securityEvents.length,
      flags: screening.flags,
      lastUpdated: new Date()
    }
  }
}

export const complianceEngine = new ComplianceEngine()
