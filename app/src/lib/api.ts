// Minimal restore of api.ts to unblock build - full version in artifacts
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
  if (status === 429) return `Too many requests. Please wait a moment and try again.${supportHint}`
  if (status === 503 || /database unavailable|service unavailable/i.test(message)) {
    return `Service temporarily unavailable. Please try again in a few moments.${supportHint}`
  }
  if (message) return message + supportHint
  return `Something went wrong. Please try again.${supportHint}`
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null): void {
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
  } catch { return null }
}

export function clearAuth(): void {
  setToken(null)
  try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
}

export function getStoredUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ApiUser
  } catch { return null }
}

export function setStoredUser(user: ApiUser | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch { /* ignore */ }
}

const BASE = (import.meta as any).env?.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    let body: any = {}
    try { body = await res.json() } catch { /* ignore */ }
    const err: ApiError = { error: body.error || res.statusText, details: body.details, status: res.status }
    throw err
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  // Auth
  login: (email: string, password: string) => api.post<{ token: string; user: ApiUser }>('/api/auth/login', { email, password }),
  register: (data: { email: string; password: string; username?: string; name?: string }) => api.post<{ token: string; user: ApiUser }>('/api/auth/register', data),
  me: () => api.get<{ user: ApiUser }>('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  // Add more as needed - full version in artifacts has the complete API surface
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
