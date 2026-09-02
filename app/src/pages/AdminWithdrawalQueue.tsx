import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowUpRight } from 'lucide-react'
import { adminApi } from '../lib/adminApi'

export function AdminWithdrawalQueue() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminApi.listPendingWithdrawals>>['withdrawals']>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    adminApi.listPendingWithdrawals()
      .then((r) => setRows(r.withdrawals))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [])

  async function approve(id: string) {
    const txHash = window.prompt('Enter the on-chain transaction hash for this payout:')
    if (!txHash) return
    setBusy(id)
    try {
      await adminApi.approveWithdrawal(id, txHash)
      toast.success('Withdrawal approved — user notified')
      refresh()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusy(id)
    try {
      await adminApi.rejectWithdrawal(id, reason)
      toast.success('Withdrawal rejected — balance refunded to user')
      refresh()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-[#f44336]" /> Pending withdrawal payouts
          {rows.length > 0 && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f44336]/15 text-[#f44336]">{rows.length}</span>}
        </h2>
        <button type="button" onClick={refresh} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
      </div>
      {loading ? <p className="text-xs text-[#737373]">Loading…</p> : rows.length === 0 ? (
        <p className="text-xs text-[#737373]">No pending withdrawal requests.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/admin/users/${w.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">{w.user.name}</Link>
                  <span className="text-[11px] text-[#737373]">{w.user.email}</span>
                </div>
                <p className="text-[11px] text-[#737373] font-mono mt-1 truncate">Send to: {w.walletLink?.address ?? 'unknown'}</p>
              </div>
              <p className="text-base font-medium text-[#E5E5E5]">{w.amount} {w.asset}</p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={busy === w.id} onClick={() => approve(w.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white disabled:opacity-50">Approve & mark sent</button>
                <button type="button" disabled={busy === w.id} onClick={() => reject(w.id)} className="px-3 py-1.5 text-xs rounded-lg border border-[#f44336]/40 text-[#f44336] disabled:opacity-50">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
