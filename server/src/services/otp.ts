import crypto from 'node:crypto'
import { prisma } from '../db.js'

interface OTPConfig {
  length: number
  expirationMinutes: number
  maxAttempts: number
}

const DEFAULT_CONFIG: OTPConfig = {
  length: 6,
  expirationMinutes: 10,
  maxAttempts: 5,
}

export class OTPService {
  private config: OTPConfig

  constructor(config: Partial<OTPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex')
  }

  async create(userId: string, purpose: 'login' | 'email_verification' | 'transaction' | '2fa' = 'email_verification'): Promise<string> {
    await prisma.otp.deleteMany({
      where: { userId, purpose, used: false },
    })

    const code = this.generateCode()
    const hashedCode = this.hashCode(code)
    const expiresAt = new Date(Date.now() + this.config.expirationMinutes * 60000)

    await prisma.otp.create({
      data: {
        userId,
        hashedOtp: hashedCode,
        purpose,
        expiresAt,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
      },
    })

    return code
  }

  async verify(userId: string, code: string, purpose: 'login' | 'email_verification' | 'transaction' | '2fa' = 'email_verification'): Promise<{ success: boolean; error?: string }> {
    const hashedCode = this.hashCode(code)

    const record = await prisma.otp.findFirst({
      where: {
        userId,
        purpose,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      return { success: false, error: 'Invalid or expired code' }
    }

    if (record.attempts >= record.maxAttempts) {
      await prisma.otp.update({
        where: { id: record.id },
        data: { used: true },
      })
      return { success: false, error: 'Too many attempts' }
    }

    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })

    if (record.hashedOtp !== hashedCode) {
      return { success: false, error: 'Invalid code' }
    }

    await prisma.otp.update({
      where: { id: record.id },
      data: { used: true, verifiedAt: new Date() },
    })

    return { success: true }
  }

  async cleanup(): Promise<void> {
    await prisma.otp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { used: true },
        ],
      },
    })
  }
}

export const otpService = new OTPService()
