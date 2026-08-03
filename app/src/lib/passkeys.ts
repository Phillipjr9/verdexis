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
  const { options, challengeKey } = await passkeyRequest<{ options: PublicKeyCredentialCreationOptionsJSON; challengeKey: string }>(
    '/api/passkeys/register/options',
    { method: 'POST', body: JSON.stringify({}) }
  )
  const response = await startRegistration({ optionsJSON: options })
  const result = await passkeyRequest<{ verified: boolean; passkey: { id: string; deviceName: string } }>(
    '/api/passkeys/register/verify',
    { method: 'POST', body: JSON.stringify({ response, deviceName, challengeKey }) }
  )
  if (!result.verified) throw new Error('Passkey registration failed')
  return result.passkey
}

export async function authenticateWithPasskey(email?: string): Promise<{ token: string; user: any }> {
  if (!email) throw new Error('Email is required for passkey authentication')
  const { options, challengeKey } = await passkeyRequest<{ options: PublicKeyCredentialRequestOptionsJSON; challengeKey: string }>(
    '/api/passkeys/auth/options',
    { method: 'POST', body: JSON.stringify({ email }) }
  )
  const response = await startAuthentication({ optionsJSON: options })
  return passkeyRequest<{ token: string; user: any }>(
    '/api/passkeys/auth/verify',
    { method: 'POST', body: JSON.stringify({ response, challengeKey }) }
  )
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
