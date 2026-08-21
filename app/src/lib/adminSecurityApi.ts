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

/** Admin security events — mounted at /api/security (requireAdmin). */
export const adminSecurityApi = {
  listEvents: (params?: { days?: number; severity?: string }) => {
    const q = new URLSearchParams()
    if (params?.days) q.set('days', String(params.days))
    if (params?.severity) q.set('severity', params.severity)
    const qs = q.toString()
    return request<{ events: any[] }>(`/api/security/security-events${qs ? `?${qs}` : ''}`)
  },
}
