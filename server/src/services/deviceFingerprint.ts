import crypto from 'node:crypto'
import { prisma } from '../db.js'

export interface DeviceFingerprint {
  userAgent: string
  ipAddress: string
  acceptLanguage: string
  timezone: string
  screenResolution?: string
  platform?: string
}

export interface TrustedDevice {
  id: string
  userId: string
  fingerprint: string
  deviceName: string
  lastSeenAt: Date
  createdAt: Date
  expiresAt: Date
}

export class DeviceFingerprintService {
  private static readonly DEVICE_TRUST_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

  /**
   * Generate device fingerprint hash
   */
  static generateFingerprint(data: DeviceFingerprint): string {
    const combined = `${data.userAgent}|${data.ipAddress}|${data.acceptLanguage}|${data.timezone}`
    return crypto.createHash('sha256').update(combined).digest('hex')
  }

  /**
   * Register a trusted device
   */
  static async registerTrustedDevice(
    userId: string,
    fingerprint: string,
    deviceName: string,
    ipAddress: string,
  ): Promise<TrustedDevice> {
    const expiresAt = new Date(Date.now() + this.DEVICE_TRUST_DURATION_MS)

    const device = await prisma.trustedDevice.create({
      data: {
        userId,
        fingerprint,
        deviceName,
        ipAddress,
        expiresAt,
      },
    })

    return device
  }

  /**
   * Check if device is trusted
   */
  static async isTrustedDevice(userId: string, fingerprint: string): Promise<boolean> {
    const device = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        fingerprint,
        expiresAt: { gt: new Date() },
      },
    })

    if (device) {
      // Update last used time
      await prisma.trustedDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      })
      return true
    }

    return false
  }

  /**
   * Get user's trusted devices
   */
  static async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return prisma.trustedDevice.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastSeenAt: 'desc' },
    })
  }

  /**
   * Remove trusted device
   */
  static async removeTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await prisma.trustedDevice.deleteMany({
      where: {
        id: deviceId,
        userId,
      },
    })

    return result.count > 0
  }

  /**
   * Remove all trusted devices
   */
  static async removeAllTrustedDevices(userId: string): Promise<number> {
    const result = await prisma.trustedDevice.deleteMany({
      where: { userId },
    })

    return result.count
  }

  /**
   * Detect impossible travel (login from two locations too far apart in short time)
   */
  static async detectImpossibleTravel(
    userId: string,
    currentLat: number,
    currentLon: number,
    currentTime: Date,
  ): Promise<boolean> {
    const lastLogin = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!lastLogin?.prefs) {
      return false
    }

    let prefs: Record<string, unknown> = {}
    try {
      prefs = JSON.parse(lastLogin.prefs)
    } catch {
      return false
    }

    const security = (prefs as { security?: Record<string, unknown> }).security as Record<string, unknown> | undefined
    const lastLoginData = security?.lastLogin as Record<string, unknown> | undefined
    const lastGeo = lastLoginData?.geo as Record<string, unknown> | undefined

    if (!lastGeo) {
      return false
    }

    const lastLat = lastGeo.latitude as number | undefined
    const lastLon = lastGeo.longitude as number | undefined
    const lastAt = lastLoginData?.at as string | undefined

    if (!lastLat || !lastLon || !lastAt) {
      return false
    }

    const lastTime = new Date(lastAt)
    const timeDiffMinutes = (currentTime.getTime() - lastTime.getTime()) / (1000 * 60)

    // Calculate distance using Haversine formula (in km)
    const distance = this.haversineDistance(lastLat, lastLon, currentLat, currentLon)

    // If distance > 900 km and time < 1 hour, flag as impossible travel
    const maxSpeedKmPerHour = 900
    const maxDistanceKm = (timeDiffMinutes / 60) * maxSpeedKmPerHour

    return distance > maxDistanceKm
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Check for velocity abuse (too many logins in short time)
   */
  static async checkVelocityAbuse(userId: string, windowMinutes: number = 5): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000)

    const count = await prisma.loginAttempt.count({
      where: {
        userId,
        createdAt: { gte: since },
        success: true,
      },
    })

    return count
  }
}

export const deviceFingerprintService = new DeviceFingerprintService()
