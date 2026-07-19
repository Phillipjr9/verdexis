import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'
import { AuthedRequest } from '../auth.js'

export interface VerificationStatus {
  emailVerified: boolean
  phoneVerified: boolean
  allVerified: boolean
}

export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailVerified: true,
      phoneVerified: true,
    },
  })

  return {
    emailVerified: user?.emailVerified ?? false,
    phoneVerified: user?.phoneVerified ?? false,
    allVerified: (user?.emailVerified ?? false) && (user?.phoneVerified ?? false),
  }
}

/**
 * Middleware to check if user has verified email and phone
 * Allows request to proceed but adds verification status to response headers
 */
export function checkVerificationStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return next()
  }

  // Attach verification check to response locals for later use
  res.locals.checkVerification = async () => {
    return getVerificationStatus(req.userId!)
  }

  next()
}

/**
 * Middleware to require email and phone verification
 * Blocks request if user hasn't verified both
 */
export async function requireVerification(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const status = await getVerificationStatus(req.userId)

  if (!status.allVerified) {
    return res.status(403).json({
      error: 'Verification required',
      verificationStatus: status,
      message: `Please verify your ${!status.emailVerified ? 'email' : ''} ${!status.emailVerified && !status.phoneVerified ? 'and' : ''} ${!status.phoneVerified ? 'phone number' : ''}`,
      nextSteps: {
        emailVerification: !status.emailVerified ? 'POST /api/otp/send-email-verification' : null,
        phoneVerification: !status.phoneVerified ? 'POST /api/otp/send-phone-verification' : null,
      },
    })
  }

  next()
}

/**
 * Middleware to warn about unverified email/phone but allow access
 * Adds verification status to response headers
 */
export async function warnUnverified(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return next()
  }

  const status = await getVerificationStatus(req.userId)

  if (!status.allVerified) {
    res.setHeader('X-Verification-Required', 'true')
    res.setHeader('X-Email-Verified', status.emailVerified ? 'true' : 'false')
    res.setHeader('X-Phone-Verified', status.phoneVerified ? 'true' : 'false')
  }

  next()
}
