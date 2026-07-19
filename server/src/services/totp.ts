import crypto from 'node:crypto'
import { prisma } from '../db.js'

export class TOTPService {
  private static readonly WINDOW = 1
  private static readonly TIME_STEP = 30

  /**
   * Generate a secret for TOTP
   */
  static generateSecret(): string {
    return crypto.randomBytes(32).toString('base64')
  }

  /**
   * Generate backup codes (10 codes, 8 characters each)
   */
  static generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase())
    }
    return codes
  }

  /**
   * Hash backup codes for storage
   */
  static hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex')
  }

  /**
   * Generate TOTP token from secret
   */
  static generateToken(secret: string): string {
    const buffer = Buffer.from(secret, 'base64')
    const time = Math.floor(Date.now() / 1000 / TOTPService.TIME_STEP)
    const hmac = crypto.createHmac('sha1', buffer)
    hmac.update(Buffer.alloc(8))
    const counter = Buffer.alloc(8)
    counter.writeBigInt64BE(BigInt(time), 0)
    const digest = crypto.createHmac('sha1', buffer).update(counter).digest()
    const offset = digest[digest.length - 1] & 0xf
    const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000
    return code.toString().padStart(6, '0')
  }

  /**
   * Verify TOTP token
   */
  static verifyToken(secret: string, token: string): boolean {
    const buffer = Buffer.from(secret, 'base64')
    const time = Math.floor(Date.now() / 1000 / TOTPService.TIME_STEP)

    for (let i = -TOTPService.WINDOW; i <= TOTPService.WINDOW; i++) {
      const counter = Buffer.alloc(8)
      counter.writeBigInt64BE(BigInt(time + i), 0)
      const digest = crypto.createHmac('sha1', buffer).update(counter).digest()
      const offset = digest[digest.length - 1] & 0xf
      const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000
      const expectedToken = code.toString().padStart(6, '0')

      if (expectedToken === token) {
        return true
      }
    }

    return false
  }

  /**
   * Generate QR code URL for authenticator apps
   */
  static generateQRCodeURL(secret: string, email: string, issuer: string = 'Verdexis'): string {
    const encoded = encodeURIComponent(`otpauth://totp/${issuer}:${email}?secret=${secret}&issuer=${issuer}`)
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`
  }

  /**
   * Enable 2FA for user
   */
  static async enableTwoFactor(userId: string): Promise<{ secret: string; backupCodes: string[]; qrCodeUrl: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const secret = this.generateSecret()
    const backupCodes = this.generateBackupCodes()
    const hashedCodes = backupCodes.map(code => this.hashBackupCode(code))

    // Store secret and backup codes in user prefs
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (userRecord?.prefs) prefs = JSON.parse(userRecord.prefs)
    } catch {
      prefs = {}
    }

    prefs.twoFactorSecret = secret
    prefs.twoFactorBackupCodes = hashedCodes
    prefs.twoFactorEnabledAt = new Date().toISOString()

    await prisma.user.update({
      where: { id: userId },
      data: {
        prefs: JSON.stringify(prefs),
        twoFactor: true,
      },
    })

    const qrCodeUrl = this.generateQRCodeURL(secret, user.email)

    return { secret, backupCodes, qrCodeUrl }
  }

  /**
   * Disable 2FA for user
   */
  static async disableTwoFactor(userId: string): Promise<void> {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (userRecord?.prefs) prefs = JSON.parse(userRecord.prefs)
    } catch {
      prefs = {}
    }

    delete (prefs as { twoFactorSecret?: unknown }).twoFactorSecret
    delete (prefs as { twoFactorBackupCodes?: unknown }).twoFactorBackupCodes
    delete (prefs as { twoFactorEnabledAt?: unknown }).twoFactorEnabledAt

    await prisma.user.update({
      where: { id: userId },
      data: {
        prefs: JSON.stringify(prefs),
        twoFactor: false,
      },
    })
  }

  /**
   * Verify 2FA token
   */
  static async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!userRecord?.prefs) {
      return false
    }

    let prefs: Record<string, unknown> = {}
    try {
      prefs = JSON.parse(userRecord.prefs)
    } catch {
      return false
    }

    const secret = (prefs as { twoFactorSecret?: string }).twoFactorSecret
    if (!secret) {
      return false
    }

    return this.verifyToken(secret, token)
  }

  /**
   * Use backup code
   */
  static async useBackupCode(userId: string, code: string): Promise<boolean> {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!userRecord?.prefs) {
      return false
    }

    let prefs: Record<string, unknown> = {}
    try {
      prefs = JSON.parse(userRecord.prefs)
    } catch {
      return false
    }

    const backupCodes = (prefs as { twoFactorBackupCodes?: string[] }).twoFactorBackupCodes || []
    const hashedCode = this.hashBackupCode(code)

    const index = backupCodes.indexOf(hashedCode)
    if (index === -1) {
      return false
    }

    // Remove used code
    backupCodes.splice(index, 1)
    prefs.twoFactorBackupCodes = backupCodes

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    return true
  }
}

export const totpService = new TOTPService()
