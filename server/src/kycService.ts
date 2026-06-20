import crypto from 'node:crypto'
import { env } from './env.js'

// Use a master encryption key from env, or generate a stable key from the JWT secret
const ENCRYPTION_KEY = (() => {
  const key = process.env.KYC_ENCRYPTION_KEY || env.JWT_SECRET
  // Ensure it's 32 bytes for AES-256-GCM
  const hash = crypto.createHash('sha256').update(key).digest()
  return hash.slice(0, 32)
})()

export interface KycData {
  firstName: string
  lastName: string
  dob: string // YYYY-MM-DD
  country: string
  ssn: string // XXX-XX-XXXX (9 digits)
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

/**
 * Encrypt SSN using AES-256-GCM. Returns a JSON-serializable object
 * with the encrypted data, IV, and auth tag.
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
 * Decrypt SSN. Throws if the tag doesn't match (tampering detected).
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
 * Validate SSN format (XXX-XX-XXXX or XXXXXXXXX).
 */
export function validateSsn(ssn: string): boolean {
  const cleaned = ssn.replace(/-/g, '')
  return /^\d{9}$/.test(cleaned)
}

/**
 * Format SSN for display (mask all but last 4 digits).
 */
export function maskSsn(ssn: string): string {
  const cleaned = ssn.replace(/-/g, '').slice(-4)
  return `***-**-${cleaned}`
}
