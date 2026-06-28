import { prisma } from '../db.js'
import { env } from '../env.js'
import { riskAssessmentService } from './riskAssessment.js'

interface FraudRule {
  id: string
  name: string
  description?: string
  conditions: any
  action: 'block' | 'flag' | 'review' | 'notify'
  severity: 'low' | 'medium' | 'high' | 'critical'
  active: boolean
}

interface FraudDetectionResult {
  isFraud: boolean
  riskScore: number
  triggeredRules: string[]
  recommendedAction: 'allow' | 'block' | 'review' | 'escalate'
  explanation: string
}

export class FraudDetectionService {

  /**
   * Analyze transaction for fraud
   */
  async analyzeTransaction(
    userId: string,
    transaction: {
      type: string
      amount: number
      currency: string
      recipient?: string
      method?: string
    },
    context: {
      ipAddress: string
      userAgent: string
      deviceFingerprint?: any
      location?: any
    }
  ): Promise<FraudDetectionResult> {
    
    if (!env.ENABLE_FRAUD_DETECTION) {
      return {
        isFraud: false,
        riskScore: 0,
        triggeredRules: [],
        recommendedAction: 'allow',
        explanation: 'Fraud detection disabled'
      }
    }

    const [activeRules, userProfile, recentActivity] = await Promise.all([
      this.getActiveRules(),
      this.getUserProfile(userId),
      this.getRecentActivity(userId)
    ])

    const triggeredRules: string[] = []
    let totalRiskScore = 0

    // Check each rule
    for (const rule of activeRules) {
      const triggered = await this.checkRule(rule, {
        userId,
        transaction,
        context,
        userProfile,
        recentActivity
      })

      if (triggered) {
        triggeredRules.push(rule.name)
        totalRiskScore += this.getRuleScore(rule.severity)
        
        // Update rule trigger count
        await this.incrementRuleTrigger(rule.id)
      }
    }

    // Get additional risk assessment
    const riskAssessment = await riskAssessmentService.assessRisk(
      userId,
      transaction.type,
      context
    )

    totalRiskScore = Math.max(totalRiskScore, riskAssessment.riskScore)

    const result: FraudDetectionResult = {
      isFraud: totalRiskScore >= env.RISK_SCORE_THRESHOLD,
      riskScore: totalRiskScore,
      triggeredRules,
      recommendedAction: this.getRecommendedAction(totalRiskScore, triggeredRules),
      explanation: this.generateExplanation(totalRiskScore, triggeredRules)
    }

    // Log the detection result
    await this.logSecurityEvent(userId, 'fraud_check', result, context)

    // Auto-block if configured and risk is critical
    if (env.AUTO_BLOCK_CRITICAL_RISK && totalRiskScore >= 90) {
      await this.autoBlockUser(userId, 'Critical fraud risk detected')
    }

    return result
  }

  /**
   * Create default fraud rules
   */
  async initializeDefaultRules(): Promise<void> {
    const defaultRules = [
      {
        name: 'Large Transaction',
        description: 'Flag transactions over $50,000',
        conditions: { maxAmount: 50000 },
        action: 'review',
        severity: 'medium'
      },
      {
        name: 'High Velocity',
        description: 'More than 10 transactions per hour',
        conditions: { maxTransactionsPerHour: 10 },
        action: 'flag',
        severity: 'high'
      },
      {
        name: 'Sanctioned Countries',
        description: 'Block transactions from high-risk countries',
        conditions: { 
          blockedCountries: ['IR', 'KP', 'SY', 'CU', 'MM', 'BY'] 
        },
        action: 'block',
        severity: 'critical'
      }
    ]

    for (const rule of defaultRules) {
      await prisma.fraudRule.upsert({
        where: { name: rule.name },
        create: {
          ...rule,
          conditions: JSON.stringify(rule.conditions),
          active: true,
          createdBy: 'system'
        },
        update: {}
      })
    }
  }

  private async getActiveRules(): Promise<FraudRule[]> {
    return []
  }

  private async getUserProfile(userId: string) {
    return { riskScore: 50 }
  }

  private async getRecentActivity(userId: string) {
    return []
  }

  private async checkRule(rule: FraudRule, data: any): Promise<boolean> {
    return false
  }

  private getRuleScore(severity: string): number {
    const scores = { low: 10, medium: 25, high: 50, critical: 80 }
    return scores[severity as keyof typeof scores] || 10
  }

  private getRecommendedAction(score: number, rules: string[]): 'allow' | 'block' | 'review' | 'escalate' {
    if (score >= 90) return 'block'
    if (score >= 70) return 'escalate'
    if (score >= 50) return 'review'
    return 'allow'
  }

  private generateExplanation(score: number, rules: string[]): string {
    return rules.length === 0 ? 'No fraud indicators detected' : `Risk score: ${score}. Triggered: ${rules.join(', ')}`
  }

  private async logSecurityEvent(userId: string, type: string, data: any, context: any): Promise<void> {
    // Log implementation
  }

  private async autoBlockUser(userId: string, reason: string): Promise<void> {
    // Auto-block implementation
  }

  private async incrementRuleTrigger(ruleId: string): Promise<void> {
    // Increment implementation
  }
}

export const fraudDetectionService = new FraudDetectionService()