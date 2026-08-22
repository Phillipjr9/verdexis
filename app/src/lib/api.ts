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
  emailVerified?: boolean
  emailVerifiedAt?: string | null
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

  if (status === 429 || /too many attempts|rate limit|too many requests/i.test(message)) {
    return `Too many attempts. Please wait a moment and try again.${supportHint}`
  }

  if (status && status >= 500) {
    return `Service temporarily unavailable. Please try again in a few minutes.${supportHint}`
  }

  if (status === 0 || status === 408 || /network|timeout|failed to fetch|load failed/i.test(message)) {
    return `Connection problem. Check your internet and try again.${supportHint}`
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
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

const TOKEN_SET_AT_KEY = 'verdexis_token_set_at'

export function getTokenSetAt(): number | null {
  try {
    const v = localStorage.getItem(TOKEN_SET_AT_KEY)
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function setTokenWithTimestamp(token: string | null) {
  setToken(token)
  try {
    if (token) localStorage.setItem(TOKEN_SET_AT_KEY, String(Date.now()))
    else localStorage.removeItem(TOKEN_SET_AT_KEY)
  } catch {
    /* ignore */
  }
}

export function getStoredUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ApiUser
  } catch {
    return null
  }
}

export function setStoredUser(user: ApiUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

const AUTH_RETRY_KEY = 'verdexis_auth_retry_token'

export function setAuthRetryGuard(token: string | null) {
  try {
    if (token) sessionStorage.setItem(AUTH_RETRY_KEY, token)
    else sessionStorage.removeItem(AUTH_RETRY_KEY)
  } catch {
    /* ignore */
  }
}

export function getAuthRetryGuard(): string | null {
  try {
    return sessionStorage.getItem(AUTH_RETRY_KEY)
  } catch {
    return null
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_SET_AT_KEY)
    sessionStorage.removeItem(AUTH_RETRY_KEY)
  } catch {
    /* ignore */
  }
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function request<T>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const { idempotencyKey, ...init } = options
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

  let res: Response
  try {
    res = await fetch(path.startsWith('http') ? path : path, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    const err: ApiError = { error: msg, status: 0 }
    throw err
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
    const err: ApiError = {
      error: typeof body.error === 'string' ? body.error : res.statusText || 'Request failed',
      details: body.details,
      status: res.status,
    }
    throw err
  }

  return data as T
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: ApiUser } | { otpRequired: true; pendingToken: string; message?: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  loginVerifyOtp: (pendingToken: string, code: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    }),
  signup: (
    email: string,
    password: string,
    name?: string,
    phone?: string,
    address?: string,
    opts?: { referralCode?: string; ref?: string; source?: string },
  ) =>
    request<{ token: string; user: ApiUser } | { pendingToken: string; message?: string; otpRequired?: boolean }>(
      '/api/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          address,
          ...((opts?.referralCode || opts?.ref)
            ? {
                referralCode: String(opts.referralCode || opts.ref || '').trim(),
                ref: String(opts.ref || opts.referralCode || '').trim(),
              }
            : {}),
          ...(opts?.source ? { source: opts.source } : {}),
        }),
      },
    ),
  signupVerifyOtp: (pendingToken: string, code: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/signup/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    }),
  signupResendOtp: (email: string) =>
    request<{ message?: string }>('/api/auth/signup/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  forgot: (email: string) =>
    request<{ message?: string }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message?: string }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  me: () => request<ApiUser>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Referrals
  validateReferralCode: (code: string) =>
    request<{
      valid: boolean
      code: string | null
      reason: string
      message: string
      referrerName: string | null
      formatOk: boolean
      normalized: string | null
    }>(`/api/referrals/validate?code=${encodeURIComponent(code)}`),
  getReferralSummary: () =>
    request<{ referralCode: string | null; totalEarned: number; activeReferrals: number; pendingReferrals: number }>(
      '/api/referrals/me',
    ),
  getReferralList: () =>
    request<{
      referrals: Array<{
        id: string
        refereeEmail: string
        status: string
        firstDepositAt: string | null
        firstDepositAmount: number | null
        referrerBonusUsd: number | null
      }>
    }>('/api/referrals/list'),

  // Profile / wallet / etc. — thin wrappers used across the app
  getProfile: () => request<Record<string, unknown>>('/api/profile'),
  updateProfile: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
  getWallet: () => request<Record<string, unknown>>('/api/wallet'),
  getHoldings: () => request<unknown[]>('/api/holdings'),
  getTransactions: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<{ transactions: unknown[]; total?: number }>(`/api/wallet/transactions${q}`)
  },
}
