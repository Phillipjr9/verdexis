import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Banknote, RefreshCw } from 'lucide-react'
import { adminApi } from '../../lib/adminApi'

type Proof = {
  id: string
  userId?: string
  userEmail?: string
  kind?: string
  amount?: number
  currency?: string
  feeUsd?: number
  feePayCurrency?: string
  feeProof?: string
  reference?: string
  status?: string
  createdAt?: string
  reviewerNote?: string
}

type Filter = 'pending' | 'verified' | 'rejected' | 'all'

export function AdminFeeProofsPanel() {
  const [proofs, setProofs] = useState<Proof[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')

  function load() {
    setLoading(true)
    const req = filter === 'pending'
      ? adminApi.listPendingFeeProofs()
      : adminApi.listAllFeeProofs(filter === 'all' ? undefined : filter)
    req
      .then((r) => setProofs((r.proofs || []) as Proof[]))
      .catch((e: { error?: string }) => toast.error(e.error || 'Could not load fee payments'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  async function review(id: string, status: 'verified' | 'rejected' | 'pending') {
    const reviewerNote = window.prompt(
      status === 'verified' ? 'Optional note (fee payment confirmed):' : status === 'rejected' ? 'Reason for rejection:' : 'Note:',
    ) || undefined
    setBusy(id)
    try {
      await adminApi.updateFeeProof(id, { status, reviewerNote })
      toast.success(status === 'verified' ? 'Fee payment marked verified' : status === 'rejected' ? 'Fee payment rejected' : 'Moved back to pending')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[#0C8B44]" />
          Processing fee payments
          {filter === 'pending' && proofs.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#0C8B44]/15 text-[#0C8B44]">{proofs.length} pending</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {(['pending', 'verified', 'rejected', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[11px] px-2 py-1 rounded-lg border ${filter === f ? 'border-[#0C8B44] text-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff10] text-[#A0A0A0]'}`}
            >
              {f}
            </button>
          ))}
          <button type="button" onClick={load} className="inline-flex items-center gap-1 text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#737373] mb-4">
        Users pay withdrawal / bonus-unlock processing fees out of band and submit a tx hash. Verify or reject them here.
      </p>
      {loading ? (
        <p className="text-xs text-[#737373]">Loading fee payments…</p>
      ) : proofs.length === 0 ? (
        <p className="text-xs text-[#737373]">
          {filter === 'pending' ? 'No pending fee payments.' : `No ${filter === 'all' ? '' : filter + ' '}fee payments yet.`}
        </p>
      ) : (
        <div className="space-y-2">
          {proofs.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.userId ? (
                    <Link to={`/admin/users/${p.userId}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">{p.userEmail || p.userId}</Link>
                  ) : (
                    <span className="text-sm text-[#E5E5E5]">{p.userEmail || 'Unknown user'}</span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider text-[#A0A0A0]">{p.kind === 'bonus_unlock' ? 'Bonus unlock' : 'Withdrawal fee'}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    p.status === 'verified' ? 'bg-[#0C8B44]/15 text-[#0C8B44]' :
                    p.status === 'rejected' ? 'bg-[#f44336]/15 text-[#f44336]' :
                    'bg-[#ffffff10] text-[#A0A0A0]'
                  }`}>{p.status || 'pending'}</span>
                </div>
                <p className="text-[11px] text-[#737373] font-mono mt-1 truncate" title={p.feeProof}>
                  {p.feeProof || 'No hash'} {p.reference ? `· ${p.reference}` : ''}
                </p>
                {p.reviewerNote && <p className="text-[11px] text-[#A0A0A0] mt-0.5">{p.reviewerNote}</p>}
                {p.createdAt && <p className="text-[10px] text-[#737373]">{new Date(p.createdAt).toLocaleString()}</p>}
              </div>
              <div className="text-right">
                <p className="text-base font-medium text-[#E5E5E5]">${Number(p.feeUsd || 0).toFixed(2)} {p.feePayCurrency || 'USD'}</p>
                <p className="text-[11px] text-[#737373]">{p.amount ?? 0} {p.currency || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {p.status !== 'verified' && (
                  <button type="button" disabled={busy === p.id} onClick={() => review(p.id, 'verified')} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50">Verify</button>
                )}
                {p.status !== 'rejected' && (
                  <button type="button" disabled={busy === p.id} onClick={() => review(p.id, 'rejected')} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50">Reject</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
