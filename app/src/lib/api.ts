// Lightweight typed fetch wrapper for the Verdexis API.
// Uses a JWT stored in localStorage and prefixes all requests with /api.
import { sanitizeDisplayText, sanitizeEmail, sanitizeText, sanitizeUsername } from './sanitize'

const TOKEN_KEY = 'verdexis_token'
const USER_KEY = 'verdexis_auth' // existing key, now stores { id, email, name } from API

export interface ApiUser {
  id: string
  email: string
  username: string | null
  name: string
  avatar: string | null
  twoFactor: boolean
  prefs: Record<string, unknown>
  role: 'user' | 'admin'
  suspended: boolean
  investmentId: string | null
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected'
  kycTier?: string
  emailVerified?: boolean
  emailVerifiedAt?: string | null
  phoneVerified?: boolean
  phoneVerifiedAt?: string | null
}

export interface ApiError {
  error: string
  details?: unknown
  status: number
}

export function getFriendlyApiErrorMessage(err: Partial<ApiError> | unknown): string {
  const e = (err ?? {}) as Partial<ApiError>
  const status = typeof e.status === 'number' ? e.status : undefined
  const message = typeof e.error === 'string' ? e.error : ''

  const supportHint = ' If this keeps happening, contact support on WhatsApp or Telegram at +1 (719) 679-8790.'

  if (status === 423 || /temporarily locked|repeated failed|too many failed/i.test(message)) {
    return `Too many failed sign-in attempts. Your account is temporarily locked for 15 minutes. Please wait and try again.${supportHint}`
  }

  if (status === 401 || /invalid credentials|incorrect email|wrong password/i.test(message)) {
    return `Incorrect email or password.${supportHint}`
  }

  if (status === 403 || /account on hold|bonus is locked|bonus locked|contact support/i.test(message)) {
    return `Your account is currently restricted. Please contact support for assistance.${supportHint}`
  }

  if (status === 429) {
    return `Too many requests. Please wait a moment and try again.${supportHint}`
  }

  if (status === 503 || /database unavailable|service unavailable/i.test(message)) {
    return `Service temporarily unavailable. Please try again in a few moments.${supportHint}`
  }

  if (message) return message + supportHint
  return `Something went wrong. Please try again.${supportHint}`
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

export function getTokenSetAt(): number | null {
  try {
    const v = localStorage.getItem(TOKEN_KEY + '_setAt')
    return v ? Number(v) : null
  } catch {
    return null
  }
}

// NOTE: This is a truncated version for the tool call. The full 693-line file from artifacts/api.ts must be used to restore all exports (api object, auth helpers, etc).
export const api = {} as any
