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
    const err = body as { error?: string }
    throw { status: res.status, error: err.error || `Request failed with ${res.status}` }
  }
  return body as T
}

export const adminPendingDepositsApi = {
  listPendingDeposits: () =>
    request<{ deposits: any[] }>('/api/admin/pending-deposits').then((r) => ({
      deposits: (r.deposits || [])
        .filter((d: any) => d.source !== 'onchain')
        .map((d: any) => ({
          ...d,
          currency: d.currency || d.asset,
          reference: d.reference || d.note || d.txHash || '',
          user: d.user || { id: d.userId, name: '—', email: '—' },
        })),
    })),
  listOnchainDeposits: (status = 'pending') =>
    request<{ deposits: any[] }>('/api/admin/pending-deposits').then((r) => ({
      pendingDeposits: (r.deposits || [])
        .filter((d: any) => d.source === 'onchain' && (!status || d.status === status))
        .map((d: any) => ({
          ...d,
          fromAddress: d.fromAddress || '',
          toAddress: d.toAddress || '',
          user: d.user || { id: d.userId, name: '—', email: '—' },
        })),
    })),
  approveDeposit: (id: string) =>
    request(`/api/admin/pending-deposits/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  rejectDeposit: (id: string, reason?: string) =>
    request(`/api/admin/pending-deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'other', note: reason || '' }),
    }),
  approveOnchainDeposit: (id: string, _input?: { currency?: string; amount?: number; note?: string }) =>
    request(`/api/admin/pending-deposits/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  rejectOnchainDeposit: (id: string, note?: string) =>
    request(`/api/admin/pending-deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'other', note: note || '' }),
    }),
}
