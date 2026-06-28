import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { env } from '../env.js'

interface SessionData {
  userId: string
  sessionId: string
  deviceHash: string
  ipAddress: string
  otpVerified: boolean
  otpVerifiedAt?: Date
  stepUpLevel: number // 0=basic, 1=otp, 2=admin
  expiresAt: Date
  createdAt: Date
  lastActivityAt: Date
}

interface StepUpRequirement {
  required: boolean
  level: number
  reason: string
  validFor: number // minutes
}

export class SessionManagementService {

  /**
   * Create new session
   */
  async createSession(
    userId: string,
    deviceHash: string,
    ipAddress: string,
    otpVerified = false
  ): Promise<{ sessionId: string; token: string }> {
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    const sessionData: SessionData = {
      userId,
      sessionId,
      deviceHash,
      ipAddress,
      otpVerified,
      otpVerifiedAt: otpVerified ? new Date() : undefined,
      stepUpLevel: otpVerified ? 1 : 0,
      expiresAt,
      createdAt: new Date(),
      lastActivityAt: new Date()
    }

    // Store session in database
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId,
        deviceHash,
        ipAddress,
        otpVerified,
        otpVerifiedAt: sessionData.otpVerifiedAt,
        stepUpLevel: sessionData.stepUpLevel,
        expiresAt,
        lastActivityAt: new Date()
      }
    })

    // Get user for token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tokenVersion: true }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Create JWT token with session info
    const token = jwt.sign(
      {
        sub: userId,
        email: user.email,
        v: user.tokenVersion,
        sessionId,
        otpVerified,
        stepUpLevel: sessionData.stepUpLevel
      },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    return { sessionId, token }
  }

  /**
   * Verify and update session
   */
  async verifySession(sessionId: string): Promise<SessionData | null> {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId }
    })

    if (!session || session.expiresAt < new Date()) {
      return null
    }

    // Update last activity
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() }
    })

    return {
      userId: session.userId,
      sessionId: session.id,
      deviceHash: session.deviceHash,
      ipAddress: session.ipAddress,
      otpVerified: session.otpVerified,
      otpVerifiedAt: session.otpVerifiedAt || undefined,
      stepUpLevel: session.stepUpLevel,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: new Date()
    }
  }

  /**
   * Upgrade session with OTP verification
   */
  async upgradeSessionWithOTP(sessionId: string): Promise<string> {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId }
    })

    if (!session) {
      throw new Error('Session not found')
    }

    // Update session
    const updatedSession = await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        otpVerified: true,
        otpVerifiedAt: new Date(),
        stepUpLevel: Math.max(session.stepUpLevel, 1)
      }
    })

    // Get user for new token
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, tokenVersion: true }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Issue new token with upgraded permissions
    const newToken = jwt.sign(
      {
        sub: session.userId,
        email: user.email,
        v: user.tokenVersion,
        sessionId,
        otpVerified: true,
        stepUpLevel: updatedSession.stepUpLevel
      },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    return newToken
  }

  /**
   * Check if step-up authentication is required
   */
  async requiresStepUp(
    sessionId: string, 
    action: string,
    context?: { amount?: number; recipient?: string }
  ): Promise<StepUpRequirement> {
    const session = await this.verifySession(sessionId)
    
    if (!session) {
      return {
        required: true,
        level: 1,
        reason: 'Invalid session',
        validFor: 10
      }
    }

    // Define step-up requirements for different actions
    const requirements = {
      'admin_action': { level: 2, validFor: 15 },
      'high_value_transfer': { level: 1, validFor: 30 },
      'withdraw': { level: 1, validFor: 15 },
      'change_password': { level: 1, validFor: 10 },
      'delete_account': { level: 2, validFor: 5 },
      'add_trusted_device': { level: 1, validFor: 10 }
    }

    // Check if high-value transaction
    if (context?.amount && context.amount > 10000) {
      action = 'high_value_transfer'
    }

    const requirement = requirements[action as keyof typeof requirements]
    
    if (!requirement) {
      // No special requirement
      return {
        required: false,
        level: 0,
        reason: 'No authentication required',
        validFor: 0
      }
    }

    // Check if session already meets requirement
    if (session.stepUpLevel >= requirement.level) {
      // Check if OTP verification is still valid
      const otpValidFor = requirement.validFor * 60 * 1000 // Convert to ms
      const timeSinceOTP = session.otpVerifiedAt ? 
        Date.now() - session.otpVerifiedAt.getTime() : Infinity

      if (timeSinceOTP <= otpValidFor) {
        return {
          required: false,
          level: session.stepUpLevel,
          reason: 'Already authenticated',
          validFor: requirement.validFor
        }
      }
    }

    return {
      required: true,
      level: requirement.level,
      reason: `Action "${action}" requires additional verification`,
      validFor: requirement.validFor
    }
  }

  /**
   * Perform step-up authentication
   */
  async performStepUp(sessionId: string, requiredLevel: number): Promise<string> {
    if (requiredLevel <= 1) {
      // OTP verification
      return this.upgradeSessionWithOTP(sessionId)
    } else {
      // Admin verification - require admin re-authentication
      throw new Error('Admin verification required - please re-authenticate')
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await prisma.userSession.delete({
      where: { id: sessionId }
    }).catch(() => {
      // Session might already be deleted
    })
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.userSession.deleteMany({
      where: { userId }
    })

    return result.count
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions = await prisma.userSession.findMany({
      where: { 
        userId,
        expiresAt: { gte: new Date() }
      },
      orderBy: { lastActivityAt: 'desc' }
    })

    return sessions.map(session => ({
      userId: session.userId,
      sessionId: session.id,
      deviceHash: session.deviceHash,
      ipAddress: session.ipAddress,
      otpVerified: session.otpVerified,
      otpVerifiedAt: session.otpVerifiedAt || undefined,
      stepUpLevel: session.stepUpLevel,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt
    }))
  }

  /**
   * Set concurrent session limit
   */
  async enforceConcurrentSessionLimit(userId: string, maxSessions = 5): Promise<void> {
    const sessions = await prisma.userSession.findMany({
      where: { 
        userId,
        expiresAt: { gte: new Date() }
      },
      orderBy: { lastActivityAt: 'desc' }
    })

    if (sessions.length > maxSessions) {
      const toDelete = sessions.slice(maxSessions)
      await prisma.userSession.deleteMany({
        where: {
          id: { in: toDelete.map(s => s.id) }
        }
      })
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.userSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    })

    return result.count
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number
    otpVerifiedSessions: number
    expiredSessions: number
    averageSessionDuration: number
  }> {
    const [active, otpVerified, expired] = await Promise.all([
      prisma.userSession.count({
        where: { expiresAt: { gte: new Date() } }
      }),
      prisma.userSession.count({
        where: { 
          expiresAt: { gte: new Date() },
          otpVerified: true
        }
      }),
      prisma.userSession.count({
        where: { expiresAt: { lt: new Date() } }
      })
    ])

    // Calculate average session duration
    const recentSessions = await prisma.userSession.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      select: {
        createdAt: true,
        lastActivityAt: true
      }
    })

    const avgDuration = recentSessions.length > 0 ?
      recentSessions.reduce((sum, session) => {
        return sum + (session.lastActivityAt.getTime() - session.createdAt.getTime())
      }, 0) / recentSessions.length / (60 * 1000) : 0 // In minutes

    return {
      totalActiveSessions: active,
      otpVerifiedSessions: otpVerified,
      expiredSessions: expired,
      averageSessionDuration: Math.round(avgDuration)
    }
  }
}

export const sessionManagementService = new SessionManagementService()