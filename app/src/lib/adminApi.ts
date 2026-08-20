// Typed wrapper around the /api/admin/* endpoints.
// Uses the same Bearer-token storage as the regular `api` client.

import { getToken } from './api'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string }
    throw Object.assign(new Error(err.error || res.statusText || 'Request failed'), { status: res.status, ...data })
  }
  return data as T
}

// PLACEHOLDER_WILL_REPLACE
