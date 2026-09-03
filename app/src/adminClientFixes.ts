import { adminApi } from './lib/adminApi'
import { getToken } from './lib/api'

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw data
  return data as T
}

const extras = {
  listAllFeeProofs: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return adminRequest<{ proofs: Array<Record<string, unknown>> }>(`/api/admin/fee-proofs${qs}`)
  },
  seedTreasury: () =>
    adminRequest<{ ok: true; message: string; balance: number; available: number; currency: string }>(
      '/api/admin/treasury/seed',
      { method: 'POST' },
    ),
  stats: () => adminRequest('/api/admin/stats/scoped'),
}

Object.assign(adminApi, extras)

const origFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (/\/api\/admin\/stats(?:\?|$)/.test(url) && !url.includes('/stats/scoped')) {
    url = url.replace('/api/admin/stats', '/api/admin/stats/scoped')
    if (typeof input === 'string') return origFetch(url, init)
  }
  return origFetch(input, init)
}
