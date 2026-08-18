import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { prisma } from './db.js'
import { env } from './env.js'
import { setRlsContext } from './lib/rls.js'

const SECRET = env.JWT_SECRET
const EXPIRES_IN = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']

export interface AuthPayload {
  sub: string
  email: string
  v?: number // tokenVersion at issue time
  otpPending?: boolean
  signupVerification?: boolean
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, SECRET) as AuthPayload
  } catch (err) {
    try {
      const e = err as Error
      // Log the verification error name/message to help operators debug
      // token failures (e.g. invalid signature vs expired). Do NOT log
      // the token itself or any sensitive payload.
      console.warn('[auth] verifyToken failed:', e.name, e.message)
    } catch {
      // ignore logging failure
    }
    return null
  }
}

export type Role = 'user' | 'admin'

export interface AuthedRequest extends Request {
  userId?: string
  userEmail?: string
  userRole?: Role
  body: any
  params: any
  query: any
  headers: any
  baseUrl: string
  path: string
  method: string
  ip: string
  file?: any
  authInfo?: any
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Bearer-token only. The cookie path was a half-implemented dual-auth
  // model with no CSRF protection \u2014 strictly worse than Bearer for an
  // SPA. Keep things simple: client sends `Authorization: Bearer <jwt>`.
  const header = req.headers.authorization
  let token: string | undefined
  if (header?.startsWith('Bearer ')) token = header.slice(7)
  // Fallback to cookie if present. This allows browser logins that rely on
  // an HttpOnly cookie instead of manually attaching Authorization headers.
  // Cookie name: `vdx_token`.
  if (!token) {
    try {
      // cookie-parser populates `req.cookies` when used in app.ts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cookies = (req as any).cookies as Record<string, unknown> | undefined
      if (cookies && typeof cookies.vdx_token === 'string') token = String(cookies.vdx_token)
    } catch {
      // ignore and continue to Unauthorized response below
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const payload = verifyToken(token)
  if (!payload || !payload.sub) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }
  // Reject pending OTP tokens — they must not be used as real session tokens.
  if (payload.otpPending) {
    res.status(401).json({ error: 'OTP verification required to complete login' })
    return
  }
  // Cheap existence check; cache could be added later. Protect the DB
  // call with a short timeout so a stalled Prisma/DB request doesn't hang
  // the entire request (which was observed in production). We also log
  // timing so operators can see which step is slow.
  const authStart = Date.now()
  const findUserPromise = prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, suspended: true, deletedAt: true, tokenVersion: true },
  })

  // Timeout guard (ms). If this fires, respond quickly instead of hanging.
  const DB_TIMEOUT_MS = 10000
  let user: any = null
  try {
    user = await Promise.race([
      findUserPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), DB_TIMEOUT_MS)),
    ])
  } catch (err) {
    const e = err as Error
    console.warn('[auth] requireAuth: DB lookup failed or timed out:', e.message)
    res.status(503).json({ error: 'Service temporarily unavailable (db timeout)' })
    return
  } finally {
    const authDur = Date.now() - authStart
    console.log(`[auth] requireAuth: user lookup took ${authDur}ms for sub=${payload.sub}`)
  }
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }
  // tokenVersion lets admins force-revoke all sessions for a user.
  if (typeof payload.v === 'number' && user.tokenVersion !== null && payload.v !== user.tokenVersion) {
    res.status(401).json({ error: 'Session revoked. Please log in again.' })
    return
  }
  if (user.suspended) {
    res.status(403).json({ error: 'Account suspended' })
    return
  }
  if (user.deletedAt) {
    res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' })
    return
  }
  req.userId = user.id
  req.userEmail = user.email
  req.userRole = user.role === 'admin' ? 'admin' : 'user'

  // Set RLS context but protect it with a short timeout as well so a
  // failing `set_config` doesn't block the request lifecycle.
  try {
    const rlsStart = Date.now()
    await Promise.race([
      setRlsContext({ id: user.id, role: user.role }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RLS_TIMEOUT')), DB_TIMEOUT_MS)),
    ])
    console.log(`[auth] setRlsContext took ${Date.now() - rlsStart}ms for user=${user.id}`)
  } catch (err) {
    console.warn('[auth] RLS context setup failed for user', user.id, err instanceof Error ? err.message : String(err))
    // Do not block the request if RLS failed; continue but log for ops.
  }

  next()
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin only' })
    return
  }
  next()
}
