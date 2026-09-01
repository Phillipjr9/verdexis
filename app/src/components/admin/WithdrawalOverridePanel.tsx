import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { getToken } from '../../lib/api'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw { status: res.status, error: (body as { error?: string }).error || 'Request failed' }
  return body as T
}

export default function WithdrawalOverridePanel({ userId }: { userId: string }) {
  const [feeRate, setFeeRate] = useState('')
  const [waiveFee, setWaiveFee] = useState(false)
  const [requireAdminApproval, setRequireAdminApproval] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    request<{ feeRate: number | null; waiveFee: boolean; requireAdminApproval: boolean }>(`/api/admin/users/${userId}/withdrawal-overrides`)
      .then((r) => {
        if (!alive) return
        setFeeRate(r.feeRate == null ? '' : String(r.feeRate))
        setWaiveFee(!!r.waiveFee)
        setRequireAdminApproval(!!r.requireAdminApproval)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => { alive = false }
  }, [userId])

  async function save(e: FormEvent) {
    e.preventDefault()
    const raw = feeRate.trim()
    const parsed = raw === '' ? null : Number(raw)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)) {
      toast.error('Fee rate must be between 0 and 100')
      return
    }
    setBusy(true)
    try {
      await request(`/api/admin/users/${userId}/withdrawal-overrides`, {
        method: 'POST',
        body: JSON.stringify({
          feeRate: parsed,
          waiveFee,
          requireAdminApproval,
          reason: reason.trim() || undefined,
          notify: true,
        }),
      })
      toast.success('Admin override saved')
      setReason('')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to save override')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-[#0C8B44]/5 border border-[#0C8B44]/20 p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-1 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#0C8B44]" />Admin override
      </h2>
      <p className="text-[11px] text-[#737373] mb-4">
        Control this user's processing fee and whether an on-chain fee hash can release the withdrawal without you.
      </p>
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-[11px] text-[#A0A0A0] md:col-span-2">
          Custom processing fee %
          <input
            value={feeRate}
            onChange={(e) => setFeeRate(e.target.value)}
            placeholder="Leave blank for standard tier rate"
            className="mt-1 w-full px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5]"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-[#A0A0A0]">
          <input type="checkbox" checked={waiveFee} onChange={(e) => setWaiveFee(e.target.checked)} className="accent-[#0C8B44]" />
          Waive processing fee
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-[#A0A0A0]">
          <input type="checkbox" checked={requireAdminApproval} onChange={(e) => setRequireAdminApproval(e.target.checked)} className="accent-[#0C8B44]" />
          Hold withdrawals for admin approval
        </label>
        <label className="text-[11px] text-[#A0A0A0] md:col-span-2">
          Reason (optional, shown to user)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5]"
          />
        </label>
        <div className="md:col-span-2">
          <button type="submit" disabled={busy || !loaded} className="w-full py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
            {busy ? 'Saving…' : 'Save override'}
          </button>
        </div>
      </form>
    </section>
  )
}
