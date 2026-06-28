import crypto from 'node:crypto'
import { prisma } from '../db.js'

interface DeviceFingerprint {
  userAgent: string
  screenResolution: string
  timezone: string
  language: string
  platform: string
  cookiesEnabled: boolean
  localStorage: boolean
  sessionStorage: boolean
  indexedDB: boolean
  webGL: string
  canvas: string
  audioContext: string
}

interface TrustedDevice {
  id: string
  userId: string
  deviceHash: string
  deviceName: string
  fingerprint: DeviceFingerprint
  ipAddress: string
  location?: {
    country: string
    city: string
    latitude: number
    longitude: number
  }
  isTrusted: boolean
  trustLevel: number // 0-100
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
}

export class TrustedDeviceService {
  
  /**
   * Generate device hash from fingerprint
   */
  generateDeviceHash(fingerprint: DeviceFingerprint, ipAddress: string): string {
    const data = JSON.stringify({
      userAgent: fingerprint.userAgent,
      screen: fingerprint.screenResolution,
      timezone: fingerprint.timezone,
      webGL: fingerprint.webGL,
      canvas: fingerprint.canvas,
      ip: ipAddress
    })
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Calculate trust score based on device characteristics
   */
  calculateTrustScore(fingerprint: DeviceFingerprint, ipAddress: string, userId: string): number {
    let score = 50 // Base score
    
    // Known good user agent patterns
    if (/Chrome|Firefox|Safari|Edge/.test(fingerprint.userAgent)) score += 10
    
    // Consistent timezone
    if (fingerprint.timezone) score += 5
    
    // Standard screen resolution
    const [width, height] = fingerprint.screenResolution.split('x').map(Number)
    if (width >= 1024 && height >= 768) score += 5
    
    // Modern browser features
    if (fingerprint.localStorage && fingerprint.sessionStorage) score += 10
    if (fingerprint.indexedDB) score += 5
    
    // Canvas fingerprint exists (not blocked)
    if (fingerprint.canvas && fingerprint.canvas.length > 50) score += 10
    
    // WebGL available
    if (fingerprint.webGL) score += 5
    
    return Math.min(100, Math.max(0, score))
  }

  /**
   * Register or update device
   */
  async registerDevice(
    userId: string, 
    fingerprint: DeviceFingerprint, 
    ipAddress: string,
    location?: any,
    deviceName?: string
  ): Promise<TrustedDevice> {
    const deviceHash = this.generateDeviceHash(fingerprint, ipAddress)
    const trustLevel = this.calculateTrustScore(fingerprint, ipAddress, userId)
    
    // Check if device already exists
    const existing = await this.getDeviceByHash(userId, deviceHash)
    
    if (existing) {
      // Update last seen
      return this.updateDevice(existing.id, {
        lastSeenAt: new Date(),
        ipAddress,
        location,
        trustLevel
      })
    }

    // Create new device
    const deviceData = {
      userId,
      deviceHash,
      deviceName: deviceName || this.generateDeviceName(fingerprint),
      fingerprint: JSON.stringify(fingerprint),
      ipAddress,
      location: location ? JSON.stringify(location) : null,
      isTrusted: trustLevel >= 70, // Auto-trust high-score devices
      trustLevel,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }

    const device = await prisma.trustedDevice.create({ data: deviceData })
    
    return {
      ...device,
      fingerprint: JSON.parse(device.fingerprint),
      location: device.location ? JSON.parse(device.location) : undefined
    }
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, fingerprint: DeviceFingerprint, ipAddress: string): Promise<boolean> {
    const deviceHash = this.generateDeviceHash(fingerprint, ipAddress)
    const device = await this.getDeviceByHash(userId, deviceHash)
    
    if (!device) return false
    if (!device.isTrusted) return false
    if (device.expiresAt < new Date()) return false
    
    // Update last seen
    await this.updateDevice(device.id, { lastSeenAt: new Date() })
    
    return true
  }

  /**
   * Get device by hash
   */
  private async getDeviceByHash(userId: string, deviceHash: string) {
    return prisma.trustedDevice.findFirst({
      where: { userId, deviceHash }
    })
  }

  /**
   * Update device
   */
  private async updateDevice(deviceId: string, data: any) {
    return prisma.trustedDevice.update({
      where: { id: deviceId },
      data
    })
  }

  /**
   * Generate human-readable device name
   */
  private generateDeviceName(fingerprint: DeviceFingerprint): string {
    const ua = fingerprint.userAgent.toLowerCase()
    
    // Browser detection
    let browser = 'Browser'
    if (ua.includes('chrome')) browser = 'Chrome'
    else if (ua.includes('firefox')) browser = 'Firefox'
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
    else if (ua.includes('edge')) browser = 'Edge'
    
    // OS detection
    let os = 'Desktop'
    if (ua.includes('windows')) os = 'Windows'
    else if (ua.includes('mac')) os = 'macOS'
    else if (ua.includes('linux')) os = 'Linux'
    else if (ua.includes('iphone')) os = 'iPhone'
    else if (ua.includes('android')) os = 'Android'
    
    return `${browser} on ${os}`
  }

  /**
   * Get user's trusted devices
   */
  async getUserDevices(userId: string): Promise<TrustedDevice[]> {
    const devices = await prisma.trustedDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' }
    })

    return devices.map(device => ({
      ...device,
      fingerprint: JSON.parse(device.fingerprint),
      location: device.location ? JSON.parse(device.location) : undefined
    }))
  }

  /**
   * Revoke device trust
   */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    await prisma.trustedDevice.update({
      where: { id: deviceId, userId },
      data: { isTrusted: false }
    })
  }

  /**
   * Clean expired devices
   */
  async cleanupExpiredDevices(): Promise<number> {
    const result = await prisma.trustedDevice.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })
    return result.count
  }
}

export const trustedDeviceService = new TrustedDeviceService()