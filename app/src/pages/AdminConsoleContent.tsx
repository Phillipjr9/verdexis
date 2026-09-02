import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { adminApi } from '../lib/adminApi'
import { Banknote, ArrowUpRight, Link2 as LinkIcon } from 'lucide-react'

export function AdminConsoleContent({ onPendingDepositsLoaded }: { onPendingDepositsLoaded?: (n: number) => void } = {}) {
  const [pendingDeposits, setPendingDeposits] = useState<Awaited<ReturnType<typeof adminApi.listPendingDeposits>>['deposits']>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [busyTx, setBusyTx] = useState<string | null>(null)
  const [onchain, setOnchain] = useState<Awaited<ReturnType<typeof adminApi.listOnchainDeposits>>['pendingDeposits']>([])
  const [onchainLoading, setOnchainLoading] = useState(true)
  const [busyOnchain, setBusyOnchain] = useState<string | null>(null)
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Awaited<ReturnType<typeof adminApi.listPendingWithdrawals>>['withdrawals']>([])
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true)
  const [busyWithdrawal, setBusyWithdrawal] = useState<string | null>(null)

  const refreshPending = () => {
    setPendingLoading(true)
    adminApi.listPendingDeposits()
      .then((r) => {
        setPendingDeposits(r.deposits)
        onPendingDepositsLoaded?.(r.deposits.length)
      })
      .catch(() => {})
      .finally(() => setPendingLoading(false))
  }

  const refreshOnchain = () => {
    setOnchainLoading(true)
    adminApi.listOnchainDeposits('pending')
      .then((r) => setOnchain(r.pendingDeposits))
      .catch(() => {})
      .finally(() => setOnchainLoading(false))
  }

  const refreshWithdrawals = () => {
    setWithdrawalsLoading(true)
    adminApi.listPendingWithdrawals()
      .then((r) => setPendingWithdrawals(r.withdrawals))
      .catch(() => {})
      .finally(() => setWithdrawalsLoading(false))
  }

  useEffect(() => {
    refreshPending()
    refreshOnchain()
    refreshWithdrawals()
    const t = setInterval(() => {
      refreshPending()
      refreshOnchain()
      refreshWithdrawals()
    }, 30_000)
    return () => clearInterval(t)
  }, [])

  async function handleApprove(id: string) {
    setBusyTx(id)
    try {
      await adminApi.approveDeposit(id)
      toast.success('Deposit approved — funds credited to user')
      refreshPending()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally {
      setBusyTx(null)
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusyTx(id)
    try {
      await adminApi.rejectDeposit(id, reason)
      toast.success('Deposit rejected')
      refreshPending()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally {
      setBusyTx(null)
    }
  }

  async function handleApproveOnchain(d: typeof onchain[number]) {
    const currencyInput = window.prompt(
      `Credit user as which currency?\n(Default: ${d.asset}. Type USD to credit cash equivalent instead.)`,
      d.asset,
    )
    if (currencyInput === null) return
    const amountInput = window.prompt(
      `Credit how much ${currencyInput}?\n(Default: ${d.amount} — the on-chain amount.)`,
      String(d.amount),
    )
    if (amountInput === null) return
    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Invalid amount')
      return
    }
    const note = window.prompt('Optional note for the audit log / user notification:', '') || undefined
    setBusyOnchain(d.id)
    try {
      await adminApi.approveOnchainDeposit(d.id, { currency: currencyInput.trim().toUpperCase(), amount, note })
      toast.success(`Credited ${amount} ${currencyInput} to ${d.user.email}`)
      refreshOnchain()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally {
      setBusyOnchain(null)
    }
  }

  async function handleRejectOnchain(d: typeof onchain[number]) {
    const note = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusyOnchain(d.id)
    try {
      await adminApi.rejectOnchainDeposit(d.id, note)
      toast.success('On-chain deposit rejected')
      refreshOnchain()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally {
      setBusyOnchain(null)
    }
  }

  async function handleApproveWithdrawal(id: string) {
    const txHash = window.prompt('Enter the on-chain transaction hash for this payout:')
    if (!txHash) return
    setBusyWithdrawal(id)
    try {
      await adminApi.approveWithdrawal(id, txHash)
      toast.success('Withdrawal approved — user notified')
      refreshWithdrawals()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally {
      setBusyWithdrawal(null)
    }
  }

  async function handleRejectWithdrawal(id: string) {
    const reason = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusyWithdrawal(id)
    try {
      await adminApi.rejectWithdrawal(id, reason)
      toast.success('Withdrawal rejected — balance refunded to user')
      refreshWithdrawals()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally {
      setBusyWithdrawal(null)
    }
  }

  return (
    <>
      <section className="mt-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#F57C00]" /> Pending deposit approvals
            {pendingDeposits.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F57C00]/15 text-[#F57C00]">{pendingDeposits.length}</span>
            )}
          </h2>
          <button type="button" onClick={refreshPending} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
        </div>
        {pendingLoading ? (
          <p className="text-xs text-[#737373]">Loading…</p>
        ) : pendingDeposits.length === 0 ? (
          <p className="text-xs text-[#737373]">No pending deposit requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingDeposits.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#E5E5E5]">{d.user.name} <span className="text-[#737373]">·</span> <span className="text-[11px] text-[#737373]">{d.user.email}</span></p>
                  <p className="text-[11px] text-[#737373] truncate">{d.reference || 'No reference'}</p>
                </div>
                <p className="text-base font-medium text-[#E5E5E5]">{(d.amount ?? 0).toLocaleString()} {d.currency}</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyTx === d.id} onClick={() => handleApprove(d.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white disabled:opacity-50">Approve</button>
                  <button type="button" disabled={busyTx === d.id} onClick={() => handleReject(d.id)} className="px-3 py-1.5 text-xs rounded-lg border border-[#f44336]/40 text-[#f44336] disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
