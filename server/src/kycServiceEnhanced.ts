import crypto from 'node:crypto'
import { env } from './env.js'
import { prisma } from './db.js'

// Encryption key from env or JWT secret
const ENCRYPTION_KEY = (() => {
  const key = process.env.KYC_ENCRYPTION_KEY || env.JWT_SECRET
  const hash = crypto.createHash('sha256').update(key).digest()
  return hash.slice(0, 32)
})()

export interface KycData {
  firstName: string
  lastName: string
  dob: string
  country: string
  ssn: string
  addressStreet: string
  addressCity: string
  addressZip: string
  idDocType: 'passport' | 'dl' | 'id'
}

export interface EncryptedKyc {
  ssnEncrypted: string
  firstName: string
  lastName: string
  dob: string
  country: string
  addressStreet: string
  addressCity: string
  addressZip: string
  idDocType: string
}

export const KYC_TIER_CONFIG = {
  UNVERIFIED: {
    name: 'Unverified',
    requirements: [] as string[],
    dailyWithdrawLimit: 100,
    monthlyWithdrawLimit: 500,
    dailyTransferLimit: 500,
    monthlyTransferLimit: 2000,
    maxTradeSize: 1000,
  },
  TIER_1: {
    name: 'Basic',
    requirements: ['identity', 'selfie'],
    dailyWithdrawLimit: 5000,
    monthlyWithdrawLimit: 50000,
    dailyTransferLimit: 10000,
    monthlyTransferLimit: 100000,
    maxTradeSize: 50000,
  },
  TIER_2: {
    name: 'Full',
    requirements: ['identity', 'address', 'selfie'],
    dailyWithdrawLimit: 50000,
    monthlyWithdrawLimit: 500000,
    dailyTransferLimit: 100000,
    monthlyTransferLimit: 1000000,
    maxTradeSize: 500000,
  },
  TIER_3: {
    name: 'Enhanced',
    requirements: ['identity', 'address', 'selfie', 'admin_review'],
    dailyWithdrawLimit: 250000,
    monthlyWithdrawLimit: 5000000,
    dailyTransferLimit: 500000,
    monthlyTransferLimit: 10000000,
    maxTradeSize: 5000000,
  },
}

/**
 * Encrypt SSN using AES-256-GCM
 */
export function encryptSsn(ssn: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)

  let encrypted = cipher.update(ssn, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()
  const payload = {
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  }

  return JSON.stringify(payload)
}

/**
 * Decrypt SSN with authentication
 */
export function decryptSsn(encrypted: string): string {
  try {
    const payload = JSON.parse(encrypted) as { iv: string; encrypted: string; authTag: string }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(payload.iv, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'))

    let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (e) {
    throw new Error(`Failed to decrypt SSN: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Validate SSN format
 */
export function validateSsn(ssn: string): boolean {
  const cleaned = ssn.replace(/-/g, '')
  return /^\d{9}$/.test(cleaned)
}

/**
 * Mask SSN for display
 */
export function maskSsn(ssn: string): string {
  const cleaned = ssn.replace(/-/g, '').slice(-4)
  return `***-**-${cleaned}`
}

/**
 * Determine KYC tier based on documents and status
 */
export async function determineTier(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      kycStatus: true,
      kycDocumentsJson: true,
    },
  })

  if (!user) return 'UNVERIFIED'

  let docs: Array<{ type: string; uploaded: boolean }> = []
  try {
    if (user.kycDocumentsJson) {
      docs = JSON.parse(user.kycDocumentsJson)
    }
  } catch (e) {
    docs = []
  }

  const hasIdentity = docs.some(d => d.type === 'identity' && d.uploaded)
  const hasAddress = docs.some(d => d.type === 'address' && d.uploaded)
  const hasSelfie = docs.some(d => d.type === 'selfie' && d.uploaded)

  if (user.kycStatus === 'approved') {
    return hasIdentity && hasAddress && hasSelfie ? 'TIER_2' : 'TIER_1'
  }

  if (user.kycStatus === 'pending') {
    return 'TIER_3'
  }

  if (hasIdentity && hasSelfie) {
    return 'TIER_1'
  }

  return 'UNVERIFIED'
}

/**
 * Update user tier and limits
 */
export async function updateUserTier(userId: string): Promise<string> {
  const tier = await determineTier(userId)
  const tierConfig = KYC_TIER_CONFIG[tier as keyof typeof KYC_TIER_CONFIG]

  if (tierConfig) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        kycTier: tier,
        kycTierUpdatedAt: new Date(),
        dailyWithdrawLimit: tierConfig.dailyWithdrawLimit,
        monthlyWithdrawLimit: tierConfig.monthlyWithdrawLimit,
        dailyTransferLimit: tierConfig.dailyTransferLimit,
        monthlyTransferLimit: tierConfig.monthlyTransferLimit,
      },
    })
  }

  return tier
}

/**
 * Check if user can perform action based on tier
 */
export async function checkTierLimit(
  userId: string,
  action: 'withdraw' | 'transfer' | 'trade',
  amount: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      kycTier: true,
      dailyWithdrawLimit: true,
      monthlyWithdrawLimit: true,
      dailyTransferLimit: true,
      monthlyTransferLimit: true,
    },
  })

  if (!user) return { allowed: false, reason: 'User not found' }

  const tier = user.kycTier || 'UNVERIFIED'
  const tierConfig = KYC_TIER_CONFIG[tier as keyof typeof KYC_TIER_CONFIG]

  if (!tierConfig) {
    return { allowed: false, reason: 'Invalid tier configuration' }
  }

  let limit = 0
  switch (action) {
    case 'withdraw':
      limit = user.dailyWithdrawLimit || tierConfig.dailyWithdrawLimit
      if (amount > limit) {
        return { allowed: false, reason: `Daily withdraw limit: $${limit}` }
      }
      break
    case 'transfer':
      limit = user.dailyTransferLimit || tierConfig.dailyTransferLimit
      if (amount > limit) {
        return { allowed: false, reason: `Daily transfer limit: $${limit}` }
      }
      break
    case 'trade':
      limit = tierConfig.maxTradeSize
      if (amount > limit) {
        return { allowed: false, reason: `Max trade size: $${limit}` }
      }
      break
  }

  return { allowed: true }
}

/**
 * Validate file for upload
 */
export function validateDocumentFile(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): { valid: boolean; error?: string } {
  // Check mime type
  const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowedMimes.includes(mimetype)) {
    return { valid: false, error: 'Invalid file type. Only JPG, PNG, or PDF allowed' }
  }

  // Check file size (8MB max)
  const maxSize = 8 * 1024 * 1024
  if (buffer.length > maxSize) {
    return { valid: false, error: 'File too large. Maximum 8MB' }
  }

  // Check for suspicious content (basic check)
  const magicNumbers: Record<string, Buffer> = {
    pdf: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
    jpeg: Buffer.from([0xff, 0xd8, 0xff]),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  }

  let isValid = false
  if (mimetype === 'application/pdf') {
    isValid = buffer.subarray(0, 4).equals(magicNumbers.pdf)
  } else if (mimetype === 'image/jpeg') {
    isValid = buffer.subarray(0, 3).equals(magicNumbers.jpeg)
  } else if (mimetype === 'image/png') {
    isValid = buffer.subarray(0, 4).equals(magicNumbers.png)
  }

  if (!isValid) {
    return { valid: false, error: 'Invalid file content. File may be corrupted' }
  }

  return { valid: true }
}
