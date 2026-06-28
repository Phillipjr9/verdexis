import crypto from 'node:crypto'
import { prisma } from '../db.js'

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export class TOTPService {

  /**
   * Generate a random secret key for TOTP
   */
  generateSecret(): string {
    const buffer = crypto.randomBytes(20)
    let secret = ''
    
    for (let i = 0; i < buffer.length; i++) {
      secret += BASE32_CHARS[buffer[i] & 31]
    }
    
    return secret
  }

  /**
   * Generate QR code URL for TOTP setup
   */
  generateQRCodeURL(secret: string, userEmail: string, issuer = 'Verdexis'): string {
    const encodedIssuer = encodeURIComponent(issuer)
    const encodedEmail = encodeURIComponent(userEmail)
    const encodedSecret = secret
    
    const otpauthURL = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
    
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthURL)}`
  }

  /**
   * Generate TOTP code for current time
   */
  generateTOTP(secret: string, timeStep?: number): string {
    const time = Math.floor((timeStep || Date.now()) / 1000)
    const counter = Math.floor(time / 30)
    
    return this.generateHOTP(secret, counter)
  }

  /**
   * Generate HOTP code
   */
  private generateHOTP(secret: string, counter: number): string {
    const secretBuffer = this.base32Decode(secret)
    const counterBuffer = Buffer.alloc(8)
    
    // Write counter as big-endian 64-bit integer
    counterBuffer.writeUInt32BE(0, 0)
    counterBuffer.writeUInt32BE(counter, 4)
    
    const hmac = crypto.createHmac('sha1', secretBuffer)
    hmac.update(counterBuffer)
    const digest = hmac.digest()
    
    const offset = digest[digest.length - 1] & 0x0f
    const binary = ((digest[offset] & 0x7f) << 24) |
                   ((digest[offset + 1] & 0xff) << 16) |
                   ((digest[offset + 2] & 0xff) << 8) |
                   (digest[offset + 3] & 0xff)
    
    const otp = (binary % 1000000).toString()
    return otp.padStart(6, '0')
  }

  /**
   * Verify TOTP code
   */
  verifyTOTP(secret: string, code: string, window = 1): boolean {
    const time = Math.floor(Date.now() / 1000)
    const counter = Math.floor(time / 30)
    
    // Check current time and ±window periods
    for (let i = -window; i <= window; i++) {
      const testCounter = counter + i
      const expectedCode = this.generateHOTP(secret, testCounter)
      
      if (expectedCode === code) {
        return true
      }
    }
    
    return false
  }

  /**
   * Setup TOTP for user
   */
  async setupTOTP(userId: string, userEmail: string): Promise<{
    secret: string
    qrCodeUrl: string
    backupCodes: string[]
  }> {
    const secret = this.generateSecret()
    const qrCodeUrl = this.generateQRCodeURL(secret, userEmail)
    const backupCodes = this.generateBackupCodes()
    
    // Store in user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })
    
    let prefs: any = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }
    
    prefs.totp = {
      secret,
      enabled: false, // Will be enabled after verification
      setupAt: new Date().toISOString(),
      backupCodes: backupCodes.map(code => ({ code, used: false }))
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) }
    })
    
    return {
      secret,
      qrCodeUrl,
      backupCodes
    }
  }

  /**
   * Enable TOTP after verification
   */
  async enableTOTP(userId: string, verificationCode: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })
    
    if (!user?.prefs) return false
    
    try {
      const prefs = JSON.parse(user.prefs)
      const totp = prefs.totp
      
      if (!totp || !totp.secret) return false
      
      // Verify the code
      if (!this.verifyTOTP(totp.secret, verificationCode)) {
        return false
      }
      
      // Enable TOTP
      totp.enabled = true
      totp.enabledAt = new Date().toISOString()
      
      await prisma.user.update({
        where: { id: userId },
        data: { 
          prefs: JSON.stringify(prefs),
          twoFactor: true
        }
      })
      
      return true
    } catch {
      return false
    }
  }

  /**
   * Disable TOTP
   */
  async disableTOTP(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })
    
    if (!user?.prefs) return
    
    try {
      const prefs = JSON.parse(user.prefs)
      
      if (prefs.totp) {
        prefs.totp.enabled = false
        prefs.totp.disabledAt = new Date().toISOString()
      }
      
      await prisma.user.update({
        where: { id: userId },
        data: { 
          prefs: JSON.stringify(prefs),
          twoFactor: false
        }
      })
    } catch (error) {
      console.error('Failed to disable TOTP:', error)
    }
  }

  /**
   * Verify TOTP or backup code
   */
  async verifyUserTOTP(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })
    
    if (!user?.prefs) return false
    
    try {
      const prefs = JSON.parse(user.prefs)
      const totp = prefs.totp
      
      if (!totp || !totp.enabled) return false
      
      // First try TOTP verification
      if (this.verifyTOTP(totp.secret, code)) {
        return true
      }
      
      // Then try backup codes
      const backupCodes = totp.backupCodes || []
      const matchingCode = backupCodes.find((bc: any) => 
        bc.code === code && !bc.used
      )
      
      if (matchingCode) {
        // Mark backup code as used
        matchingCode.used = true
        matchingCode.usedAt = new Date().toISOString()
        
        await prisma.user.update({
          where: { id: userId },
          data: { prefs: JSON.stringify(prefs) }
        })
        
        return true
      }
      
      return false
    } catch {
      return false
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count = 10): string[] {
    const codes = []
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()
      // Format as XXXX-XXXX
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
    }
    
    return codes
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const newCodes = this.generateBackupCodes()
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })
    
    if (!user?.prefs) throw new Error('User not found')
    
    try {
      const prefs = JSON.parse(user.prefs)
      
      if (!prefs.totp) {
        throw new Error('TOTP not setup for user')
      }
      
      prefs.totp.backupCodes = newCodes.map(code => ({ 
        code, 
        used: false,
        generatedAt: new Date().toISOString()
      }))
      
      await prisma.user.update({
        where: { id: userId },
        data: { prefs: JSON.stringify(prefs) }
      })
      
      return newCodes
    } catch (error) {
      throw new Error('Failed to regenerate backup codes')
    }
  }

  /**
   * Get TOTP status for user
   */
  async getTOTPStatus(userId: string): Promise<{
    enabled: boolean
    setupAt?: string
    backupCodesCount: number
    unusedBackupCodes: number
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })
    
    if (!user?.prefs) {
      return {
        enabled: false,
        backupCodesCount: 0,
        unusedBackupCodes: 0
      }
    }
    
    try {
      const prefs = JSON.parse(user.prefs)
      const totp = prefs.totp
      
      if (!totp) {
        return {
          enabled: false,
          backupCodesCount: 0,
          unusedBackupCodes: 0
        }
      }
      
      const backupCodes = totp.backupCodes || []
      const unusedCodes = backupCodes.filter((bc: any) => !bc.used)
      
      return {
        enabled: totp.enabled || false,
        setupAt: totp.setupAt,
        backupCodesCount: backupCodes.length,
        unusedBackupCodes: unusedCodes.length
      }
    } catch {
      return {
        enabled: false,
        backupCodesCount: 0,
        unusedBackupCodes: 0
      }
    }
  }

  /**
   * Base32 decode
   */
  private base32Decode(encoded: string): Buffer {
    const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '')
    let bits = ''
    
    for (const char of cleanInput) {
      const index = BASE32_CHARS.indexOf(char)
      if (index === -1) continue
      bits += index.toString(2).padStart(5, '0')
    }
    
    const bytes = []
    for (let i = 0; i < bits.length; i += 8) {
      const byte = bits.slice(i, i + 8)
      if (byte.length === 8) {
        bytes.push(parseInt(byte, 2))
      }
    }
    
    return Buffer.from(bytes)
  }
}

export const totpService = new TOTPService()