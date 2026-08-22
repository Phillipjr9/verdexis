// Lightweight typed fetch wrapper for the Verdexis API.
// Uses a JWT stored in localStorage and prefixes all requests with /api.
import { sanitizeDisplayText, sanitizeEmail, sanitizeText, sanitizeUsername } from './sanitize'

const TOKEN_KEY = 'verdexis_token'
const USER_KEY = 'verdexis_auth'

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
    return `Service temporarily unavailable. Please try again in a moment.${supportHint}`
  }
  if (message) return `${message}${supportHint}`
  return `Something went wrong. Please try again.${supportHint}`
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

const TOKEN_SET_AT = 'verdexis_token_set_at'
export function getTokenSetAt(): number | null {
  try {
    const v = localStorage.getItem(TOKEN_SET_AT)
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch { return null }
}

const AUTH_RETRY_GUARD = 'verdexis_auth_retry_guard'

export function setTokenWithTimestamp(token: string | null) {
  setToken(token)
  try {
    if (token) {
      localStorage.setItem(TOKEN_SET_AT, String(Date.now()))
      localStorage.removeItem(AUTH_RETRY_GUARD)
    } else {
      localStorage.removeItem(TOKEN_SET_AT)
      localStorage.removeItem(AUTH_RETRY_GUARD)
    }
  } catch { /* ignore */ }
}

export function setStoredUser(user: ApiUser) {
  try {
    const safeUser = {
      id: sanitizeDisplayText(user.id, 64),
      email: sanitizeEmail(user.email),
      username: user.username ? sanitizeUsername(user.username) : null,
      name: sanitizeDisplayText(user.name || 'User', 80),
      role: user.role,
      suspended: !!user.suspended,
      investmentId: user.investmentId ? sanitizeDisplayText(user.investmentId, 64) : null,
      kycStatus: user.kycStatus,
      emailVerified: !!user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
    }
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser))
    if (user.avatar) localStorage.setItem('verdexis_avatar', sanitizeText(user.avatar, ''))
    else localStorage.removeItem('verdexis_avatar')
    if (user.prefs && Object.keys(user.prefs).length) {
      localStorage.setItem('verdexis_prefs', JSON.stringify(user.prefs))
    }
    window.dispatchEvent(new Event('verdexis:profile'))
  } catch { /* ignore */ }
}

export function setAuthRetryGuard(token: string | null) {
  try {
    if (token) localStorage.setItem(AUTH_RETRY_GUARD, token)
    else localStorage.removeItem(AUTH_RETRY_GUARD)
  } catch { /* ignore */ }
}

export function getAuthRetryGuard(): string | null {
  try { return localStorage.getItem(AUTH_RETRY_GUARD) } catch { return null }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('verdexis_avatar')
    localStorage.removeItem(TOKEN_SET_AT)
    localStorage.removeItem(AUTH_RETRY_GUARD)
  } catch { /* ignore */ }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

export function newIdempotencyKey(): string {
  try {
    const c = typeof crypto !== 'undefined' ? crypto : undefined
    if (c?.randomUUID) return c.randomUUID()
    if (c?.getRandomValues) {
      const buf = new Uint8Array(16)
      c.getRandomValues(buf)
      return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

interface RequestOpts extends RequestInit {
  idempotencyKey?: string
}

async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal })
    clearTimeout(timeout)
    let body: unknown
    try { body = await res.json() } catch { body = {} }
    if (!res.ok) {
      const err = body as { error?: string; details?: unknown; whatsapp?: string; telegram?: string; reason?: string }
      const apiErr: ApiError = {
        error: err.error || `Request failed with ${res.status}`,
        details: err.details,
        status: res.status,
      }
      if (err.whatsapp) (apiErr as ApiError & { whatsapp?: string }).whatsapp = err.whatsapp
      if (err.telegram) (apiErr as ApiError & { telegram?: string }).telegram = err.telegram
      if (err.reason) (apiErr as ApiError & { reason?: string }).reason = err.reason
      throw apiErr
    }
    return body as T
  } catch (err: any) {
    clearTimeout(timeout)
    if (err && err.name === 'AbortError') throw { error: 'Request timed out', status: 408 } as ApiError
    const msg = (err && (err.message || String(err))) || 'Network error'
    if (err instanceof TypeError || /failed to fetch|network request failed/i.test(msg)) {
      throw { error: 'Network error: unable to reach the server', status: 0, details: err } as ApiError
    }
    if (err && typeof err.status === 'number') throw err
    throw { error: msg, status: 0, details: err } as ApiError
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

  signup: (
    email: string,
    password: string,
    name: string,
    phone?: string,
    address?: string,
    opts?: { referralCode?: string; ref?: string; source?: string },
  ) =>
    request<{ token: string; user: ApiUser } | { otpRequired: true; pendingToken: string; verificationType?: 'login' | 'signup'; message?: string; devCode?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
        ...(phone && phone.trim() ? { phone: phone.trim() } : {}),
        ...(address && address.trim() ? { address: address.trim() } : {}),
        ...((opts?.referralCode || opts?.ref)
          ? {
              referralCode: String(opts.referralCode || opts.ref || '').trim(),
              ref: String(opts.ref || opts.referralCode || '').trim(),
            }
          : {}),
        ...(opts?.source ? { source: opts.source } : {}),
      }),
    }),
  signupVerifyOtp: (pendingToken: string, code: string) =>
    request<{ token: string; user: ApiUser; verified: boolean; emailVerified: boolean; message?: string }>('/api/auth/signup/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    }),
  signupResendOtp: (email: string) =>
    request<{ otpRequired: true; pendingToken: string; verificationType: 'signup'; email: string; message: string; devCode?: string }>('/api/auth/signup/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  loginResendOtp: (pendingToken: string) =>
    request<{ otpRequired: true; pendingToken: string; verificationType: 'login'; email: string; message: string; devCode?: string }>('/api/auth/login-resend-otp', {
      method: 'POST',
      body: JSON.stringify({ pendingToken }),
    }),
  login: (identifier: string, password: string) =>
    request<{ token: string; user: ApiUser } | { otpRequired: true; pendingToken: string; verificationType?: 'login' | 'signup'; message?: string; devCode?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  loginVerifyOtp: (pendingToken: string, code: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    }),
  forgot: (email: string) =>
    request<{ ok: boolean; message: string }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  reset: (token: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  me: () => request<{ user: ApiUser }>('/api/auth/me'),
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
    request<{ referralCode: string | null; totalEarned: number; activeReferrals: number; pendingReferrals: number }>('/api/referrals/me'),
  getReferralList: () =>
    request<{ referrals: Array<{ id: string; refereeEmail: string; status: string; firstDepositAt: string | null; firstDepositAmount: number | null; referrerBonusUsd: number | null }> }>('/api/referrals/list'),

  getWallet: () => request<{ balances: unknown[]; transactions: unknown[] }>('/api/wallet'),
  transferToUser: (
    payload: { recipientEmail: string; currency: string; amount: number; note?: string },
    idempotencyKey?: string,
  ) =>
    request<{ recipient: { email: string; name: string | null } }>(
      '/api/wallet/transfer',
      { method: 'POST', body: JSON.stringify(payload), idempotencyKey },
    ),
}

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
