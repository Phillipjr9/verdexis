// Fee-payment proof queue (server-backed with localStorage cache).
//
// Flow:
//  1. User submits a withdrawal + external tx hash / wire ref proving they
//     paid the processing fee out-of-band.
//  2. POST /api/fee-proofs stores a FinancialEvent (eventType = fee_proof).
//  3. Admin reviews via /api/admin/fee-proofs/:id/verify|reject.
//     Verify can credit the fee back and/or unlock the signup bonus lock.
//
// localStorage is kept as a fast offline cache and for multi-tab sync via
// FEE_PROOFS_EVENT. When the API is reachable, server is authoritative.

import { getToken } from './api'

const STORAGE_KEY = 'verdexis_fee_proofs_v1'
export const FEE_PROOFS_EVENT = 'verdexis:feeProofs'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

export type FeeProofStatus = 'pending' | 'verified' | 'rejected'
export type FeeProofKind = 'withdraw_fee' | 'bonus_unlock'

export interface FeeProof {
  id: string
  userId?: string
  userEmail: string
  kind?: FeeProofKind
  amount: number
  currency: string
  feeUsd: number
  feePayCurrency: string
  feeProof: string
  reference: string
  status: FeeProofStatus
  createdAt: string
  reviewedAt?: string
  reviewerNote?: string
  creditedFee?: boolean
  unlockedBonus?: boolean
}

function readCache(): FeeProof[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as FeeProof[]) : []
  } catch {
    return []
  }
}

function writeCache(list: FeeProof[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event(FEE_PROOFS_EVENT))
  } catch {
    /* quota / private mode */
  }
}

function mergeIntoCache(proofs: FeeProof[]) {
  const byId = new Map(readCache().map((p) => [p.id, p]))
  for (const p of proofs) byId.set(p.id, p)
  const next = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  writeCache(next)
  return next
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  if (!res.ok) {
    const err = body as { error?: string }
    throw new Error(err.error || `Request failed with ${res.status}`)
  }
  return body as T
}

function newId(): string {
  return `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const feeProofs = {
  /** Sync cache read (used by UI that expects immediate list). */
  list(): FeeProof[] {
    return readCache()
  },

  listForUser(email: string): FeeProof[] {
    const k = (email || '').trim().toLowerCase()
    if (!k) return []
    return readCache().filter((p) => p.userEmail.toLowerCase() === k)
  },

  pendingForUser(email: string): FeeProof[] {
    return this.listForUser(email).filter((p) => p.status === 'pending')
  },

  /** Prefer server; fall back to cache. */
  async fetchMine(): Promise<FeeProof[]> {
    try {
      const data = await apiRequest<{ proofs: FeeProof[] }>('/api/fee-proofs/me')
      const proofs = Array.isArray(data.proofs) ? data.proofs : []
      mergeIntoCache(proofs)
      return proofs
    } catch {
      return readCache()
    }
  },

  async fetchAll(status?: FeeProofStatus): Promise<FeeProof[]> {
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : ''
      const data = await apiRequest<{ proofs: FeeProof[] }>(`/api/admin/fee-proofs${q}`)
      const proofs = Array.isArray(data.proofs) ? data.proofs : []
      mergeIntoCache(proofs)
      return proofs
    } catch {
      return readCache()
    }
  },

  /** Submit a new proof (server first, then cache). */
  async submit(
    input: Omit<FeeProof, 'id' | 'status' | 'createdAt'>,
  ): Promise<FeeProof> {
    try {
      const data = await apiRequest<{ proof: FeeProof }>('/api/fee-proofs', {
        method: 'POST',
        body: JSON.stringify({
          kind: input.kind ?? 'withdraw_fee',
          amount: input.amount,
          currency: input.currency,
          feeUsd: input.feeUsd,
          feePayCurrency: input.feePayCurrency,
          feeProof: input.feeProof,
          reference: input.reference,
        }),
      })
      if (data.proof) {
        mergeIntoCache([data.proof])
        return data.proof
      }
    } catch (e) {
      console.warn('[feeProofs] server submit failed, using local queue', e)
    }
    const proof: FeeProof = {
      ...input,
      id: newId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const list = readCache()
    list.unshift(proof)
    writeCache(list)
    return proof
  },

  /** Legacy sync add used by older call sites — prefer submit(). */
  add(input: Omit<FeeProof, 'id' | 'status' | 'createdAt'>): FeeProof {
    const proof: FeeProof = {
      ...input,
      id: newId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const list = readCache()
    list.unshift(proof)
    writeCache(list)
    // Fire-and-forget server sync
    void this.submit(input).catch(() => {})
    return proof
  },

  setStatus(id: string, status: FeeProofStatus, reviewerNote?: string): FeeProof | null {
    const list = readCache()
    const idx = list.findIndex((p) => p.id === id)
    if (idx < 0) return null
    list[idx] = {
      ...list[idx],
      status,
      reviewerNote,
      reviewedAt: new Date().toISOString(),
    }
    writeCache(list)
    return list[idx]
  },

  async verify(
    id: string,
    opts?: { note?: string; creditFee?: boolean; unlockBonus?: boolean; notify?: boolean },
  ): Promise<FeeProof | null> {
    try {
      const data = await apiRequest<{ proof: FeeProof | null }>(
        `/api/admin/fee-proofs/${id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            note: opts?.note,
            creditFee: opts?.creditFee ?? true,
            unlockBonus: opts?.unlockBonus ?? true,
            notify: opts?.notify ?? true,
          }),
        },
      )
      if (data.proof) {
        mergeIntoCache([data.proof])
        return data.proof
      }
    } catch (e) {
      console.warn('[feeProofs] verify failed', e)
      throw e
    }
    return this.setStatus(id, 'verified', opts?.note)
  },

  async reject(id: string, note?: string): Promise<FeeProof | null> {
    try {
      const data = await apiRequest<{ proof: FeeProof }>(
        `/api/admin/fee-proofs/${id}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ note, notify: true }),
        },
      )
      if (data.proof) {
        mergeIntoCache([data.proof])
        return data.proof
      }
    } catch (e) {
      console.warn('[feeProofs] reject failed', e)
      throw e
    }
    return this.setStatus(id, 'rejected', note)
  },

  remove(id: string): void {
    writeCache(readCache().filter((p) => p.id !== id))
  },
}
