// Typed wrapper around the /api/admin/* endpoints.
import { getToken } from './api'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  let body: unknown
  try { body = await res.json() } catch { body = {} }
  if (!res.ok) {
    const err = body as { error?: string; details?: unknown }
    throw { status: res.status, error: err.error || `Request failed with ${res.status}`, details: err.details }
  }
  return body as T
}

export type AdminUserSummary = any
export type AdminUserFull = any
export type AdminWalletBalance = any
export type AdminHolding = any
export type AdminTransaction = any
export type AdminUserSession = any
export type AdminNotification = any
export type AdminTrade = any
export type AdminSignupBonusSettings = any
export type AdminStats = any
export type AdminUserDetailResponse = any
export type AdminSavedWallet = any
export type AdminWalletLink = any
export type AdminSessionStats = any
export type AdminAuditLog = any

export const DEPOSIT_REASONS = [
  { value: 'manual_bank_wire', label: 'Manual deposit — bank wire' },
  { value: 'manual_crypto', label: 'Manual deposit — crypto' },
  { value: 'promo_credit', label: 'Promotional credit' },
  { value: 'refund', label: 'Refund' },
  { value: 'other', label: 'Other (see note)' },
]
export const DEDUCT_REASONS = [
  { value: 'manual_bank_wire', label: 'Manual withdrawal — bank wire' },
  { value: 'manual_crypto', label: 'Manual withdrawal — crypto' },
  { value: 'fee', label: 'Fee' },
  { value: 'other', label: 'Other (see note)' },
]
export const HOLD_REASONS = [
  { value: 'compliance_review', label: 'Compliance review' },
  { value: 'suspected_fraud', label: 'Suspected fraud' },
  { value: 'other', label: 'Other' },
]
export const HOLD_TYPES = [
  { value: 'all' as const, label: 'All money movement', description: 'Block withdrawals and transfers' },
  { value: 'withdraw' as const, label: 'Withdrawals only', description: 'User can still transfer' },
  { value: 'transfer' as const, label: 'Transfers only', description: 'User can still withdraw' },
]
export const KYC_STATUSES = [
  { value: 'none' as const, label: 'None' },
  { value: 'pending' as const, label: 'Pending' },
  { value: 'approved' as const, label: 'Approved' },
  { value: 'rejected' as const, label: 'Rejected' },
]
export const FEE_TYPES = [
  { value: 'trading', label: 'Trading fee' },
  { value: 'withdrawal', label: 'Withdrawal fee' },
  { value: 'other', label: 'Other' },
]
export const EMAIL_TEMPLATES = [{ value: 'custom', label: 'Custom' }]
export const HOLDING_REASONS = [{ value: 'correction', label: 'Correction' }, { value: 'other', label: 'Other' }]
export const TRANSFER_REASONS = [
  { value: 'internal_correction', label: 'Internal correction' },
  { value: 'manual_correction', label: 'Manual correction' },
  { value: 'gift', label: 'Gift' },
  { value: 'family_transfer', label: 'Family transfer' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'refund', label: 'Refund' },
  { value: 'court_order', label: 'Court order' },
  { value: 'dispute_resolution', label: 'Dispute resolution' },
  { value: 'fraud_recovery', label: 'Fraud recovery' },
  { value: 'compliance_directive', label: 'Compliance directive' },
  { value: 'merger_consolidation', label: 'Merger / consolidation' },
  { value: 'other', label: 'Other' },
]

export const adminApi = {
  get: (path: string) => request<any>(`/api/admin${path}`),
  post: (path: string, body?: unknown) => request<any>(`/api/admin${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path: string, body?: unknown) => request<any>(`/api/admin${path}`, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  stats: () => request<AdminStats>('/api/admin/stats'),
  listUsers: (params: Record<string, unknown> = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    })
    return request<{ users: AdminUserSummary[]; total: number }>(`/api/admin/users?${q.toString()}`)
  },
  getUser: (id: string) => request<AdminUserDetailResponse>(`/api/admin/users/${id}`),
  deposit: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/deposit`, { method: 'POST', body: JSON.stringify(input) }),
  deduct: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/deduct`, { method: 'POST', body: JSON.stringify(input) }),
  adminTransfer: (input: unknown) =>
    request('/api/admin/transfer', { method: 'POST', body: JSON.stringify(input) }),
  placeHold: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/hold`, { method: 'POST', body: JSON.stringify(input) }),
  releaseHold: (userId: string) =>
    request(`/api/admin/users/${userId}/unhold`, { method: 'POST', body: JSON.stringify({}) }),
  setKyc: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/kyc`, { method: 'POST', body: JSON.stringify(input) }),
  setLimits: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/limits`, { method: 'PATCH', body: JSON.stringify(input) }),
  setPassword: (userId: string, password: string, revokeSessions = true) =>
    request(`/api/admin/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ password, revokeSessions }) }),
  revokeSessions: (userId: string) =>
    request(`/api/admin/users/${userId}/revoke`, { method: 'POST', body: JSON.stringify({}) }),
  revokeSession: (sessionId: string) =>
    request(`/api/security/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  emailUser: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/email`, { method: 'POST', body: JSON.stringify(input) }),
  setWallet: (userId: string, w: unknown) =>
    request(`/api/admin/users/${userId}/wallet`, { method: 'POST', body: JSON.stringify(w) }),
  chargeFee: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/fee`, { method: 'POST', body: JSON.stringify(input) }),
  adjustHolding: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/holdings/adjust`, { method: 'POST', body: JSON.stringify(input) }),
  reverseTransaction: (id: string, input: unknown) =>
    request(`/api/admin/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify(input) }),
  impersonate: (id: string) =>
    request(`/api/admin/users/${id}/impersonate`, { method: 'POST', body: JSON.stringify({}) }),
  patchUser: (id: string, input: unknown) =>
    request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  getUserSessions: (userId: string) =>
    request(`/api/security/sessions?userId=${encodeURIComponent(userId)}`),
  setWithdrawalFeeConfig: (input: { ratePct: number }) =>
    request('/api/admin/withdrawal-fee-config', { method: 'PUT', body: JSON.stringify(input) }),
  getSignupBonus: () => request('/api/admin/signup-bonus'),
  setSignupBonus: (input: unknown) =>
    request('/api/admin/signup-bonus', { method: 'PUT', body: JSON.stringify(input) }),
  getSetting: (key: string) => request(`/api/admin/settings/${key}`),
  saveSetting: (key: string, value: string) =>
    request(`/api/admin/settings/${key}/save`, { method: 'POST', body: JSON.stringify({ value }) }),
  getAllSettings: () => request('/api/admin/settings/all'),
  setUserWithdrawalAch: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/withdrawal-ach`, { method: 'POST', body: JSON.stringify(input) }),
  removeUserWithdrawalAch: (userId: string) =>
    request(`/api/admin/users/${userId}/withdrawal-ach`, { method: 'DELETE' }),
  setUserWithdrawalWire: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/withdrawal-wire`, { method: 'POST', body: JSON.stringify(input) }),
  removeUserWithdrawalWire: (userId: string) =>
    request(`/api/admin/users/${userId}/withdrawal-wire`, { method: 'DELETE' }),
  setUserWithdrawalCheck: (userId: string, input: unknown) =>
    request(`/api/admin/users/${userId}/withdrawal-check`, { method: 'POST', body: JSON.stringify(input) }),
  removeUserWithdrawalCheck: (userId: string) =>
    request(`/api/admin/users/${userId}/withdrawal-check`, { method: 'DELETE' }),

  listPendingDeposits: () =>
    request<{ deposits: any[] }>('/api/admin/features/compliance/deposits?days=90').then((r) => ({
      deposits: (r.deposits || []).filter((d: any) => d.status === 'pending').map((d: any) => ({
        ...d,
        currency: d.asset,
        reference: d.note || d.txHash || '',
        user: d.user || { id: d.userId, name: '—', email: '—' },
      })),
    })),
  listOnchainDeposits: (status = 'pending') =>
    request<{ deposits: any[] }>('/api/admin/features/compliance/deposits?days=90').then((r) => ({
      pendingDeposits: (r.deposits || [])
        .filter((d: any) => !status || d.status === status)
        .map((d: any) => ({
          ...d,
          fromAddress: d.fromAddress || '',
          toAddress: d.toAddress || '',
          user: d.user || { id: d.userId, name: '—', email: '—' },
        })),
    })),
  listPendingWithdrawals: () =>
    request<{ withdrawals: any[] }>('/api/withdrawals/admin/pending'),
  approveDeposit: (id: string) =>
    request(`/api/deposits/${id}/confirm`, { method: 'POST', body: JSON.stringify({}) }),
  rejectDeposit: (id: string, reason?: string) =>
    request(`/api/admin/pending-deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'other', note: reason || '' }),
    }),
  approveOnchainDeposit: (id: string, input: { currency?: string; amount?: number; note?: string }) =>
    request(`/api/deposits/${id}/confirm`, { method: 'POST', body: JSON.stringify(input || {}) }),
  rejectOnchainDeposit: (id: string, note?: string) =>
    request(`/api/admin/pending-deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'other', note: note || '' }),
    }),
  approveWithdrawal: (id: string, txHash: string) =>
    request(`/api/withdrawals/admin/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ txHash }),
    }),
  rejectWithdrawal: (id: string, reason?: string) =>
    request(`/api/withdrawals/admin/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason: reason || '' }),
    }),
  listPendingReviews: () =>
    request<{ reviews: any[] }>('/api/admin/reviews/pending'),
  approveReview: (id: string) =>
    request(`/api/admin/reviews/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  rejectReview: (id: string) =>
    request(`/api/admin/reviews/${id}/reject`, { method: 'POST', body: JSON.stringify({}) }),
  audit: (params: Record<string, unknown> = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    })
    return request<{ audit: AdminAuditLog[] }>(`/api/admin/audit?${q.toString()}`)
  },
  auditCsvUrl: (params: Record<string, unknown> = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    })
    q.set('format', 'csv')
    return `${BASE}/api/compliance/audit-trail/export?${q.toString()}`
  },
  broadcast: (input: { kind: string; title: string; body?: string }) =>
    request<{ count: number }>('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createUser: (input: unknown) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(input) }),
  bulkUsers: (input: unknown) =>
    request('/api/admin/users/bulk', { method: 'POST', body: JSON.stringify(input) }),
}
