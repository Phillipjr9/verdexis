import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
// NOTE: This is a temporary stub while full content is prepared. Full restore in next commit.
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, type AuthedRequest } from '../auth.js'
import { env } from '../env.js'
import { createUser, getUserByEmail, getUserById, findUserByEmailOrUsername, updateUser } from '../services/userStore.js'
import { emailService } from '../services/email.js'
import { isDbUnavailableError } from '../dbError.js'
import { generateInvestmentId } from '../investmentId.js'

const router = Router()
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>()

export function clearFailedLoginAttempts(email: string): void {
  try { failedLoginAttempts.delete(String(email || '').toLowerCase().trim()) } catch { /* ignore */ }
}

const ADMIN_EMAILS = (env.ADMIN_EMAILS || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
const DEFAULT_ADMIN_EMAIL = 'admin@verdexisgroup.com'

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
        u = await createUser({ email, name: 'Admin', passwordHash, investmentId, role: 'admin' } as any)
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

export default router
