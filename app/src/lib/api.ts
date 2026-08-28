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

export function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(TOKEN_KEY + '_setAt', String(Date.now()))
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_KEY + '_setAt')
    }
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

export function setTokenWithTimestamp(token: string | null) {
  setToken(token)
}

export function setStoredUser(user: ApiUser) {
  try {
    const safeUser = {
      id: user.id,
      email: sanitizeEmail(user.email),
      username: user.username ? sanitizeUsername(user.username) : null,
      name: sanitizeDisplayText(user.name || ''),
      avatar: user.avatar,
      twoFactor: !!user.twoFactor,
      prefs: user.prefs || {},
      role: user.role || 'user',
      suspended: !!user.suspended,
      investmentId: user.investmentId,
      kycStatus: user.kycStatus || 'none',
      kycTier: user.kycTier || 'UNVERIFIED',
      emailVerified: !!user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
    }
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser))
  } catch { /* ignore */ }
}

export function setAuthRetryGuard(token: string | null) {
  try {
    if (token) localStorage.setItem('verdexis_auth_retry', token)
    else localStorage.removeItem('verdexis_auth_retry')
  } catch { /* ignore */ }
}

export function getAuthRetryGuard(): string | null {
  try {
    return localStorage.getItem('verdexis_auth_retry')
  } catch {
    return null
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY + '_setAt')
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('verdexis_auth_retry')
  } catch { /* ignore */ }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

interface RequestOpts extends RequestInit {
  timeoutMs?: number
}

async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const timeoutMs = init.timeoutMs ?? 15000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      let body: any = {}
      try { body = await res.json() } catch { /* ignore */ }
      const err: ApiError = { error: body.error || res.statusText || 'Request failed', details: body.details, status: res.status }
      throw err
    }
    if (res.status === 204) return undefined as T
    return res.json()
  } catch (err: any) {
    clearTimeout(timer)
    if (err && err.name === 'AbortError') {
      const apiErr: ApiError = { error: 'Request timed out', status: 408 }
      throw apiErr
    }

    const msg = (err && (err.message || String(err))) || 'Network error'
    if (err instanceof TypeError || /failed to fetch|network request failed/i.test(msg)) {
      const apiErr: ApiError = { error: 'Network error: unable to reach the server', status: 0, details: err }
      throw apiErr
    }

    if (err && typeof err.status === 'number') throw err

    const apiErr: ApiError = { error: msg, status: 0, details: err }
    throw apiErr
  }
}

export const api = {
  get: <T>(path: string, init: Omit<RequestOpts, 'method'> = {}) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init: Omit<RequestOpts, 'method' | 'body'> = {}) =>
    request<T>(path, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, init: Omit<RequestOpts, 'method' | 'body'> = {}) =>
    request<T>(path, { ...init, method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, init: Omit<RequestOpts, 'method' | 'body'> = {}) =>
    request<T>(path, { ...init, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, init: Omit<RequestOpts, 'method'> = {}) => request<T>(path, { ...init, method: 'DELETE' }),

  health: () => request<{ ok: boolean }>('/api/health'),

  // Auth
  signup: (email: string, password: string, name: string, phone?: string, address?: string) =>
    request<{ token: string; user: ApiUser } | { otpRequired: true; pendingToken: string; verificationType?: 'login' | 'signup'; message?: string; devCode?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
        ...(phone && phone.trim() ? { phone: phone.trim() } : {}),
        ...(address && address.trim() ? { address: address.trim() } : {}),
      }),
    }),
  login: (identifier: string, password: string) =>
    request<{ token: string; user: ApiUser } | { otpRequired: true; pendingToken: string; verificationType?: 'login' | 'signup'; message?: string; devCode?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  me: () => request<{ user: ApiUser }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  verifyEmail: (token: string) => request<{ ok: boolean; token?: string; user?: ApiUser }>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email: string) => request<{ ok: boolean }>('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  requestPasswordReset: (email: string) => request<{ ok: boolean }>('/api/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) => request<{ ok: boolean; token?: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyOtp: (pendingToken: string, code: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ pendingToken, code }) }),
}

/**
 * Best-effort API check. Returns true if the backend responds within 1s,
 * false otherwise. Components can use this to fall back to localStorage.
 */
export async function isApiOnline(): Promise<boolean> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 1000)
    const res = await fetch(`${BASE}/api/health`, { signal: ctl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}
