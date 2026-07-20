import crypto from 'node:crypto'
import { prisma } from '../db.js'

export interface APIKey {
  id: string
  userId: string
  name: string
  keyPrefix: string
  rateLimit: number
  permissions: string[]
  active: boolean
  lastUsedAt: Date | null
  createdAt: Date
  expiresAt: Date | null
}

export class APIKeyService {
  private static readonly KEY_LENGTH = 32
  private static readonly PREFIX_LENGTH = 8

  /**
   * Generate API key
   */
  static generateKey(): { key: string; prefix: string } {
    const key = crypto.randomBytes(this.KEY_LENGTH).toString('hex')
    const prefix = key.substring(0, this.PREFIX_LENGTH)
    return { key, prefix }
  }

  /**
   * Hash API key for storage
   */
  static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }

  /**
   * Create API key for user
   */
  static async createAPIKey(
    userId: string,
    name: string,
    permissions: string[] = ['read'],
    rateLimit: number = 1000,
    expiresAt?: Date,
  ): Promise<{ id: string; key: string; prefix: string }> {
    const { key, prefix } = this.generateKey()
    const keyHash = this.hashKey(key)

    const apiKey = await prisma.aPIKey.create({
      data: {
        userId,
        name,
        keyPrefix: prefix,
        keyHash,
        permissions,
        rateLimit,
        active: true,
        expiresAt,
      },
    })

    return { id: apiKey.id, key, prefix }
  }

  /**
   * Verify API key
   */
  static async verifyAPIKey(key: string): Promise<{ userId: string; permissions: string[]; rateLimit: number } | null> {
    const keyHash = this.hashKey(key)

    const apiKey = await prisma.aPIKey.findFirst({
      where: {
        keyHash,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    if (!apiKey) {
      return null
    }

    // Update last used time
    await prisma.aPIKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    return {
      userId: apiKey.userId,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
    }
  }

  /**
   * Get user's API keys
   */
  static async getAPIKeys(userId: string): Promise<APIKey[]> {
    const keys = await prisma.aPIKey.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        name: true,
        keyPrefix: true,
        rateLimit: true,
        permissions: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    return keys
  }

  /**
   * Revoke API key
   */
  static async revokeAPIKey(userId: string, keyId: string): Promise<boolean> {
    const result = await prisma.aPIKey.updateMany({
      where: { id: keyId, userId },
      data: { active: false },
    })

    return result.count > 0
  }

  /**
   * Delete API key
   */
  static async deleteAPIKey(userId: string, keyId: string): Promise<boolean> {
    const result = await prisma.aPIKey.deleteMany({
      where: { id: keyId, userId },
    })

    return result.count > 0
  }

  /**
   * Update API key permissions
   */
  static async updateAPIKeyPermissions(userId: string, keyId: string, permissions: string[]): Promise<boolean> {
    const result = await prisma.aPIKey.updateMany({
      where: { id: keyId, userId },
      data: { permissions },
    })

    return result.count > 0
  }

  /**
   * Check rate limit for API key
   */
  static async checkRateLimit(keyId: string, windowSeconds: number = 60): Promise<{ allowed: boolean; remaining: number }> {
    const since = new Date(Date.now() - windowSeconds * 1000)

    const count = await prisma.aPIKeyUsage.count({
      where: {
        apiKeyId: keyId,
        createdAt: { gte: since },
      },
    })

    const apiKey = await prisma.aPIKey.findUnique({
      where: { id: keyId },
      select: { rateLimit: true },
    })

    const limit = apiKey?.rateLimit ?? 1000
    const remaining = Math.max(0, limit - count)

    return {
      allowed: count < limit,
      remaining,
    }
  }

  /**
   * Record API key usage
   */
  static async recordUsage(keyId: string, endpoint: string, method: string, statusCode: number): Promise<void> {
    await prisma.aPIKeyUsage.create({
      data: {
        apiKeyId: keyId,
        endpoint,
        method,
        statusCode,
      },
    })
  }
}

export const apiKeyService = new APIKeyService()
