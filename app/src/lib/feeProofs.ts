// Fee-payment proofs. Database is the source of truth — no localStorage.

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
  feeProof: string
  reference: string
  status: FeeProofStatus
  createdAt: string
  reviewedAt?: string
  reviewerNote?: string
}

let memory: FeeProof[] = []

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEE_PROOFS_EVENT))
}

function replace(list: FeeProof[]) {
  memory = list.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  emit()
}

export const feeProofs = {
  list(): FeeProof[] {
    return memory.slice()
  },
  listForUser(email: string): FeeProof[] {
    const k = (email || '').trim().toLowerCase()
    if (!k) return []
    return memory.filter((p) => p.userEmail.toLowerCase() === k)
  },
  pendingForUser(email: string): FeeProof[] {
    return this.listForUser(email).filter((p) => p.status === 'pending')
  },
  add(input: Omit<FeeProof, 'id' | 'status' | 'createdAt'>): FeeProof {
    const proof: FeeProof = {
      ...input,
      feeProof: (input.feeProof || '').trim(),
      id: `fp_tmp_${Date.now().toString(36)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    memory = [proof, ...memory]
    emit()
    void this.syncCreate(proof)
    return proof
  },
  async addAndWait(input: Omit<FeeProof, 'id' | 'status' | 'createdAt'>): Promise<FeeProof> {
    const proof = this.add(input)
    await this.syncCreate(proof)
    return memory.find((p) => p.reference === input.reference && p.userEmail === input.userEmail) || proof
  },
  async syncCreate(proof: FeeProof): Promise<void> {
    try {
      const { api } = await import('./api')
      const remote = await api.post<{ proof: FeeProof }>('/api/fee-proofs', {
        feeProof: proof.feeProof,
        feeUsd: proof.feeUsd,
        amount: proof.amount,
        currency: proof.currency,
        feePayCurrency: proof.feePayCurrency,
        kind: proof.kind || 'withdraw_fee',
        reference: proof.reference,
      })
      if (remote?.proof?.id) {
        memory = memory.map((p) => (p.id === proof.id ? { ...p, ...remote.proof } : p))
        emit()
      }
    } catch (e) {
      console.warn('[feeProofs] server create failed', e)
    }
  },
  setStatus(id: string, status: FeeProofStatus, reviewerNote?: string): FeeProof | null {
    const idx = memory.findIndex((p) => p.id === id)
    if (idx < 0) return null
    memory[idx] = { ...memory[idx], status, reviewerNote, reviewedAt: new Date().toISOString() }
    emit()
    void this.syncStatus(id, status, reviewerNote)
    return memory[idx]
  },
  async syncStatus(id: string, status: FeeProofStatus, reviewerNote?: string): Promise<void> {
    try {
      const { adminApi } = await import('./adminApi')
      const res = await adminApi.updateFeeProof(id, { status, reviewerNote })
      if (res?.proof) {
        memory = memory.map((p) => (p.id === id ? { ...p, ...(res.proof as FeeProof) } : p))
        emit()
      }
    } catch (e) {
      console.warn('[feeProofs] status sync failed', e)
    }
  },
  remove(id: string): void {
    memory = memory.filter((p) => p.id !== id)
    emit()
  },
  async hydrateForUser(opts: { userId?: string; email?: string; admin?: boolean }): Promise<FeeProof[]> {
    try {
      if (opts.admin && opts.userId) {
        const { adminApi } = await import('./adminApi')
        const res = await adminApi.listUserFeeProofs(opts.userId, opts.email)
        const remote = (res?.proofs || []) as FeeProof[]
        replace(remote.map((p) => ({ ...p, userEmail: p.userEmail || opts.email || '' })))
        return this.listForUser(opts.email || '')
      }
      const { api } = await import('./api')
      const res = await api.get<{ proofs: FeeProof[] }>('/api/fee-proofs')
      replace(res?.proofs || [])
      return memory.slice()
    } catch (e) {
      console.warn('[feeProofs] hydrate failed', e)
      return opts.email ? this.listForUser(opts.email) : memory.slice()
    }
  },
}
