import { prisma } from '../db.js'
import { getUserOTPSettings } from '../middleware/otpAuth.js'

interface RiskFactors {
  newDevice: boolean
  newLocation: boolean
  newIP: boolean
  unusualTime: boolean
  highTransactionAmount: boolean
  velocityCheck: boolean
  multipleFailedAttempts: boolean
  suspiciousUserAgent: boolean
  vpnDetected: boolean
  highRiskCountry: boolean
}

interface RiskAssessment {
  userId: string
  action: string
  riskScore: number // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: RiskFactors
  requiresOTP: boolean
  requiresAdminApproval: boolean
  recommendedAction: string
}

export class RiskAssessmentService {

  /**
   * Assess risk for user action
   */
  async assessRisk(
    userId: string, 
    action: string,
    context: {
      ipAddress: string
      userAgent: string
      deviceFingerprint?: any
      location?: any
      transactionAmount?: number
    }
  ): Promise<RiskAssessment> {
    
    const [userHistory, recentActivity, otpSettings] = await Promise.all([
      this.getUserHistory(userId),
      this.getRecentActivity(userId),
      getUserOTPSettings(userId)
    ])

    const factors = await this.analyzeRiskFactors(userId, context, userHistory, recentActivity)
    const riskScore = this.calculateRiskScore(factors, action, context.transactionAmount)
    const riskLevel = this.determineRiskLevel(riskScore)
    
    const assessment: RiskAssessment = {
      userId,
      action,
      riskScore,
      riskLevel,
      factors,
      requiresOTP: this.shouldRequireOTP(riskScore, action, otpSettings),
      requiresAdminApproval: this.shouldRequireAdminApproval(riskScore, action, context.transactionAmount),
      recommendedAction: this.getRecommendedAction(riskScore, factors)
    }

    // Log risk assessment
    await this.logRiskAssessment(assessment, context)

    return assessment
  }

  /**
   * Analyze individual risk factors
   */
  private async analyzeRiskFactors(
    userId: string, 
    context: any, 
    userHistory: any, 
    recentActivity: any
  ): Promise<RiskFactors> {
    
    return {
      newDevice: await this.isNewDevice(userId, context.deviceFingerprint, context.ipAddress),
      newLocation: await this.isNewLocation(userId, context.location),
      newIP: await this.isNewIP(userId, context.ipAddress),
      unusualTime: this.isUnusualTime(userHistory.loginTimes),
      highTransactionAmount: this.isHighTransactionAmount(userId, context.transactionAmount),
      velocityCheck: this.hasVelocityRisk(recentActivity),
      multipleFailedAttempts: await this.hasRecentFailedAttempts(userId),
      suspiciousUserAgent: this.isSuspiciousUserAgent(context.userAgent),
      vpnDetected: await this.isVPNOrProxy(context.ipAddress),
      highRiskCountry: this.isHighRiskCountry(context.location?.country)
    }
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(factors: RiskFactors, action: string, amount?: number): number {
    let score = 0

    // Base risk factors
    if (factors.newDevice) score += 25
    if (factors.newLocation) score += 20
    if (factors.newIP) score += 15
    if (factors.unusualTime) score += 10
    if (factors.multipleFailedAttempts) score += 30
    if (factors.suspiciousUserAgent) score += 20
    if (factors.vpnDetected) score += 15
    if (factors.highRiskCountry) score += 25
    if (factors.velocityCheck) score += 20

    // Transaction-specific risks
    if (action === 'withdraw' || action === 'transfer') {
      if (factors.highTransactionAmount) score += 20
      if (amount && amount > 10000) score += 15 // High value
      if (amount && amount > 50000) score += 25 // Very high value
    }

    // Login-specific risks
    if (action === 'login') {
      if (factors.newDevice && factors.newLocation) score += 15 // Double risk
    }

    return Math.min(100, score)
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 35) return 'medium'
    return 'low'
  }

  /**
   * Check if new device
   */
  private async isNewDevice(userId: string, fingerprint: any, ipAddress: string): Promise<boolean> {
    if (!fingerprint) return true

    const existing = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        OR: [
          { deviceHash: fingerprint.hash },
          { ipAddress }
        ]
      }
    })

    return !existing
  }

  /**
   * Check if new location
   */
  private async isNewLocation(userId: string, location: any): Promise<boolean> {
    if (!location) return false

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })

    if (!user?.prefs) return true

    try {
      const prefs = JSON.parse(user.prefs)
      const knownLocations = prefs.knownLocations || []
      
      return !knownLocations.some((loc: any) => 
        loc.country === location.country && 
        Math.abs(loc.latitude - location.latitude) < 0.1 &&
        Math.abs(loc.longitude - location.longitude) < 0.1
      )
    } catch {
      return true
    }
  }

  /**
   * Check if new IP address
   */
  private async isNewIP(userId: string, ipAddress: string): Promise<boolean> {
    const recent = await prisma.user.findFirst({
      where: { id: userId },
      select: { prefs: true }
    })

    if (!recent?.prefs) return true

    try {
      const prefs = JSON.parse(recent.prefs)
      const security = prefs.security || {}
      const loginHistory = security.loginHistory || []
      
      return !loginHistory.some((login: any) => login.ip === ipAddress)
    } catch {
      return true
    }
  }

  /**
   * Check if unusual login time
   */
  private isUnusualTime(loginTimes: number[]): boolean {
    if (loginTimes.length < 5) return false

    const currentHour = new Date().getHours()
    const avgHour = loginTimes.reduce((sum, time) => sum + time, 0) / loginTimes.length
    
    return Math.abs(currentHour - avgHour) > 4
  }

  /**
   * Check if high transaction amount for user
   */
  private isHighTransactionAmount(userId: string, amount?: number): boolean {
    if (!amount) return false
    
    // Simple threshold - in production, calculate user's average transaction
    return amount > 5000
  }

  /**
   * Check velocity risks
   */
  private hasVelocityRisk(recentActivity: any): boolean {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    const recentActions = recentActivity.filter((activity: any) => 
      now - new Date(activity.createdAt).getTime() < oneHour
    )
    
    return recentActions.length > 10
  }

  /**
   * Check for recent failed attempts
   */
  private async hasRecentFailedAttempts(userId: string): Promise<boolean> {
    const oneHour = new Date(Date.now() - 60 * 60 * 1000)
    
    const failedOTPs = await prisma.otp.count({
      where: {
        userId,
        createdAt: { gte: oneHour },
        attempts: { gte: 3 },
        used: false
      }
    })

    return failedOTPs > 0
  }

  /**
   * Check suspicious user agent
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspicious = [
      'curl', 'wget', 'python', 'bot', 'crawler', 'scanner',
      'automated', 'script', 'headless'
    ]
    
    return suspicious.some(pattern => 
      userAgent.toLowerCase().includes(pattern)
    )
  }

  /**
   * Check if VPN/Proxy (simplified)
   */
  private async isVPNOrProxy(ipAddress: string): Promise<boolean> {
    // In production, integrate with VPN detection service
    // For now, simple check for common VPN IP ranges
    const vpnRanges = ['10.', '172.', '192.168.']
    return vpnRanges.some(range => ipAddress.startsWith(range))
  }

  /**
   * Check if high-risk country
   */
  private isHighRiskCountry(country?: string): boolean {
    if (!country) return false
    
    const highRiskCountries = [
      'NK', 'IR', 'SY', 'AF', 'MM', 'BY', 'CU'
    ]
    
    return highRiskCountries.includes(country)
  }

  /**
   * Determine if OTP should be required
   */
  private shouldRequireOTP(riskScore: number, action: string, otpSettings: any): boolean {
    // Always require for critical risk
    if (riskScore >= 80) return true
    
    // Check user's OTP settings
    if (otpSettings?.enabled) {
      if (action === 'login' && otpSettings.requireForLogin) return true
      if (action === 'transaction' && otpSettings.requireForTransactions) return true
      if (action === 'withdraw' && otpSettings.requireForWithdrawals) return true
    }
    
    // Risk-based requirements
    if (riskScore >= 60 && (action === 'withdraw' || action === 'transfer')) return true
    if (riskScore >= 40 && action === 'login') return true
    
    return false
  }

  /**
   * Determine if admin approval required
   */
  private shouldRequireAdminApproval(riskScore: number, action: string, amount?: number): boolean {
    // Critical risk always requires approval
    if (riskScore >= 90) return true
    
    // High-value transactions with high risk
    if (amount && amount > 50000 && riskScore >= 60) return true
    
    return false
  }

  /**
   * Get recommended action
   */
  private getRecommendedAction(riskScore: number, factors: RiskFactors): string {
    if (riskScore >= 90) return 'Block and require admin approval'
    if (riskScore >= 80) return 'Require OTP and additional verification'
    if (riskScore >= 60) return 'Require OTP verification'
    if (riskScore >= 35) return 'Monitor closely'
    return 'Allow with standard security'
  }

  /**
   * Get user history for analysis
   */
  private async getUserHistory(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })

    if (!user?.prefs) return { loginTimes: [] }

    try {
      const prefs = JSON.parse(user.prefs)
      const security = prefs.security || {}
      const loginHistory = security.loginHistory || []
      
      return {
        loginTimes: loginHistory.map((login: any) => new Date(login.at).getHours())
      }
    } catch {
      return { loginTimes: [] }
    }
  }

  /**
   * Get recent user activity
   */
  private async getRecentActivity(userId: string): Promise<any[]> {
    const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    return prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: oneDay }
      },
      select: {
        createdAt: true,
        kind: true,
        amount: true
      }
    })
  }

  /**
   * Log risk assessment
   */
  private async logRiskAssessment(assessment: RiskAssessment, context: any): Promise<void> {
    try {
      await prisma.riskAssessment.create({
        data: {
          userId: assessment.userId,
          action: assessment.action,
          riskScore: assessment.riskScore,
          riskLevel: assessment.riskLevel,
          factors: JSON.stringify(assessment.factors),
          context: JSON.stringify(context),
          requiresOTP: assessment.requiresOTP,
          requiresAdminApproval: assessment.requiresAdminApproval,
          recommendedAction: assessment.recommendedAction
        }
      })
    } catch (error) {
      console.error('Failed to log risk assessment:', error)
    }
  }
}

export const riskAssessmentService = new RiskAssessmentService()