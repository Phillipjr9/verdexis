import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { getToken } from './api'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

export interface Passkey {
  id: string
  credentialId: string
  deviceName: string
  lastUsedAt: string | null
  createdAt: string
}

async function passkeyRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw err
  }
  return res.json() as Promise<T>
}

export async function listPasskeys(): Promise<Passkey[]> {
  const res = await passkeyRequest<{ passkeys: Passkey[] }>('/api/passkeys')
  return res.passkeys
}

export async function registerPasskey(deviceName: string): Promise<{ id: string; deviceName: string }> {
  throw new Error('Passkeys require HTTPS or proper domain configuration. Currently only available in production.')
}

export async function authenticateWithPasskey(email?: string): Promise<{ token: string; user: any }> {
  throw new Error('Passkeys require HTTPS or proper domain configuration. Currently only available in production.')
}

export async function deletePasskey(id: string): Promise<void> {
  await passkeyRequest(`/api/passkeys/${id}`, { method: 'DELETE' })
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  )
}
