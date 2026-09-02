import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Link2 as LinkIcon } from 'lucide-react'
import { adminApi } from '../lib/adminApi'

export function AdminOnchainQueue() {
  const [onchain, setOnchain] = useState<Awaited<ReturnType<typeof adminApi.listOnchainDeposits>>['pendingDeposits']>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    adminApi.listOnchainDeposits('pending')
      .then((r) => setOnchain(r.pendingDeposits))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [])

  async function approve(d: typeof onchain[number]) {
    const currencyInput = window.prompt(`Credit user as which currency?\n(Default: ${d.asset}. Type USD to credit cash equivalent instead.)`, d.asset)
    if (currencyInput === null) return
    const amountInput = window.prompt(`Credit how much ${currencyInput}?\n(Default: ${d.amount})`, String(d.amount))
    if (amountInput === null) return
    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Invalid amount'); return }
    const note = window.prompt('Optional note:', '') || undefined
    setBusy(d.id)
    try {
      await adminApi.approveOnchainDeposit(d.id, { currency: currencyInput.trim().toUpperCase(), amount, note })
      toast.success(`Credited ${amount} ${currencyInput} to ${d.user.email}`)
      refresh()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally {
      setBusy(null)
    }
  }

  async function reject(d: typeof onchain[number]) {
    const note = window.prompt('Reason for rejection?', '') || ''
    setBusy(d.id)
    try {
      await adminApi.rejectOnchainDeposit(d.id, note)
      toast.success('On-chain deposit rejected')
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
          <LinkIcon className="w-4 h-4 text-[#3B99FC]" /> On-chain deposit approvals
          {onchain.length > 0 && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#3B99FC]/15 text-[#3B99FC]">{onchain.length}</span>}
        </h2>
        <button type="button" onClick={refresh} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
      </div>
      {loading ? <p className="text-xs text-[#737373]">Loading…</p> : onchain.length === 0 ? (
        <p className="text-xs text-[#737373]">No on-chain deposits awaiting verification.</p>
      ) : (
        <div className="space-y-2">
          {onchain.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/admin/users/${d.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">{d.user.name}</Link>
                  <span className="text-[11px] text-[#737373]">{d.user.email}</span>
                </div>
                <p className="text-[11px] text-[#737373] font-mono mt-1 truncate">from {d.fromAddress.slice(0, 10)}… → {d.toAddress.slice(0, 10)}…</p>
              </div>
              <p className="text-base font-medium text-[#E5E5E5]">{d.amount} {d.asset}</p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={busy === d.id} onClick={() => approve(d)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white disabled:opacity-50">Approve & credit</button>
                <button type="button" disabled={busy === d.id} onClick={() => reject(d)} className="px-3 py-1.5 text-xs rounded-lg border border-[#f44336]/40 text-[#f44336] disabled:opacity-50">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
