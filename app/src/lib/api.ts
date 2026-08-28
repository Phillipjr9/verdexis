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
  } catch { return null }
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
  try { return localStorage.getItem('verdexis_auth_retry') } catch { return null }
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
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

interface RequestOpts extends RequestInit {
  timeoutMs?: number
  idempotencyKey?: string
}

async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey

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
      throw { error: 'Request timed out', status: 408 } as ApiError
    }
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

  signup: (email: string, password: string, name: string, phone?: string, address?: string) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name, ...(phone?.trim() ? { phone: phone.trim() } : {}), ...(address?.trim() ? { address: address.trim() } : {}) }) }),
  login: (identifier: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  me: () => request<{ user: ApiUser }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgot: (email: string) =>
    request<{ ok: boolean; message: string }>('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  reset: (token: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; token: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  verificationStatus: () =>
    request<{ emailVerified: boolean; emailVerifiedAt: string | null; phoneVerified: boolean; phoneVerifiedAt: string | null; phone: string | null; allVerified: boolean; verificationRequired: boolean; message: string }>('/api/otp/verification-status'),
  signupVerifyOtp: (pendingToken: string, code: string) =>
    request('/api/auth/signup/verify-otp', { method: 'POST', body: JSON.stringify({ pendingToken, code }) }),
  signupResendOtp: (email: string) =>
    request('/api/auth/signup/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),

  patchProfile: (patch: Partial<{ name: string; username: string | null; email: string; phone: string; avatar: string | null; prefs: Record<string, unknown>; twoFactor: boolean }>) =>
    request<{ user: ApiUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: () => request<{ ok: boolean }>('/api/profile', { method: 'DELETE' }),
  exportData: () => {
    const t = getToken()
    if (!t) return Promise.reject({ error: 'Sign in to export your data', status: 401 })
    return request<unknown>('/api/profile/export')
  },

  listHoldings: () => request<{ holdings: unknown[] }>('/api/holdings'),
  upsertHolding: (h: { symbol: string; name: string; amount: number; avgPrice: number; type: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/holdings', { method: 'POST', body: JSON.stringify(h) }),

  getWallet: () => request<{ balances: unknown[]; transactions: unknown[] }>('/api/wallet'),
  getSavedWallet: () => request('/api/wallet/saved-wallet'),
  saveSavedWallet: (payload: { encryptedWallet: string; address: string }) =>
    request('/api/wallet/saved-wallet', { method: 'POST', body: JSON.stringify(payload) }),
  clearSavedWallet: () => request('/api/wallet/saved-wallet', { method: 'DELETE' }),
  postTransaction: (tx: { kind: string; currency: string; symbol?: string; amount: number; reference?: string }, idempotencyKey?: string) =>
    request('/api/wallet/transactions', { method: 'POST', body: JSON.stringify(tx), idempotencyKey }),
  convertCurrency: (payload: unknown, idempotencyKey?: string) =>
    request('/api/wallet/convert', { method: 'POST', body: JSON.stringify(payload), idempotencyKey }),
  transferToUser: (payload: unknown, idempotencyKey?: string) =>
    request('/api/wallet/transfer', { method: 'POST', body: JSON.stringify(payload), idempotencyKey }),
  lookupRecipient: (email: string) =>
    request(`/api/wallet/lookup-recipient?email=${encodeURIComponent(email)}`),
  swap: (payload: unknown) =>
    request('/api/wallet/swap', { method: 'POST', body: JSON.stringify(payload), idempotencyKey: newIdempotencyKey() }),

  getWalletLink: () => request('/api/wallet/link'),
  linkWallet: (payload: { address: string; chainId?: string; provider?: string }) =>
    request('/api/wallet/link', { method: 'POST', body: JSON.stringify(payload) }),
  unlinkWallet: () => request('/api/wallet/link', { method: 'DELETE' }),
  listWalletLinks: () => request('/api/wallet/links'),
  addWalletLink: (payload: unknown) => request('/api/wallet/links', { method: 'POST', body: JSON.stringify(payload) }),
  removeWalletLink: (id: string) => request(`/api/wallet/links/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setPrimaryWalletLink: (id: string) => request(`/api/wallet/links/${encodeURIComponent(id)}/primary`, { method: 'POST' }),

  getWithdrawalConfig: () =>
    request<{ enabled: boolean; networks: { chain: string; enabled: boolean }[]; message: string }>('/api/withdrawals/config'),
  withdrawCrypto: (payload: { amount: number; asset: string; destinationAddress: string; chain?: string; tokenAddress?: string }, idempotencyKey?: string) =>
    request<{ withdrawal: unknown; transfer: { status: string; message: string; txHash?: string | null } }>('/api/withdrawals', { method: 'POST', body: JSON.stringify(payload), idempotencyKey }),

  getDepositInstructions: () => request('/api/wallet/deposit-instructions'),
  putDepositInstructions: (instructions: unknown) =>
    request('/api/wallet/deposit-instructions', { method: 'PUT', body: JSON.stringify(instructions) }),
  getMyDepositAddresses: () => request('/api/wallet/me/deposit-addresses'),
  recordPendingDeposit: (payload: unknown, idempotencyKey?: string) =>
    request('/api/wallet/pending-deposits', { method: 'POST', body: JSON.stringify(payload), idempotencyKey }),
  listPendingDeposits: () => request('/api/wallet/pending-deposits'),

  getReferralSummary: () => request('/api/referrals/me'),
  getReferralList: () => request('/api/referrals/list'),

  listTrades: () => request('/api/trades'),
  postTrade: (t: unknown, idempotencyKey?: string) =>
    request('/api/trades', { method: 'POST', body: JSON.stringify(t), idempotencyKey }),

  listWatchlist: () => request('/api/watchlist'),
  addWatch: (item: unknown) => request('/api/watchlist', { method: 'POST', body: JSON.stringify(item) }),
  removeWatch: (symbol: string) => request(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' }),

  listAlerts: () => request('/api/alerts'),
  addAlert: (a: unknown) => request('/api/alerts', { method: 'POST', body: JSON.stringify(a) }),

  listNotifications: () => request<{ notifications: { id: string; kind: string; title: string; body: string | null; read: boolean; createdAt: string }[]; unread: number }>('/api/notifications'),
  markAllRead: () => request('/api/notifications/read', { method: 'POST' }),
  markNotificationRead: (id: string) => request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' }),
  removeNotification: (id: string) => request(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listReviews: () =>
    request<{ reviews: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; createdAt: string }[] }>('/api/reviews'),
  getMyReview: () =>
    request<{ review: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; approved: boolean; createdAt: string; updatedAt: string } | null }>('/api/reviews/me'),
  upsertReview: (payload: { rating: number; text: string }) =>
    request<{ review: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; approved: boolean; createdAt: string; updatedAt: string } }>('/api/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMyReview: () => request<{ ok: boolean }>('/api/reviews/me', { method: 'DELETE' }),

  getPasskeys: () => request<{ passkeys: Array<{ id: string; deviceName: string; lastUsed: string; createdAt: string }> }>('/api/passkeys'),
  deletePasskey: (id: string) => request<{ success: boolean }>(`/api/passkeys/${id}`, { method: 'DELETE' }),

  submitKyc: (payload: unknown) =>
    request<{ ok: boolean; kycStatus: string; message: string }>('/api/kyc/submit', { method: 'POST', body: JSON.stringify(payload) }),
  getKycStatus: () =>
    request<{ kycStatus: string; kycTier: string }>('/api/kyc/status'),
  listKycDocuments: () =>
    request<{ documents: Array<{ id: string; type: string; uploaded: boolean; fileName?: string; size?: number }> }>('/api/kyc/documents'),

  userSettings: {
    getNotifications: () => request<Record<string, unknown>>('/api/user-settings/notifications'),
    patchNotifications: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/notifications', { method: 'PATCH', body: JSON.stringify(data) }),
    getPrivacy: () => request<Record<string, unknown>>('/api/user-settings/privacy'),
    patchPrivacy: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/privacy', { method: 'PATCH', body: JSON.stringify(data) }),
    getWallet: () => request<Record<string, unknown>>('/api/user-settings/wallet'),
    patchWallet: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/wallet', { method: 'PATCH', body: JSON.stringify(data) }),
    getAccessibility: () => request<Record<string, unknown>>('/api/user-settings/accessibility'),
    patchAccessibility: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/accessibility', { method: 'PATCH', body: JSON.stringify(data) }),
    getSessions: () => request<unknown[]>('/api/user-settings/sessions'),
    revokeSession: (id: string) => request<{ ok: boolean }>(`/api/user-settings/sessions/revoke/${id}`, { method: 'POST' }),
    revokeAllSessions: () => request<{ ok: boolean }>('/api/user-settings/sessions/revoke-all', { method: 'POST' }),
    getLoginHistory: () => request<unknown[]>('/api/user-settings/login-history'),
    getIpRestrictions: () => request<unknown[]>('/api/user-settings/ip-restrictions'),
    addIpRestriction: (data: { ipAddress: string; type: 'whitelist' | 'blacklist'; description?: string }) => request<unknown>('/api/user-settings/ip-restrictions', { method: 'POST', body: JSON.stringify(data) }),
    removeIpRestriction: (id: string) => request<{ ok: boolean }>(`/api/user-settings/ip-restrictions/${id}`, { method: 'DELETE' }),
    get2faRecoveryCodes: () => request<unknown[]>('/api/user-settings/2fa-recovery-codes'),
    generate2faRecoveryCodes: () => request<unknown>('/api/user-settings/2fa-recovery-codes/generate', { method: 'POST' }),
    requestDataExport: (format: 'json' | 'csv') => request<unknown>('/api/user-settings/export-data', { method: 'POST', body: JSON.stringify({ format }) }),
    getDataExports: () => request<unknown[]>('/api/user-settings/export-data'),
    getCookiePreferences: () => request<Record<string, unknown>>('/api/user-settings/cookie-preferences'),
    patchCookiePreferences: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/cookie-preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  },
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
