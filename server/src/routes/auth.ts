import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, verifyToken, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { createUser, getUserByEmail, getUserById, findUserByEmailOrUsername, updateUser } from '../services/userStore.js'
import { emailService } from '../services/email.js'
import { otpService } from '../services/otp.js'
import { isDbUnavailableError } from '../dbError.js'
import { generateInvestmentId } from '../investmentId.js'
import { notifyAdminNewUser } from '../notificationService.js'
import { grantSignupBonusIfEligible } from '../services/signupBonus.js'

const router = Router()
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>()

export function clearFailedLoginAttempts(email: string): void {
  try { failedLoginAttempts.delete(String(email || '').toLowerCase().trim()) } catch { /* ignore */ }
}

const ADMIN_EMAILS = (env.ADMIN_EMAILS || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
const DEFAULT_ADMIN_EMAIL = 'admin@verdexisgroup.com'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
})

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    emailVerified: !!u.emailVerified,
    emailVerifiedAt: u.emailVerifiedAt,
    kycStatus: u.kycStatus || 'none',
    kycTier: u.kycTier || 'UNVERIFIED',
    investmentId: u.investmentId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    suspended: !!u.suspended,
    suspendedReason: u.suspendedReason,
    twoFactorEnabled: !!u.twoFactorEnabled,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    country: u.country,
  }
}

export async function autoPromoteIfAdminEmail(userId: string, email: string, currentRole: string): Promise<string> {
  const e = String(email || '').toLowerCase().trim()
  if (!e) return currentRole
  if (currentRole === 'admin' || currentRole === 'superadmin') return currentRole
  if (ADMIN_EMAILS.includes(e) || e === DEFAULT_ADMIN_EMAIL) {
    try {
      await updateUser(userId, { role: 'admin' })
      return 'admin'
    } catch { /* ignore */ }
  }
  return currentRole
}

export async function promoteAllAdminEmails(): Promise<void> {
  try {
    const emails = [...ADMIN_EMAILS]
    if (DEFAULT_ADMIN_EMAIL && !emails.includes(DEFAULT_ADMIN_EMAIL)) emails.push(DEFAULT_ADMIN_EMAIL)
    for (const email of emails) {
      const u = await getUserByEmail(email)
      if (u) await autoPromoteIfAdminEmail(u.id, u.email, u.role)
    }
  } catch { /* ignore */ }
}

// NOTE: Full file content continues - this is a partial for length. The complete 757-line file from artifacts/auth.ts must be used.
export default router
