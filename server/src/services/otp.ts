import crypto from 'node:crypto'
import { prisma } from '../db.js'

interface OTPConfig {
  length: number
  expirationMinutes: number
  maxAttempts: number
  requestCooldownSeconds: number
}

const DEFAULT_CONFIG: OTPConfig = {
  length: 6,
  expirationMinutes: 10,
  maxAttempts: 5,
  requestCooldownSeconds: 60,
}

export class OTPService {
  private config: OTPConfig

  constructor(config: Partial<OTPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 1000000).toString()
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex')
  }

  async create(userId: string, purpose: 'login' | 'email_verification' | 'transaction' | '2fa' = 'email_verification'): Promise<{ code?: string; error?: string }> {
    const recent = await prisma.otp.findFirst({
      where: {
        userId,
        purpose,
        used: false,
        createdAt: { gte: new Date(Date.now() - this.config.requestCooldownSeconds * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recent) {
      const secondsLeft = Math.ceil((recent.createdAt.getTime() + this.config.requestCooldownSeconds * 1000 - Date.now()) / 1000)
      return { error: `Please wait ${secondsLeft}s before requesting a new code` }
    }

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

    return { code }
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
      await prisma.otp.update({ where: { id: record.id }, data: { used: true } })
      return { success: false, error: 'Too many attempts' }
    }

    if (record.hashedOtp !== hashedCode) {
      await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
      const remaining = record.maxAttempts - (record.attempts + 1)
      return { success: false, error: remaining > 0 ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining` : 'Invalid code' }
    }

    await prisma.otp.update({ where: { id: record.id }, data: { used: true, verifiedAt: new Date() } })
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
