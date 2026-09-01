// Fee-payment proofs awaiting admin verification.
// Users may optionally paste a tx hash / wire ref after paying the processing fee.
// Server is source of truth; localStorage is a cache for offline/demo.

const STORAGE_KEY = 'verdexis_fee_proofs_v1'
export const FEE_PROOFS_EVENT = 'verdexis:feeProofs'

export type FeeProofStatus = 'pending' | 'verified' | 'rejected'
export type FeeProofKind = 'withdraw_fee' | 'bonus_unlock'

export interface FeeProof {
  id: string
  userEmail: string
  userId?: string
  userName?: string
  userUsername?: string
  userInvestmentId?: string
  userCountry?: string
  userCity?: string
  kind?: FeeProofKind
  amount: number
  currency: string
  feeUsd: number
  feePayCurrency: string
  /** Optional — empty string if user skipped proof */
  feeProof: string
  reference: string
  status: FeeProofStatus
  createdAt: string
  reviewedAt?: string
  reviewerNote?: string
}

function read(): FeeProof[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as FeeProof[]) : []
  } catch {
    return []
  }
}

function write(list: FeeProof[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEE_PROOFS_EVENT))
}

function newId(): string {
  return `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function mergeById(local: FeeProof[], remote: FeeProof[]): FeeProof[] {
  const map = new Map<string, FeeProof>()
  for (const p of local) map.set(p.id, p)
  for (const p of remote) map.set(p.id, { ...map.get(p.id), ...p })
  return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export const feeProofs = {
  list(): FeeProof[] {
    return read()
  },
  listForUser(email: string): FeeProof[] {
    const k = (email || '').trim().toLowerCase()
    if (!k) return []
    return read().filter((p) => p.userEmail.toLowerCase() === k)
  },
  pendingForUser(email: string): FeeProof[] {
    return this.listForUser(email).filter((p) => p.status === 'pending')
  },
  add(input: Omit<FeeProof, 'id' | 'status' | 'createdAt'>): FeeProof {
    const proof: FeeProof = {
      ...input,
      feeProof: (input.feeProof || '').trim(),
      id: newId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const list = read()
    list.unshift(proof)
    write(list)
    void this.syncCreate(proof)
    return proof
  },
  async syncCreate(proof: FeeProof): Promise<void> {
    try {
      const { api } = await import('./api')
      const remote = await api.post<{ proof: { id: string; userId?: string; createdAt?: string } }>('/api/fee-proofs', {
        feeProof: proof.feeProof,
        feeUsd: proof.feeUsd,
        amount: proof.amount,
        currency: proof.currency,
        feePayCurrency: proof.feePayCurrency,
        kind: proof.kind || 'withdraw_fee',
        reference: proof.reference,
      })
      if (remote?.proof?.id) {
        const list = read().map((p) =>
          p.id === proof.id
            ? {
                ...p,
                id: remote.proof.id as string,
                userId: remote.proof.userId as string | undefined,
                createdAt: (remote.proof.createdAt as string) || p.createdAt,
              }
            : p,
        )
        write(list)
      }
    } catch (e) {
      console.warn('[feeProofs] server sync failed', e)
    }
  },
  setStatus(id: string, status: FeeProofStatus, reviewerNote?: string): FeeProof | null {
    const list = read()
    const idx = list.findIndex((p) => p.id === id)
    if (idx < 0) return null
    list[idx] = {
      ...list[idx],
      status,
      reviewerNote,
      reviewedAt: new Date().toISOString(),
    }
    write(list)
    void this.syncStatus(id, status, reviewerNote)
    return list[idx]
  },
  async syncStatus(id: string, status: FeeProofStatus, reviewerNote?: string): Promise<void> {
    try {
      const { adminApi } = await import('./adminApi')
      await (adminApi as any).updateFeeProof(id, { status, reviewerNote })
    } catch (e) {
      console.warn('[feeProofs] status sync failed', e)
    }
  },
  remove(id: string): void {
    write(read().filter((p) => p.id !== id))
  },
  async hydrateForUser(opts: { userId?: string; email?: string; admin?: boolean }): Promise<FeeProof[]> {
    try {
      if (opts.admin && opts.userId) {
        const { adminApi } = await import('./adminApi')
        const res = await (adminApi as any).listUserFeeProofs(opts.userId, opts.email)
        const remote = (res?.proofs || []) as FeeProof[]
        const email = (opts.email || '').toLowerCase()
        const merged = mergeById(
          email ? this.listForUser(email) : [],
          remote.map((p) => ({ ...p, userEmail: p.userEmail || opts.email || '' })),
        )
        const others = read().filter(
          (p) => p.userEmail.toLowerCase() !== email && p.userId !== opts.userId,
        )
        write([...merged, ...others])
        return merged
      }
      const { api } = await import('./api')
      const res = await api.get<{ proofs: unknown[] }>('/api/fee-proofs')
      const remote = (res?.proofs || []) as FeeProof[]
      const merged = mergeById(read(), remote)
      write(merged)
      return merged
    } catch (e) {
      console.warn('[feeProofs] hydrate failed', e)
      return opts.email ? this.listForUser(opts.email) : read()
    }
  },
}
