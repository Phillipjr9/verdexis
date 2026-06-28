import crypto from 'node:crypto'
import { prisma } from '../db.js'

export interface OTPConfig {
  otpLength: number
  expirationTime: number
  maxAttempts: number
  rateLimit: number
  rateLimitWindow: number
}

export interface OTPData {
  otp: string
  expiresAt: number
  expirationMinutes: number
  userId: string
}

export interface OTPMetadata {
  ip?: string
  userAgent?: string
  [key: string]: unknown
}

const DEFAULT_CONFIG: OTPConfig = {
  otpLength: 6,
  expirationTime: 10 * 60 * 1000, // 10 minutes
  maxAttempts: 5,
  rateLimit: 5,
  rateLimitWindow: 60 * 60 * 1000, // 1 hour
}

export class OTPService {
  private config: OTPConfig

  constructor(config: Partial<OTPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  generateOTP(length: number = this.config.otpLength): string {
    if (length === 6) {
      return Math.floor(100000 + Math.random() * 900000).toString()
    }
    return Math.floor(
      Math.pow(10, length - 1) +
        Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1))
    ).toString()
  }

  hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex')
  }

  async createOTP(
    userId: string,
    purpose: string,
    metadata: OTPMetadata = {}
  ): Promise<OTPData> {
    // Check rate limit
    const recentOTPs = await prisma.otp.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - this.config.rateLimitWindow),
        },
      },
    })

    if (recentOTPs >= this.config.rateLimit) {
      throw new Error(
        `Too many OTP requests. Try again in ${Math.ceil(this.config.rateLimitWindow / 60000)} minutes.`
      )
    }

    // Invalidate any existing unused OTPs for this user and purpose
    await prisma.otp.updateMany({
      where: {
        userId,
        purpose,
        used: false,
      },
      data: {
        used: true,
      },
    })

    const otp = this.generateOTP()
    const hashedOtp = this.hashOTP(otp)
    const expiresAt = new Date(Date.now() + this.config.expirationTime)

    await prisma.otp.create({
      data: {
        userId,
        hashedOtp,
        purpose,
        expiresAt,
        maxAttempts: this.config.maxAttempts,
        metadata: JSON.stringify(metadata),
      },
    })

    return {
      otp,
      expiresAt: expiresAt.getTime(),
      expirationMinutes: Math.ceil(this.config.expirationTime / 60000),
      userId,
    }
  }

  async verifyOTP(
    userId: string,
    otp: string,
    purpose: string
  ): Promise<{ success: boolean; userId: string; purpose: string; verifiedAt: number }> {
    const record = await prisma.otp.findFirst({
      where: {
        userId,
        purpose,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!record) {
      throw new Error('Invalid or expired verification code')
    }

    if (record.attempts >= record.maxAttempts) {
      await prisma.otp.update({
        where: { id: record.id },
        data: { used: true },
      })
      throw new Error('Too many failed attempts')
    }

    // Increment attempts
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })

    // Verify OTP
    const hashedInput = this.hashOTP(otp)
    if (hashedInput !== record.hashedOtp) {
      throw new Error('Invalid verification code')
    }

    // Mark as used
    const now = new Date()
    await prisma.otp.update({
      where: { id: record.id },
      data: {
        used: true,
        verifiedAt: now,
      },
    })

    return {
      success: true,
      userId,
      purpose,
      verifiedAt: now.getTime(),
    }
  }

  async clearOTP(userId: string, purpose?: string): Promise<void> {
    const where: { userId: string; purpose?: string } = { userId }
    if (purpose) where.purpose = purpose

    await prisma.otp.updateMany({
      where,
      data: { used: true },
    })
  }

  async getOTPInfo(userId: string, purpose: string) {
    const record = await prisma.otp.findFirst({
      where: {
        userId,
        purpose,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!record) return null

    return {
      expiresAt: record.expiresAt.getTime(),
      expirationMinutes: Math.ceil((record.expiresAt.getTime() - Date.now()) / 60000),
      purpose: record.purpose,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      used: record.used,
    }
  }

  async cleanupExpiredOTPs(): Promise<number> {
    const result = await prisma.otp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { used: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    })
    return result.count
  }
}

export const otpService = new OTPService()
