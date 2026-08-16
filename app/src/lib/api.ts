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
    return `Service temporarily unavailable. Please try again in a moment.${supportHint}`
  }

  if (message) {
    return `${message}${supportHint}`
  }

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
  } catch {
    /* ignore */
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('verdexis_avatar')
  } catch {
    /* ignore */
  }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

// Generate an idempotency key for money-mutating requests. Use the platform
// crypto.randomUUID when available (every modern browser + secure context),
// falling back to a 22-char base36 string built from crypto.getRandomValues
// or Math.random as a last resort.
export function newIdempotencyKey(): string {
  try {
    const c = (typeof crypto !== 'undefined' ? crypto : undefined)
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
  /** Send `Idempotency-Key: <value>` so server-side retries are deduped.
   *  The caller is responsible for generating the key ONCE per logical
   *  user action — re-using the same key on retry is the whole point. */
  idempotencyKey?: string
}

async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout
  
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal })
    clearTimeout(timeout)
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = {}
    }
    if (!res.ok) {
      const err = body as { error?: string; details?: unknown; whatsapp?: string; telegram?: string; reason?: string }
      const apiErr: ApiError = {
        error: err.error || `Request failed with ${res.status}`,
        details: err.details,
        status: res.status,
      }
      // Forward known soft-fail fields so callers can surface contextual UI
      // (e.g. the bonus-lock modal needs the whatsapp / telegram URLs from
      // the server's 423 payload).
      if (err.whatsapp) (apiErr as ApiError & { whatsapp?: string }).whatsapp = err.whatsapp
      if (err.telegram) (apiErr as ApiError & { telegram?: string }).telegram = err.telegram
      if (err.reason) (apiErr as ApiError & { reason?: string }).reason = err.reason
      throw apiErr
    }
    return body as T
  } catch (err: any) {
    // Ensure timeout is always cleared.
    clearTimeout(timeout)

    // Normalize common network/timeout failures into ApiError so callers
    // can render friendly messages via `getFriendlyApiErrorMessage`.
    if (err && err.name === 'AbortError') {
      const apiErr: ApiError = { error: 'Request timed out', status: 408 }
      throw apiErr
    }

    const msg = (err && (err.message || String(err))) || 'Network error'
    // Typical fetch network error appears as a TypeError in browsers.
    if (err instanceof TypeError || /failed to fetch|network request failed/i.test(msg)) {
      const apiErr: ApiError = { error: 'Network error: unable to reach the server', status: 0, details: err }
      throw apiErr
    }

    // If the error already looks like an ApiError with a status, rethrow.
    if (err && typeof err.status === 'number') throw err

    // Fallback: wrap unknown errors.
    const apiErr: ApiError = { error: msg, status: 0, details: err }
    throw apiErr
  }
}
export const api = {
  get: <T>(path: string, init: Omit<RequestOpts, 'method'> = {}) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(path, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, init: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(path, { ...init, method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, init: Omit<RequestOpts, 'method' | 'body'> = {}) => request<T>(path, { ...init, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, init: Omit<RequestOpts, 'method'> = {}) => request<T>(path, { ...init, method: 'DELETE' }),

  health: () => request<{ ok: boolean }>('/api/health'),

  // Auth
  signup: (email: string, password: string, name: string, phone?: string) =>
    request<{ token: string; user: ApiUser } | { otpRequired: true; pendingToken: string; verificationType?: 'login' | 'signup'; message?: string; devCode?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
        ...(phone && phone.trim() ? { phone: phone.trim() } : {}),
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
  supabaseAuth: (accessToken: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/supabase', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
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
  logoutAll: () => request<{ ok: boolean; token: string }>('/api/auth/logout-all', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; token: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  sendVerification: () =>
    request<{ ok: boolean; alreadyVerified?: boolean; devLink?: string }>('/api/auth/send-verification', { method: 'POST' }),
  verifyEmail: (token: string) =>
    request<{ verified: boolean; token: string; user: ApiUser }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  verificationStatus: () =>
    request<{
      emailVerified: boolean
      emailVerifiedAt: string | null
      phoneVerified: boolean
      phoneVerifiedAt: string | null
      phone: string | null
      allVerified: boolean
      verificationRequired: boolean
      message: string
    }>('/api/otp/verification-status'),
  sendPhoneVerification: (phoneNumber: string) =>
    request<{ sent: boolean; expiresIn: number; message: string; phoneNumber: string }>('/api/otp/send-phone-verification', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    }),
  verifyPhone: (code: string, phoneNumber: string) =>
    request<{ verified: boolean; phoneVerified: boolean; message: string }>('/api/otp/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ code, phoneNumber }),
    }),
  exportData: () => {
    const t = getToken()
    if (!t) return Promise.reject({ error: 'Sign in to export your data', status: 401 })
    const headers = new Headers()
    headers.set('Authorization', `Bearer ${t}`)
    return fetch(`${BASE}/api/auth/export`, { headers }).then(async (r) => {
      if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }))
      return r.blob()
    })
  },

  // Profile
  patchProfile: (patch: Partial<{ name: string; username: string | null; email: string; phone: string; avatar: string | null; prefs: Record<string, unknown>; twoFactor: boolean }>) =>
    request<{ user: ApiUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: () => request<{ ok: boolean }>('/api/profile', { method: 'DELETE' }),

  // Holdings
  listHoldings: () => request<{ holdings: unknown[] }>('/api/holdings'),
  upsertHolding: (h: { symbol: string; name: string; amount: number; avgPrice: number; type: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/holdings', { method: 'POST', body: JSON.stringify(h) }),

  // Wallet
  getWallet: () => request<{ balances: unknown[]; transactions: unknown[] }>('/api/wallet'),
  getSavedWallet: () => request<{ wallet: { hasWallet: boolean; address: string | null; encryptedWallet?: string | null; updatedAt: string | null } | null }>('/api/wallet/saved-wallet'),
  saveSavedWallet: (payload: { encryptedWallet: string; address: string }) =>
    request<{ wallet: { hasWallet: boolean; address: string | null; updatedAt: string | null } }>('/api/wallet/saved-wallet', { method: 'POST', body: JSON.stringify(payload) }),
  clearSavedWallet: () => request<{ ok: boolean }>('/api/wallet/saved-wallet', { method: 'DELETE' }),
  postTransaction: (
    tx: { kind: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest' | 'fee'; currency: string; symbol?: string; amount: number; reference?: string },
    idempotencyKey?: string,
  ) =>
    request('/api/wallet/transactions', { method: 'POST', body: JSON.stringify(tx), idempotencyKey }),
  convertCurrency: (
    payload: { fromCurrency: string; fromAmount: number; fromSymbol?: string; toCurrency: string; toAmount: number; toSymbol?: string },
    idempotencyKey?: string,
  ) =>
    request<{ debit: { id: string }; credit: { id: string } }>(
      '/api/wallet/convert',
      { method: 'POST', body: JSON.stringify(payload), idempotencyKey },
    ),
  transferToUser: (
    payload: { recipientEmail: string; currency: string; amount: number; note?: string },
    idempotencyKey?: string,
  ) =>
    request<{ recipient: { email: string; name: string | null } }>(
      '/api/wallet/transfer',
      { method: 'POST', body: JSON.stringify(payload), idempotencyKey },
    ),
  lookupRecipient: (email: string) =>
    request<{ user: { email: string; name: string | null } }>(`/api/wallet/lookup-recipient?email=${encodeURIComponent(email)}`),
  swap: (
    payload: { fromCurrency: string; toCurrency: string; amount: number; slippage?: number },
  ) =>
    request<{ debit: { id: string }; credit: { id: string }; rate: number; received: number }>(
      '/api/wallet/swap',
      { method: 'POST', body: JSON.stringify(payload), idempotencyKey: newIdempotencyKey() },
    ),

  // Self-custody wallet linking
  getWalletLink: () =>
    request<{ wallet: { walletAddress: string | null; walletChainId: string | null; walletProvider: string | null; walletLinkedAt: string | null } | null }>(
      '/api/wallet/link',
    ),
  linkWallet: (payload: { address: string; chainId?: string; provider?: string }) =>
    request<{ wallet: { walletAddress: string; walletChainId: string | null; walletProvider: string | null; walletLinkedAt: string } }>(
      '/api/wallet/link',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  unlinkWallet: () =>
    request<{ ok: boolean }>('/api/wallet/link', { method: 'DELETE' }),

  // Multi-wallet linking
  listWalletLinks: () =>
    request<{ links: { id: string; address: string; chainId: string | null; provider: string | null; label: string | null; isPrimary: boolean; linkedAt: string }[] }>(
      '/api/wallet/links',
    ),
  addWalletLink: (payload: { address: string; chainId?: string; provider?: string; label?: string; setPrimary?: boolean }) =>
    request<{ link: { id: string; address: string; chainId: string | null; provider: string | null; label: string | null; isPrimary: boolean; linkedAt: string } }>(
      '/api/wallet/links',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  removeWalletLink: (id: string) =>
    request<{ ok: boolean }>(`/api/wallet/links/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setPrimaryWalletLink: (id: string) =>
    request<{ ok: boolean }>(`/api/wallet/links/${encodeURIComponent(id)}/primary`, { method: 'POST' }),

  // Withdrawals
  getWithdrawalConfig: () =>
    request<{ enabled: boolean; networks: { chain: string; enabled: boolean }[]; message: string }>('/api/withdrawals/config'),

  withdrawCrypto: (payload: { amount: number; asset: string; destinationAddress: string; chain?: string; tokenAddress?: string }, idempotencyKey?: string) =>
    request<{ withdrawal: unknown; transfer: { status: string; message: string; txHash?: string | null } }>('/api/withdrawals', { method: 'POST', body: JSON.stringify(payload), idempotencyKey }),

  // Admin-managed deposit instructions (wire / crypto / web3 destinations)
  getDepositInstructions: () =>
    request<{ instructions: unknown; updatedAt: string | null }>('/api/wallet/deposit-instructions'),
  putDepositInstructions: (instructions: unknown) =>
    request<{ instructions: unknown; updatedAt: string }>(
      '/api/wallet/deposit-instructions',
      { method: 'PUT', body: JSON.stringify(instructions) },
    ),

  // Per-user crypto / wire deposit destinations the admin assigned to me.
  getMyDepositAddresses: () =>
    request<{ addresses: unknown | null }>('/api/wallet/me/deposit-addresses'),

  // Admin: manage user deposit addresses
  getUserDepositAddresses: (userId: string) =>
    request<{ addresses: unknown | null }>(`/api/admin/users/${encodeURIComponent(userId)}/deposit-addresses`),
  updateUserDepositAddresses: (userId: string, addresses: unknown) =>
    request<{ addresses: unknown }>(
      `/api/admin/users/${encodeURIComponent(userId)}/deposit-addresses`,
      { method: 'PUT', body: JSON.stringify(addresses) },
    ),
  deleteUserDepositAddresses: (userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/deposit-addresses`, { method: 'DELETE' }),

  // On-chain pending deposits
  recordPendingDeposit: (
    payload: { txHash?: string; chainId?: string; toAddress: string; fromAddress?: string; asset: string; amount: number },
    idempotencyKey?: string,
  ) =>
    request<{ pendingDeposit: { id: string; txHash: string; status: string; createdAt: string }; transfer?: { status: string; message: string; txHash?: string | null }; deduped?: boolean }>(
      '/api/wallet/pending-deposits',
      { method: 'POST', body: JSON.stringify(payload), idempotencyKey },
    ),
  listPendingDeposits: () =>
    request<{ pendingDeposits: { id: string; txHash: string; chainId: string; toAddress: string; fromAddress: string; asset: string; amount: number; status: string; note: string | null; createdAt: string }[] }>(
      '/api/wallet/pending-deposits',
    ),

  // Referrals
  getReferralSummary: () =>
    request<{ referralCode: string | null; totalEarned: number; activeReferrals: number; pendingReferrals: number }>('/api/referrals/me'),
  getReferralList: () =>
    request<{ referrals: Array<{ id: string; refereeEmail: string; status: string; firstDepositAt: string | null; firstDepositAmount: number | null; referrerBonusUsd: number | null }> }>('/api/referrals/list'),

  // Trades
  listTrades: () => request<{ trades: unknown[] }>('/api/trades'),
  postTrade: (
    t: { symbol: string; name?: string; side: 'buy' | 'sell'; amount: number; price: number; type?: 'crypto' | 'stock' | 'etf' },
    idempotencyKey?: string,
  ) =>
    request<{ trade: { id: string; symbol: string; side: 'buy' | 'sell'; amount: number; price: number; total: number; createdAt: string }; broker: { id: string; venue: string } | null }>(
      '/api/trades',
      { method: 'POST', body: JSON.stringify(t), idempotencyKey },
    ),

  // Market data (server-side proxy)
  marketOrderbook: (id: string) => request<{ product: string; bids: { price: number; size: number }[]; asks: { price: number; size: number }[] }>(`/api/market/orderbook?id=${encodeURIComponent(id)}`),
  marketRecentTrades: (id: string) => request<{ product: string; trades: { id: number; time: string; price: number; size: number; side: 'buy' | 'sell' }[] }>(`/api/market/recent-trades?id=${encodeURIComponent(id)}`),

  // Watchlist
  listWatchlist: () => request<{ watchlist: { id: string; symbol: string; name: string; type: string }[] }>('/api/watchlist'),
  addWatch: (item: { symbol: string; name: string; type?: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/watchlist', { method: 'POST', body: JSON.stringify(item) }),
  removeWatch: (symbol: string) =>
    request(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' }),

  // Price alerts
  listAlerts: () => request<{ alerts: { id: string; symbol: string; name: string; direction: 'above' | 'below'; target: number; active: boolean; triggered: boolean; createdAt: string }[] }>('/api/alerts'),
  addAlert: (a: { symbol: string; name: string; direction: 'above' | 'below'; target: number }) =>
    request('/api/alerts', { method: 'POST', body: JSON.stringify(a) }),
  removeAlert: (id: string) => request(`/api/alerts/${id}`, { method: 'DELETE' }),
  checkAlerts: (prices: { symbol: string; price: number }[]) =>
    request<{ triggered: number }>('/api/alerts/check', { method: 'POST', body: JSON.stringify({ prices }) }),

  // Notifications
  listNotifications: () => request<{ notifications: { id: string; kind: string; title: string; body: string | null; read: boolean; createdAt: string }[]; unread: number }>('/api/notifications'),
  getNotification: (id: string) => request<{ notification: { id: string; kind: string; title: string; body: string | null; read: boolean; createdAt: string } }>(`/api/notifications/${encodeURIComponent(id)}`),
  markAllRead: () => request('/api/notifications/read', { method: 'POST' }),
  markNotificationRead: (id: string) => request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' }),
  removeNotification: (id: string) => request(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // AI chat (LLM proxy). Returns 503 when no key is configured server-side
  // so the caller can fall back to its rule-based answer.
  aiChat: (payload: { query: string; persona?: string; context?: string }) =>
    request<{ answer: string; model: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),

  // Public testimonials shown on the homepage carousel. GET is unauthenticated
  // so the marketing page works for signed-out visitors.
  listReviews: () =>
    request<{ reviews: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; createdAt: string }[] }>(
      '/api/reviews',
    ),
  getMyReview: () =>
    request<{ review: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; approved: boolean; createdAt: string; updatedAt: string } | null }>(
      '/api/reviews/me',
    ),
  upsertReview: (payload: { rating: number; text: string }) =>
    request<{ review: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; approved: boolean; createdAt: string; updatedAt: string } }>(
      '/api/reviews',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  deleteMyReview: () => request<{ ok: boolean }>('/api/reviews/me', { method: 'DELETE' }),

  // Passkeys
  getPasskeys: () => request<{ passkeys: Array<{ id: string; deviceName: string; lastUsed: string; createdAt: string }> }>('/api/passkeys'),
  deletePasskey: (id: string) => request<{ success: boolean }>(`/api/passkeys/${id}`, { method: 'DELETE' }),

  // KYC
  submitKyc: (payload: {
    firstName: string
    lastName: string
    dob: string
    country: string
    ssn: string
    addressStreet: string
    addressCity: string
    addressZip: string
    idDocType: 'passport' | 'dl' | 'id'
  }) =>
    request<{ ok: boolean; kycStatus: string; message: string }>('/api/kyc/submit', { method: 'POST', body: JSON.stringify(payload) }),
  getKycStatus: () =>
    request<{
      status: string
      notes: string | null
      reviewedAt: string | null
      submitted: { firstName: string | null; lastName: string | null; country: string | null }
      documents: { identity: boolean; address: boolean; selfie: boolean }
    }>('/api/kyc/status'),
  uploadKycDocument: (documentType: 'identity' | 'address' | 'selfie', file: File) => {
    const form = new FormData()
    form.append('document', file)
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${BASE}/api/kyc/upload/${documentType}`, { method: 'POST', headers, body: form }).then(async (r) => {
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw body
      return body as { ok: boolean; document: { id: string; type: string; fileName: string; size: number; uploadedAt: string } }
    })
  },
  getKycDocuments: () =>
    request<{ documents: Array<{ id: string; type: string; uploaded: boolean; fileName?: string; size?: number }> }>('/api/kyc/documents'),

  // Copy Trading
  // User Security
  getSecurityOverview: () =>
    request<{ securityScore: { score: number; level: string; recommendations: string[] }; authentication: unknown; devices: { total: number; trusted: number; recent: unknown[] }; sessions: unknown; recentActivity: unknown[] }>('/api/user-security/overview'),
  getLoginHistory: (days = 30) =>
    request<{ events: Array<{ id: string; type: string; severity: string; description: string; timestamp: string; metadata: { ipAddress?: string; location?: string; device?: string } | null }> }>(`/api/user-security/events?days=${days}&type=login`),
  getTrustedDevices: () =>
    request<{ devices: Array<{ id: string; deviceName: string; lastSeenAt: string; isTrusted: boolean; location: unknown }> }>('/api/user-security/devices'),
  revokeTrustedDevice: (deviceId: string) =>
    request<{ success: boolean }>(`/api/user-security/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
  generateRecoveryCodes: () =>
    request<{ success: boolean; codes: string[]; message: string }>('/api/user-security/recovery-codes/generate', { method: 'POST' }),

  // API Keys
  getApiKeys: () =>
    request<{ keys: Array<{ id: string; name: string; prefix: string; permissions: string[]; rateLimit: number; lastUsedAt: string | null; expiresAt: string | null; createdAt: string }> }>('/api/api-keys'),
  createApiKey: (payload: { name: string; permissions?: string[]; rateLimit?: number; expiresAt?: string }) =>
    request<{ id: string; key: string; prefix: string; message: string }>('/api/api-keys', { method: 'POST', body: JSON.stringify(payload) }),
  revokeApiKey: (id: string) =>
    request<{ revoked: boolean }>(`/api/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
  deleteApiKey: (id: string) =>
    request<{ deleted: boolean }>(`/api/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // User Settings
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
    deleteIpRestriction: (id: string) => request<{ ok: boolean }>(`/api/user-settings/ip-restrictions/${id}`, { method: 'DELETE' }),
    getActivityLog: (limit?: number, category?: string) => request<unknown[]>(`/api/user-settings/activity-log?limit=${limit ?? 100}${category ? `&category=${category}` : ''}`),
    getRiskTolerance: () => request<Record<string, unknown>>('/api/user-settings/risk-tolerance'),
    patchRiskTolerance: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/risk-tolerance', { method: 'PATCH', body: JSON.stringify(data) }),
    getLinkedAccounts: () => request<unknown[]>('/api/user-settings/linked-accounts'),
    deleteLinkedAccount: (id: string) => request<{ ok: boolean }>(`/api/user-settings/linked-accounts/${id}`, { method: 'DELETE' }),
    getRecoveryOptions: () => request<unknown[]>('/api/user-settings/recovery-options'),
    addRecoveryOption: (data: { type: string; value: string }) => request<unknown>('/api/user-settings/recovery-options', { method: 'POST', body: JSON.stringify(data) }),
    deleteRecoveryOption: (id: string) => request<{ ok: boolean }>(`/api/user-settings/recovery-options/${id}`, { method: 'DELETE' }),
    get2faRecoveryCodes: () => request<unknown[]>('/api/user-settings/2fa-recovery-codes'),
    generate2faRecoveryCodes: () => request<{ codes: string[] }>('/api/user-settings/2fa-recovery-codes/generate', { method: 'POST' }),
    requestDataExport: (format: 'json' | 'csv') => request<unknown>('/api/user-settings/export-data', { method: 'POST', body: JSON.stringify({ format }) }),
    getDataExports: () => request<unknown[]>('/api/user-settings/export-data'),
    getCookiePreferences: () => request<Record<string, unknown>>('/api/user-settings/cookie-preferences'),
    patchCookiePreferences: (data: Record<string, unknown>) => request<Record<string, unknown>>('/api/user-settings/cookie-preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  copyTrading: {
    getLeaderboard: (period: '30d' | '90d' | 'all' = '30d') =>
      request<{ traders: unknown[] }>(`/api/copy-trading/leaderboard?period=${period}`),
    getTrader: (userId: string) =>
      request<{ profile: unknown; recentTrades: unknown[] }>(`/api/copy-trading/trader/${userId}`),
    getMyProfile: () =>
      request<{ profile: unknown }>('/api/copy-trading/my-profile'),
    updateMyProfile: (payload: { displayName?: string; bio?: string; isPublic?: boolean; allowCopying?: boolean; minCopyAmount?: number; maxCopiers?: number; performanceFee?: number }) =>
      request<{ profile: unknown }>('/api/copy-trading/my-profile', { method: 'PATCH', body: JSON.stringify(payload) }),
    getFollowing: () =>
      request<{ following: unknown[] }>('/api/copy-trading/following'),
    getFollowers: () =>
      request<{ followers: unknown[] }>('/api/copy-trading/followers'),
    follow: (traderId: string, allocationUsd: number, allocationPercent = 100) =>
      request<{ relationship: unknown }>('/api/copy-trading/follow', {
        method: 'POST',
        body: JSON.stringify({ traderId, allocationUsd, allocationPercent }),
      }),
    unfollow: (traderId: string) =>
      request<{ success: boolean }>('/api/copy-trading/unfollow', {
        method: 'POST',
        body: JSON.stringify({ traderId }),
      }),
    getMyCopyTrades: () =>
      request<{ copyTrades: unknown[] }>('/api/copy-trading/my-copy-trades'),
  },
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
