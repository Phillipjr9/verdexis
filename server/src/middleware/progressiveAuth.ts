import { Request, Response, NextFunction } from 'express'
import { AuthedRequest } from '../auth.js'
import { getUserOTPSettings } from './otpAuth.js'
import { riskAssessmentService } from '../services/riskAssessment.js'
import { trustedDeviceService } from '../services/trustedDevice.js'
import { sessionManagementService } from '../services/sessionManagement.js'

interface ProgressiveAuthConfig {
  action: string
  riskThresholds: {
    low: number    // 0-30: Allow
    medium: number // 31-60: Require OTP  
    high: number   // 61-80: Require step-up
    critical: number // 81+: Block/Admin approval
  }
  requireTrustedDevice?: boolean
  maxAmount?: number
}

interface AuthResult {
  allowed: boolean
  requiresOTP: boolean
  requiresStepUp: boolean
  requiresApproval: boolean
  riskScore: number
  reason: string
  recommendations: string[]
}

export class ProgressiveAuthMiddleware {

  /**
   * Create middleware for progressive authentication
   */
  static create(config: ProgressiveAuthConfig): (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void | Response> {
    return async (req: AuthedRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      try {
        const context = {
          ipAddress: this.getClientIP(req),
          userAgent: req.headers['user-agent'] || '',
          deviceFingerprint: req.headers['x-device-fingerprint'] ? 
            JSON.parse(req.headers['x-device-fingerprint'] as string) : undefined,
          location: req.headers['x-user-location'] ? 
            JSON.parse(req.headers['x-user-location'] as string) : undefined,
          transactionAmount: req.body?.amount || config.maxAmount
        }

        const authResult = await this.assessAuthentication(
          req.userId,
          config,
          context,
          req.body
        )

        // Handle authentication result
        if (!authResult.allowed) {
          return res.status(403).json({
            error: 'Action blocked',
            reason: authResult.reason,
            riskScore: authResult.riskScore,
            requiresApproval: authResult.requiresApproval
          })
        }

        if (authResult.requiresStepUp) {
          const sessionId = req.headers['x-session-id'] as string
          if (!sessionId) {
            return res.status(403).json({
              error: 'Step-up authentication required',
              stepUpRequired: true,
              reason: authResult.reason
            })
          }

          const stepUpResult = await sessionManagementService.requiresStepUp(
            sessionId,
            config.action,
            { amount: context.transactionAmount }
          )

          if (stepUpResult.required) {
            return res.status(403).json({
              error: 'Step-up authentication required',
              stepUpRequired: true,
              level: stepUpResult.level,
              validFor: stepUpResult.validFor,
              reason: stepUpResult.reason
            })
          }
        }

        if (authResult.requiresOTP) {
          const otpVerified = req.headers['x-otp-verified'] === 'true'
          
          if (!otpVerified) {
            return res.status(403).json({
              error: 'OTP verification required',
              otpRequired: true,
              reason: authResult.reason,
              recommendations: authResult.recommendations
            })
          }
        }

        // Add auth info to request for logging
        req.authInfo = authResult

        next()
      } catch (error) {
        console.error('[progressive-auth] Error:', error)
        return res.status(500).json({ error: 'Authentication check failed' })
      }
    }
  }

  /**
   * Assess authentication requirements
   */
  private static async assessAuthentication(
    userId: string,
    config: ProgressiveAuthConfig,
    context: any,
    _requestData: any
  ): Promise<AuthResult> {
    
    // Get risk assessment
    const riskAssessment = await riskAssessmentService.assessRisk(
      userId,
      config.action,
      context
    )

    // Get user OTP settings
    const otpSettings = await getUserOTPSettings(userId)

    // Check if device is trusted
    const isTrustedDevice = context.deviceFingerprint ? 
      await trustedDeviceService.isDeviceTrusted(
        userId, 
        context.deviceFingerprint, 
        context.ipAddress
      ) : false

    const riskScore = riskAssessment.riskScore
    const recommendations: string[] = []
    let requiresOTP = false
    let requiresStepUp = false
    let requiresApproval = false

    // Determine authentication requirements based on risk score
    if (riskScore >= config.riskThresholds.critical) {
      // Critical risk - block or require admin approval
      requiresApproval = true
      recommendations.push('Critical risk detected - admin approval required')
    } else if (riskScore >= config.riskThresholds.high) {
      // High risk - require step-up authentication
      requiresStepUp = true
      recommendations.push('High risk - additional verification required')
    } else if (riskScore >= config.riskThresholds.medium) {
      // Medium risk - require OTP
      requiresOTP = true
      recommendations.push('Medium risk - OTP verification required')
    }

    // Check user-specific OTP settings
    if (otpSettings?.enabled) {
      if (config.action === 'login' && otpSettings.requireForLogin) {
        requiresOTP = true
      } else if (config.action === 'transaction' && otpSettings.requireForTransactions) {
        requiresOTP = true
      } else if (config.action === 'withdraw' && otpSettings.requireForWithdrawals) {
        requiresOTP = true
      }
    }

    // Check trusted device requirement
    if (config.requireTrustedDevice && !isTrustedDevice) {
      requiresOTP = true
      recommendations.push('Untrusted device - verification required')
    }

    // Check transaction amount thresholds
    if (context.transactionAmount && config.maxAmount) {
      if (context.transactionAmount > config.maxAmount) {
        requiresStepUp = true
        recommendations.push(`Large transaction amount (${context.transactionAmount}) - enhanced security required`)
      }
    }

    return {
      allowed: !requiresApproval,
      requiresOTP,
      requiresStepUp,
      requiresApproval,
      riskScore,
      reason: this.generateReason(riskScore, riskAssessment.factors),
      recommendations
    }
  }

  /**
   * Generate human-readable reason
   */
  private static generateReason(riskScore: number, factors: any): string {
    if (riskScore >= 80) {
      return 'Critical security risk detected'
    } else if (riskScore >= 60) {
      return 'High security risk - additional verification required'
    } else if (riskScore >= 35) {
      return 'Elevated security risk - verification recommended'
    } else {
      return 'Standard security check'
    }
  }

  /**
   * Get client IP address
   */
  private static getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || ''
    return ip.replace(/^::ffff:/, '')
  }

  /**
   * Preset configurations for common actions
   */
  static presets = {
    login: {
      action: 'login',
      riskThresholds: { low: 20, medium: 40, high: 70, critical: 90 }
    },
    
    transfer: {
      action: 'transfer',
      riskThresholds: { low: 25, medium: 35, high: 60, critical: 80 },
      requireTrustedDevice: false,
      maxAmount: 10000
    },

    withdrawal: {
      action: 'withdraw', 
      riskThresholds: { low: 20, medium: 30, high: 55, critical: 75 },
      requireTrustedDevice: true,
      maxAmount: 5000
    },

    highValueTransaction: {
      action: 'transaction',
      riskThresholds: { low: 15, medium: 25, high: 45, critical: 65 },
      requireTrustedDevice: true,
      maxAmount: 50000
    },

    adminAction: {
      action: 'admin',
      riskThresholds: { low: 10, medium: 20, high: 40, critical: 60 },
      requireTrustedDevice: true
    }
  }
}

// Type augmentation for AuthedRequest
declare global {
  namespace Express {
    interface Request {
      authInfo?: AuthResult
    }
  }
}

// Convenience functions for common use cases
export const requireProgressiveAuth = {
  forLogin: ProgressiveAuthMiddleware.create(ProgressiveAuthMiddleware.presets.login),
  forTransfer: ProgressiveAuthMiddleware.create(ProgressiveAuthMiddleware.presets.transfer),
  forWithdrawal: ProgressiveAuthMiddleware.create(ProgressiveAuthMiddleware.presets.withdrawal),
  forHighValue: ProgressiveAuthMiddleware.create(ProgressiveAuthMiddleware.presets.highValueTransaction),
  forAdmin: ProgressiveAuthMiddleware.create(ProgressiveAuthMiddleware.presets.adminAction)
}