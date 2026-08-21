import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import {
  adminApi,
  type AdminUserDetailResponse,
  type AdminWalletBalance,
  DEPOSIT_REASONS,
  DEDUCT_REASONS,
} from '../lib/adminApi'
import { AdminWithdrawalConfig } from '../components/AdminWithdrawalConfig'
import { ArrowLeft, RefreshCw, Wallet, DollarSign } from 'lucide-react'

const inputCls =
  'w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]'
const btnPrimary =
  'px-4 py-2 bg-[#0C8B44] hover:bg-[#0a7a3a] text-white text-sm rounded-lg disabled:opacity-50'
const btnGhost =
  'px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-[#E5E5E5] border border-[#ffffff12] rounded-lg'

export default function AdminUserDetail() {
  const { id: userId } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<AdminUserDetailResponse | null>(null)
  const [moneyKind, setMoneyKind] = useState<'deposit' | 'deduct'>('deposit')
  const [moneyAmount, setMoneyAmount] = useState('')
  const [moneyCurrency, setMoneyCurrency] = useState('USD')
  const [moneyReason, setMoneyReason] = useState(DEPOSIT_REASONS[0]?.value || 'manual_bank_wire')
  const [moneyNote, setMoneyNote] = useState('')

  function load() {
    if (!userId) {
      setLoading(false)
      setData(null)
      return
    }
    setLoading(true)
    adminApi
      .getUser(userId)
      .then((r) => setData(r))
      .catch((e) => {
        toast.error((e as { error?: string }).error || 'Failed to load user')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [userId])

  const user = data?.user

  async function submitMoney() {
    if (!user) return
    const amount = Number(moneyAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a positive amount')
      return
    }
    setBusy(true)
    try {
      if (moneyKind === 'deposit') {
        await adminApi.deposit(user.id, {
          currency: moneyCurrency,
          amount,
          reason: moneyReason,
          note: moneyNote || undefined,
          notify: true,
          status: 'completed',
        })
        toast.success('Deposit completed')
      } else {
        await adminApi.deduct(user.id, {
          currency: moneyCurrency,
          amount,
          reason: moneyReason,
          note: moneyNote || undefined,
          notify: true,
          status: 'completed',
        })
        toast.success('Deduct completed')
      }
      setMoneyAmount('')
      setMoneyNote('')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout
      title="Manage user"
      subtitle={user ? user.email : 'Per-account controls'}
      actions={
        <>
          <Link to="/admin/users" className={`${btnGhost} inline-flex items-center gap-1.5`}>
            <ArrowLeft className="w-3.5 h-3.5" /> Users
          </Link>
          <button type="button" onClick={load} className={btnGhost} title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </>
      }
    >
      {loading ? (
        <p className="text-[#737373]">Loading…</p>
      ) : !user ? (
        <div className="space-y-2">
          <p className="text-[#737373]">Could not load this user.</p>
          <button type="button" onClick={load} className={btnGhost}>
            Retry
          </button>
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
            <h2 className="text-lg font-medium text-[#E5E5E5]">{user.name || user.email}</h2>
            <p className="text-sm text-[#A0A0A0]">{user.email}</p>
            <p className="text-xs text-[#737373] mt-1">
              ID: {user.id}
              {user.investmentId ? ` · ${user.investmentId}` : ''}
              {' · '}Role: {user.role}
              {' · '}KYC: {user.kycStatus}
            </p>
          </section>

          <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-[#E5E5E5]">
              <Wallet className="w-4 h-4 text-[#0C8B44]" /> Wallet balances
            </h2>
            <ul className="space-y-1 text-sm">
              {(data?.walletBalances || []).length === 0 && (
                <li className="text-[#737373] text-xs">No balances</li>
              )}
              {(data?.walletBalances || []).map((w: AdminWalletBalance) => (
                <li key={w.id || w.currency} className="flex justify-between text-[#A0A0A0]">
                  <span>{w.currency}</span>
                  <span className="text-[#E5E5E5]">
                    {Number(w.available).toLocaleString()} avail / {Number(w.balance).toLocaleString()} total
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-[#E5E5E5]">
              <DollarSign className="w-4 h-4 text-[#0C8B44]" /> Deposit / deduct
            </h2>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setMoneyKind('deposit')
                  setMoneyReason(DEPOSIT_REASONS[0]?.value || 'manual_bank_wire')
                }}
                className={`px-3 py-1 text-xs rounded-lg ${
                  moneyKind === 'deposit' ? 'bg-[#0C8B44] text-white' : 'bg-[#1a1a1a] text-[#A0A0A0]'
                }`}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoneyKind('deduct')
                  setMoneyReason(DEDUCT_REASONS[0]?.value || 'fee')
                }}
                className={`px-3 py-1 text-xs rounded-lg ${
                  moneyKind === 'deduct' ? 'bg-[#f44336] text-white' : 'bg-[#1a1a1a] text-[#A0A0A0]'
                }`}
              >
                Deduct
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                value={moneyAmount}
                onChange={(e) => setMoneyAmount(e.target.value)}
                placeholder="Amount"
                type="number"
                className={inputCls}
              />
              <input
                value={moneyCurrency}
                onChange={(e) => setMoneyCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                className={inputCls}
              />
            </div>
            <select
              aria-label="Reason"
              value={moneyReason}
              onChange={(e) => setMoneyReason(e.target.value)}
              className={`${inputCls} mb-2`}
            >
              {(moneyKind === 'deposit' ? DEPOSIT_REASONS : DEDUCT_REASONS).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              value={moneyNote}
              onChange={(e) => setMoneyNote(e.target.value)}
              placeholder="Note (optional)"
              className={`${inputCls} mb-2`}
            />
            <button type="button" disabled={busy} onClick={submitMoney} className={btnPrimary}>
              {moneyKind === 'deposit' ? 'Deposit' : 'Deduct'}
            </button>
          </section>

          <div>
            <AdminWithdrawalConfig userId={user.id} userEmail={user.email} onChange={load} />
            <p className="mt-3 text-xs text-[#737373]">
              Incoming deposit destinations (wire/ACH/crypto):{' '}
              <Link
                to={`/admin/deposit-addresses?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email)}`}
                className="text-[#0C8B44] hover:underline"
              >
                Edit deposit addresses →
              </Link>
              {' · '}Withdrawal fee rate:{' '}
              <Link to="/admin/settings" className="text-[#0C8B44] hover:underline">
                Platform settings →
              </Link>
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
