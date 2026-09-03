import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { createUser, getUserByEmail, updateUser } from '../services/userStore.js'
import { notifyAdminNewUser } from '../notificationService.js'
import { grantSignupBonusIfEligible } from '../services/signupBonus.js'
import { generateInvestmentId } from '../investmentId.js'

export const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>()

export function clearFailedLoginAttempts(email: string): void {
  try { failedLoginAttempts.delete(String(email || '').toLowerCase().trim()) } catch { /* ignore */ }
}

export const ADMIN_EMAILS = (env.ADMIN_EMAILS || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
export const DEFAULT_ADMIN_EMAIL = 'admin@verdexisgroup.com'

export function publicUser(u: any) {
  const role = u.role === 'admin' ? 'admin' : u.role === 'subadmin' ? 'subadmin' : 'user'
  return {
    id: u.id,
    email: u.email,
    username: u.username ?? null,
    name: u.name,
    avatar: u.avatar ?? null,
    twoFactor: !!u.twoFactor,
    role,
    suspended: !!u.suspended,
    investmentId: u.investmentId ?? null,
    kycStatus: u.kycStatus || 'none',
    kycTier: u.kycTier || 'UNVERIFIED',
    emailVerified: !!u.emailVerified,
    emailVerifiedAt: u.emailVerifiedAt ?? null,
    phoneVerified: !!u.phoneVerified,
    phoneVerifiedAt: u.phoneVerifiedAt ?? null,
    prefs: typeof u.prefs === 'string' ? (() => { try { return JSON.parse(u.prefs) } catch { return {} } })() : (u.prefs || {}),
  }
}

export function buildPendingVerificationPayload(opts: {
  kind: 'signup' | 'login'
  pendingToken: string
  email: string
}) {
  return {
    otpRequired: true as const,
    pendingToken: opts.pendingToken,
    verificationType: opts.kind,
    email: opts.email,
    message:
      opts.kind === 'signup'
        ? 'Check your email for a 6-digit verification code to complete registration.'
        : 'Check your email for a 6-digit code to continue signing in.',
  }
}

export async function autoPromoteIfAdminEmail(userId: string, email: string, currentRole: string): Promise<string> {
  if (currentRole === 'admin') return 'admin'
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) return currentRole
  await updateUser(userId, { role: 'admin' })
  return 'admin'
}

export async function promoteAllAdminEmails(): Promise<void> {
  const adminEmails = ADMIN_EMAILS.length ? ADMIN_EMAILS : [DEFAULT_ADMIN_EMAIL]
  const seedPassword = env.ADMIN_SEED_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'Admin@Verdexis2024'
  for (const email of adminEmails) {
    try {
      let u = await getUserByEmail(email)
      if (!u) {
        const passwordHash = await bcrypt.hash(seedPassword, 12)
        const investmentId = await generateInvestmentId().catch(() => `VDX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`)
        u = await createUser({ email, name: 'Admin', passwordHash, investmentId, role: 'admin', emailVerified: true, emailVerifiedAt: new Date() } as any)
        console.log(`[verdexis-api] created admin user ${email}`)
      } else if (!u.passwordHash || u.passwordHash.length < 20) {
        const passwordHash = await bcrypt.hash(seedPassword, 12)
        await updateUser(u.id, { passwordHash, tokenVersion: (u.tokenVersion ?? 0) + 1 })
      }
      await autoPromoteIfAdminEmail(u.id, u.email, u.role)
    } catch (e) {
      console.error(`[verdexis-api] failed to promote ${email}:`, (e as Error).message)
    }
  }
}

export async function markEmailVerifiedAndNotifyAdmin(userId: string): Promise<void> {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      investmentId: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
  })
  if (!before) return

  const wasVerified = !!before.emailVerified
  await updateUser(userId, { emailVerified: true, emailVerifiedAt: new Date() })

  if (!wasVerified) {
    try {
      const bonus = await grantSignupBonusIfEligible(userId)
      if (bonus.granted) {
        console.log(`[auth] signup bonus $${bonus.amountUsd} granted (locked) for ${userId}`)
      }
    } catch (err) {
      console.error('[auth] signup bonus grant failed:', err)
    }

    process.nextTick(() => {
      notifyAdminNewUser({
        id: before.id,
        email: before.email,
        name: before.name,
        investmentId: before.investmentId,
        role: before.role,
        createdAt: before.createdAt,
      }).catch((err) => {
        console.error('[auth] Failed to send new-user admin notification:', err)
      })
    })
  }
}

export const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).trim(),
  phone: z.string().trim().min(7).max(32).regex(/^[+0-9 ()\-.]+$/, 'Invalid phone number').optional(),
  address: z.string().trim().min(5).max(200).optional(),
})

export const loginSchema = z.object({
  identifier: z.string().min(3).max(200).trim().toLowerCase().optional(),
  email: z.string().min(3).max(200).trim().toLowerCase().optional(),
  password: z.string().min(1).max(200),
}).refine((d) => !!(d.identifier || d.email), { message: 'identifier or email required' })

export const forgotSchema = z.object({ email: z.string().email().toLowerCase().trim() })
export const resetSchema = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) })
export const resendSignupOtpSchema = z.object({ email: z.string().email().toLowerCase().trim() })
export const verifySignupOtpSchema = z.object({
  pendingToken: z.string().min(10),
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
})
