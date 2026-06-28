import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'
import { AuthedRequest } from '../auth.js'

interface OTPSettings {
  userId: string
  enabled: boolean
  method: 'email' | 'both' | 'disabled'
  requireForLogin: boolean
  requireForTransactions: boolean
  requireForWithdrawals: boolean
  requireFor2FA: boolean
  enabledAt: string
  disabledAt?: string | null
  disabledBy?: string | null
  disabledReason?: string | null
}

export async function getUserOTPSettings(userId: string): Promise<OTPSettings | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prefs: true }
  })

  if (!user?.prefs) return null

  try {
    const prefs = JSON.parse(user.prefs)
    return prefs.otpSettings as OTPSettings || null
  } catch {
    return null
  }
}

export async function requireOTPForAction(
  action: 'login' | 'transaction' | 'withdrawal' | '2fa'
) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const otpSettings = await getUserOTPSettings(req.userId)
    
    if (!otpSettings?.enabled) {
      return next() // OTP not enabled for user
    }

    const requirementMap = {
      login: otpSettings.requireForLogin,
      transaction: otpSettings.requireForTransactions,
      withdrawal: otpSettings.requireForWithdrawals,
      '2fa': otpSettings.requireFor2FA,
    }

    if (!requirementMap[action]) {
      return next() // OTP not required for this action
    }

    // Check if OTP was already verified for this session/action
    const otpVerified = req.headers['x-otp-verified'] === 'true'
    
    if (otpVerified) {
      return next()
    }

    return res.status(403).json({
      error: 'OTP verification required',
      otpRequired: true,
      action,
      message: `This action requires OTP verification. Please verify your identity first.`
    })
  }
}

export const requireOTPForLogin = requireOTPForAction('login')
export const requireOTPForTransaction = requireOTPForAction('transaction')
export const requireOTPForWithdrawal = requireOTPForAction('withdrawal')
export const requireOTPFor2FA = requireOTPForAction('2fa')

// Check if user should be prompted for OTP during login
export async function shouldRequireOTPForLogin(userId: string): Promise<boolean> {
  const settings = await getUserOTPSettings(userId)
  return settings?.enabled && settings.requireForLogin || false
}

// Validate OTP session
export function validateOTPSession(req: AuthedRequest, res: Response, next: NextFunction) {
  // This middleware can be used to validate that an OTP was recently verified
  // You can implement session-based OTP tracking here if needed
  next()
}