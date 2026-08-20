import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import {
  adminApi,
  type AdminUserDetailResponse,
  type AdminWalletBalance,
  type AdminHolding,
  type AdminTransaction,
  HOLD_REASONS,
  HOLD_TYPES,
  KYC_STATUSES,
} from '../lib/adminApi'
import { feeProofs, type FeeProof } from '../lib/feeProofs'
import {
  ArrowLeft,
  Ban,
  Lock,
  LockOpen,
  ShieldCheck,
  Wallet,
  RefreshCw,
} from 'lucide-react'

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const [data, setData] = useState<AdminUserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [proofs, setProofs] = useState<FeeProof[]>([])

  // Wallet edit form
  const [wCurrency, setWCurrency] = useState('USD')
  const [wBalance, setWBalance] = useState('')
  const [wAvailable, setWAvailable] = useState('')

  function load() {
    if (!userId) return
    setLoading(true)
    adminApi
      .getUser(userId)
      .then((r) => {
        setData(r)
        if (r.walletBalances?.[0]) {
          setWCurrency(r.walletBalances[0].currency)
          setWBalance(String(r.walletBalances[0].balance))
          setWAvailable(String(r.walletBalances[0].available))
        }
      })
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load user'))
      .finally(() => setLoading(false))

    feeProofs
      .fetchAll()
      .then((list) => setProofs(list.filter((p) => p.userId === userId || (data?.user.email && p.userEmail === data.user.email))))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!data?.user.email) return
    feeProofs
      .fetchAll()
      .then((list) =>
        setProofs(
          list.filter(
            (p) => p.userId === userId || p.userEmail?.toLowerCase() === data.user.email.toLowerCase(),
          ),
        ),
      )
      .catch(() => {})
  }, [data?.user.email, userId])

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0f11] text-[#E5E5E5] p-8">
        <p>Missing user id</p>
        <Link to="/admin/users" className="text-[#0C8B44] underline text-sm">← Back</Link>
      </div>
    )
  }

  const user = data?.user

  async function toggleSuspend() {
    if (!user) return
    setBusy(true)
    try {
      await adminApi.patchUser(user.id, {
        suspended: !user.suspended,
        suspendedReason: !user.suspended ? 'Admin suspension' : null,
      })
      toast.success(user.suspended ? 'User unsuspended' : 'User suspended')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function placeHold() {
    if (!user) return
    const reason = window.prompt('Hold reason code', 'suspicious_activity') || 'suspicious_activity'
    const holdType = (window.prompt('Hold type: all | withdraw | transfer', 'all') || 'all') as 'all' | 'withdraw' | 'transfer'
    setBusy(true)
    try {
      await adminApi.placeHold(user.id, { holdType, reason, notify: true })
      toast.success('Hold placed')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function releaseHold() {
    if (!user) return
    setBusy(true)
    try {
      await adminApi.releaseHold(user.id)
      toast.success('Hold released')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function setKyc(status: 'none' | 'pending' | 'approved' | 'rejected') {
    if (!user) return
    setBusy(true)
    try {
      await adminApi.setKyc(user.id, { status, notify: true })
      toast.success(`KYC set to ${status}`)
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveWallet() {
    if (!user) return
    const balance = parseFloat(wBalance)
    const available = parseFloat(wAvailable)
    if (!isFinite(balance) || !isFinite(available)) {
      toast.error('Invalid numbers')
      return
    }
    setBusy(true)
    try {
      await adminApi.setWallet(user.id, {
        currency: wCurrency,
        symbol: wCurrency,
        balance,
        available,
      })
      toast.success('Wallet updated')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function verifyProof(id: string) {
    setBusy(true)
    try {
      await feeProofs.verify(id, { creditFee: true, unlockBonus: true, notify: true })
      toast.success('Fee proof verified')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verify failed')
    } finally {
      setBusy(false)
    }
  }

  async function rejectProof(id: string) {
    const note = window.prompt('Rejection note', '') || undefined
    setBusy(true)
    try {
      await feeProofs.reject(id, note)
      toast.success('Fee proof rejected')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to users
        </Link>

        {loading || !user ? (
          <p className="text-[#737373]">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">{user.name}</h1>
                <p className="text-sm text-[#A0A0A0]">{user.email}</p>
                <p className="text-[11px] text-[#737373] mt-1 font-mono">{user.id}</p>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#ffffff15] text-[#A0A0A0] hover:border-[#0C8B44]/40"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'bg-[#1a1a1a] text-[#737373]'}`}>
                {user.role}
              </span>
              {user.suspended ? (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#f44336]/15 text-[#f44336]">Suspended</span>
              ) : (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#4CAF50]/15 text-[#4CAF50]">Active</span>
              )}
              {user.holdActive && (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#F57C00]/15 text-[#F57C00]">
                  Hold: {user.holdType}
                </span>
              )}
              <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#1a1a1a] text-[#A0A0A0]">
                KYC: {user.kycStatus}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mb-8">
              <button type="button" disabled={busy} onClick={toggleSuspend} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#ffffff12] text-[#E5E5E5] hover:border-[#f44336]/40 disabled:opacity-50">
                <Ban className="w-3.5 h-3.5" /> {user.suspended ? 'Unsuspend' : 'Suspend'}
              </button>
              {user.holdActive ? (
                <button type="button" disabled={busy} onClick={releaseHold} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44]/15 text-[#0C8B44] disabled:opacity-50">
                  <LockOpen className="w-3.5 h-3.5" /> Release hold
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={placeHold} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#F57C00]/15 text-[#F57C00] disabled:opacity-50">
                  <Lock className="w-3.5 h-3.5" /> Place hold
                </button>
              )}
              {KYC_STATUSES.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  disabled={busy || user.kycStatus === k.value}
                  onClick={() => setKyc(k.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#ffffff12] text-[#A0A0A0] hover:border-[#0C8B44]/40 disabled:opacity-40"
                >
                  KYC → {k.label}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Wallet balances */}
              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#0C8B44]" /> Wallet balances
                </h2>
                <ul className="space-y-2 mb-4 text-sm">
                  {(data.walletBalances || []).length === 0 && (
                    <li className="text-[#737373] text-xs">No balances</li>
                  )}
                  {(data.walletBalances || []).map((w: AdminWalletBalance) => (
                    <li key={w.id} className="flex justify-between text-[#A0A0A0]">
                      <span>{w.currency}</span>
                      <span className="text-[#E5E5E5]">
                        {w.available.toLocaleString()} avail / {w.balance.toLocaleString()} total
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={wCurrency}
                    onChange={(e) => setWCurrency(e.target.value.toUpperCase())}
                    placeholder="USD"
                    className="px-2 py-1.5 bg-[#0a0f11] border border-[#ffffff10] rounded text-xs text-[#E5E5E5]"
                  />
                  <input
                    value={wBalance}
                    onChange={(e) => setWBalance(e.target.value)}
                    placeholder="Balance"
                    className="px-2 py-1.5 bg-[#0a0f11] border border-[#ffffff10] rounded text-xs text-[#E5E5E5]"
                  />
                  <input
                    value={wAvailable}
                    onChange={(e) => setWAvailable(e.target.value)}
                    placeholder="Available"
                    className="px-2 py-1.5 bg-[#0a0f11] border border-[#ffffff10] rounded text-xs text-[#E5E5E5]"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveWallet}
                  className="mt-2 px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50"
                >
                  Save wallet
                </button>
              </section>

              {/* Holdings */}
              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Holdings</h2>
                <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                  {(data.holdings || []).length === 0 && (
                    <li className="text-[#737373] text-xs">No holdings</li>
                  )}
                  {(data.holdings || []).map((h: AdminHolding) => (
                    <li key={h.id} className="flex justify-between text-[#A0A0A0]">
                      <span>{h.symbol}</span>
                      <span className="text-[#E5E5E5]">
                        {h.amount} @ ${h.avgPrice}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Recent transactions */}
            <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5 mb-8">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Recent transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[#737373] text-left">
                    <tr>
                      <th className="py-2 font-normal">Kind</th>
                      <th className="py-2 font-normal">Amount</th>
                      <th className="py-2 font-normal">Status</th>
                      <th className="py-2 font-normal">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.transactions || []).slice(0, 20).map((t: AdminTransaction) => (
                      <tr key={t.id} className="border-t border-[#ffffff05] text-[#A0A0A0]">
                        <td className="py-2">{t.kind}</td>
                        <td className="py-2 text-[#E5E5E5]">{t.amount} {t.currency}</td>
                        <td className="py-2">{t.status}</td>
                        <td className="py-2">{new Date(t.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(data.transactions || []).length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-[#737373]">No transactions</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Fee proofs */}
            <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0C8B44]" /> Fee proofs
              </h2>
              <ul className="space-y-3">
                {proofs.length === 0 && <li className="text-xs text-[#737373]">No fee proofs for this user</li>}
                {proofs.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border border-[#ffffff08] rounded-lg px-3 py-2">
                    <div>
                      <span className="text-[#E5E5E5]">{p.kind || 'fee'} · ${p.feeUsd}</span>
                      <span className="text-[#737373] ml-2">{p.status}</span>
                      {p.feeProof && <p className="text-[#737373] mt-0.5 truncate max-w-md">{p.feeProof}</p>}
                    </div>
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => verifyProof(p.id)} className="px-2 py-1 rounded bg-[#0C8B44] text-white disabled:opacity-50">Verify</button>
                        <button type="button" disabled={busy} onClick={() => rejectProof(p.id)} className="px-2 py-1 rounded bg-[#f44336]/20 text-[#f44336] disabled:opacity-50">Reject</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
