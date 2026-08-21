import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'
import { adminPendingDepositsApi } from '../../lib/adminPendingDepositsApi'
import { Banknote, Link2 as LinkIcon, ArrowUpRight } from 'lucide-react'

/** Live approval queues: fiat deposits, on-chain deposits, withdrawals. */
export function AdminApprovalQueues({
  onPendingDepositsLoaded,
}: {
  onPendingDepositsLoaded?: (n: number) => void
} = {}) {
  const [pendingDeposits, setPendingDeposits] = useState<
    Awaited<ReturnType<typeof adminPendingDepositsApi.listPendingDeposits>>['deposits']
  >([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [busyTx, setBusyTx] = useState<string | null>(null)
  const [onchain, setOnchain] = useState<
    Awaited<ReturnType<typeof adminPendingDepositsApi.listOnchainDeposits>>['pendingDeposits']
  >([])
  const [onchainLoading, setOnchainLoading] = useState(true)
  const [busyOnchain, setBusyOnchain] = useState<string | null>(null)
  const [pendingWithdrawals, setPendingWithdrawals] = useState<
    Awaited<ReturnType<typeof adminApi.listPendingWithdrawals>>['withdrawals']
  >([])
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true)
  const [busyWithdrawal, setBusyWithdrawal] = useState<string | null>(null)

  const refreshPending = () => {
    setPendingLoading(true)
    adminPendingDepositsApi
      .listPendingDeposits()
      .then((r) => {
        setPendingDeposits(r.deposits)
        onPendingDepositsLoaded?.(r.deposits.length)
      })
      .catch(() => {})
      .finally(() => setPendingLoading(false))
  }

  const refreshOnchain = () => {
    setOnchainLoading(true)
    adminPendingDepositsApi
      .listOnchainDeposits('pending')
      .then((r) => setOnchain(r.pendingDeposits))
      .catch(() => {})
      .finally(() => setOnchainLoading(false))
  }

  const refreshWithdrawals = () => {
    setWithdrawalsLoading(true)
    adminApi
      .listPendingWithdrawals()
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
      await adminPendingDepositsApi.approveDeposit(id)
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
      await adminPendingDepositsApi.rejectDeposit(id, reason)
      toast.success('Deposit rejected')
      refreshPending()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally {
      setBusyTx(null)
    }
  }

  async function handleApproveOnchain(d: (typeof onchain)[number]) {
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
      await adminPendingDepositsApi.approveOnchainDeposit(d.id, {
        currency: currencyInput.trim().toUpperCase(),
        amount,
        note,
      })
      toast.success(`Credited ${amount} ${currencyInput} to ${d.user.email}`)
      refreshOnchain()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally {
      setBusyOnchain(null)
    }
  }

  async function handleRejectOnchain(d: (typeof onchain)[number]) {
    const note = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusyOnchain(d.id)
    try {
      await adminPendingDepositsApi.rejectOnchainDeposit(d.id, note)
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
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#F57C00]" /> Pending deposit approvals
            {pendingDeposits.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F57C00]/15 text-[#F57C00]">
                {pendingDeposits.length}
              </span>
            )}
          </h2>
          <button type="button" onClick={refreshPending} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">
            Refresh
          </button>
        </div>
        {pendingLoading ? (
          <p className="text-xs text-[#737373]">Loading…</p>
        ) : pendingDeposits.length === 0 ? (
          <p className="text-xs text-[#737373]">No pending deposit requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingDeposits.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#E5E5E5]">
                    {d.user.name} <span className="text-[#737373]">·</span>{' '}
                    <span className="text-[11px] text-[#737373]">{d.user.email}</span>
                  </p>
                  <p className="text-[11px] text-[#737373] truncate">{d.reference || 'No reference'}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium text-[#E5E5E5]">
                    {(d.amount ?? 0).toLocaleString()} {d.currency}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyTx === d.id}
                    onClick={() => handleApprove(d.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyTx === d.id}
                    onClick={() => handleReject(d.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-[#3B99FC]" /> On-chain deposit approvals
            {onchain.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#3B99FC]/15 text-[#3B99FC]">
                {onchain.length}
              </span>
            )}
          </h2>
          <button type="button" onClick={refreshOnchain} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">
            Refresh
          </button>
        </div>
        {onchainLoading ? (
          <p className="text-xs text-[#737373]">Loading…</p>
        ) : onchain.length === 0 ? (
          <p className="text-xs text-[#737373]">No on-chain deposits awaiting verification.</p>
        ) : (
          <div className="space-y-2">
            {onchain.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/admin/users/${d.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">
                      {d.user.name}
                    </Link>
                    <span className="text-[#737373]">·</span>
                    <span className="text-[11px] text-[#737373]">{d.user.email}</span>
                  </div>
                  <p className="text-[11px] text-[#737373] truncate font-mono mt-1">
                    from {d.fromAddress.slice(0, 10)}…{d.fromAddress.slice(-6)} → {d.toAddress.slice(0, 10)}…
                    {d.toAddress.slice(-6)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium text-[#E5E5E5]">
                    {d.amount} {d.asset}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyOnchain === d.id}
                    onClick={() => handleApproveOnchain(d)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50"
                  >
                    Approve & credit
                  </button>
                  <button
                    type="button"
                    disabled={busyOnchain === d.id}
                    onClick={() => handleRejectOnchain(d)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[#f44336]" /> Pending withdrawal payouts
            {pendingWithdrawals.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f44336]/15 text-[#f44336]">
                {pendingWithdrawals.length}
              </span>
            )}
          </h2>
          <button type="button" onClick={refreshWithdrawals} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">
            Refresh
          </button>
        </div>
        {withdrawalsLoading ? (
          <p className="text-xs text-[#737373]">Loading…</p>
        ) : pendingWithdrawals.length === 0 ? (
          <p className="text-xs text-[#737373]">No pending withdrawal requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingWithdrawals.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/admin/users/${w.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">
                      {w.user.name}
                    </Link>
                    <span className="text-[#737373]">·</span>
                    <span className="text-[11px] text-[#737373]">{w.user.email}</span>
                  </div>
                  <p className="text-[11px] text-[#737373] font-mono mt-1 truncate">
                    Send to: {w.walletLink?.address ?? 'unknown'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium text-[#E5E5E5]">
                    {w.amount} {w.asset}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyWithdrawal === w.id}
                    onClick={() => handleApproveWithdrawal(w.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50"
                  >
                    Approve & mark sent
                  </button>
                  <button
                    type="button"
                    disabled={busyWithdrawal === w.id}
                    onClick={() => handleRejectWithdrawal(w.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** @deprecated use AdminApprovalQueues */
export const AdminConsoleContent = AdminApprovalQueues
