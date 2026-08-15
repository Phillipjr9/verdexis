import jwt from 'jsonwebtoken'
import { env } from '../env.js'

export const ADMIN_EMAIL_ACTION_AUDIENCE = 'verdexis-admin-deposit-email'

export type AdminEmailActionPayload = {
  action: 'approve' | 'reject'
  depositId: string
  adminEmail: string
}

export function createDepositActionToken(depositId: string, action: 'approve' | 'reject', adminEmail: string): string {
  // Avoid duplicating the `aud` claim: pass audience via options only
  return jwt.sign(
    { depositId, action, adminEmail: adminEmail.toLowerCase() },
    env.JWT_SECRET,
    { audience: ADMIN_EMAIL_ACTION_AUDIENCE, expiresIn: '48h' },
  )
}

export function verifyDepositActionToken(value: string): AdminEmailActionPayload | null {
  try {
    const payload = jwt.verify(value, env.JWT_SECRET, { audience: ADMIN_EMAIL_ACTION_AUDIENCE }) as Partial<AdminEmailActionPayload>
    if ((payload.action !== 'approve' && payload.action !== 'reject') || !payload.depositId || !payload.adminEmail) return null
    return payload as AdminEmailActionPayload
  } catch {
    return null
  }
}
