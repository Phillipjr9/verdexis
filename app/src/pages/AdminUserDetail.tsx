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
  type AdminUserSession,
  HOLD_REASONS,
  HOLD_TYPES,
  KYC_STATUSES,
  DEPOSIT_REASONS,
  DEDUCT_REASONS,
  FEE_TYPES,
  EMAIL_TEMPLATES,
  HOLDING_REASONS,
} from '../lib/adminApi'
import { feeProofs, type FeeProof } from '../lib/feeProofs'
import { setToken } from '../lib/api'
import {
  ArrowLeft,
  Ban,
  Lock,
  LockOpen,
  ShieldCheck,
  Wallet,
  RefreshCw,
  UserCheck,
  KeyRound,
  Mail,
  DollarSign,
  Layers,
} from 'lucide-react'

const inputCls =
  'w-full px-2.5 py-1.5 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]'
const btnPrimary =
  'px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50'
const btnGhost =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#ffffff12] text-[#E5E5E5] hover:border-[#0C8B44]/40 disabled:opacity-50'

export default function AdminUserDetail() {
  // App route is /admin/users/:id — accept either param name for safety
  const params = useParams<{ id?: string; userId?: string }>()
  const userId = params.id || params.userId

  const [data, setData] = useState<AdminUserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [proofs, setProofs] = useState<FeeProof[]>([])
  const [sessions, setSessions] = useState<AdminUserSession[]>([])

  const [wCurrency, setWCurrency] = useState('USD')
  const [wBalance, setWBalance] = useState('')
  const [wAvailable, setWAvailable] = useState('')

  const [holdType, setHoldType] = useState<'all' | 'withdraw' | 'transfer'>('all')
  const [holdReason, setHoldReason] = useState('suspicious_activity')
  const [holdNote, setHoldNote] = useState('')

  const [moneyKind, setMoneyKind] = useState<'deposit' | 'deduct'>('deposit')
  const [moneyCurrency, setMoneyCurrency] = useState('USD')
  const [moneyAmount, setMoneyAmount] = useState('')
  const [moneyReason, setMoneyReason] = useState('manual_bank_wire')
  const [moneyNote, setMoneyNote] = useState('')

  const [dailyWithdraw, setDailyWithdraw] = useState('')
  const [monthlyWithdraw, setMonthlyWithdraw] = useState('')
  const [dailyTransfer, setDailyTransfer] = useState('')
  const [monthlyTransfer, setMonthlyTransfer] = useState('')

  const [feeAmount, setFeeAmount] = useState('')
  const [feeType, setFeeType] = useState('admin_fee')
  const [feeNote, setFeeNote] = useState('')

  const [hSymbol, setHSymbol] = useState('BTC')
  const [hName, setHName] = useState('Bitcoin')
  const [hSide, setHSide] = useState<'buy' | 'sell'>('buy')
  const [hAmount, setHAmount] = useState('')
  const [hPrice, setHPrice] = useState('')

  const [newPassword, setNewPassword] = useState('')

  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailTemplate, setEmailTemplate] = useState('none')

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
        setDailyWithdraw(r.user.dailyWithdrawLimit != null ? String(r.user.dailyWithdrawLimit) : '')
        setMonthlyWithdraw(r.user.monthlyWithdrawLimit != null ? String(r.user.monthlyWithdrawLimit) : '')
        setDailyTransfer(r.user.dailyTransferLimit != null ? String(r.user.dailyTransferLimit) : '')
        setMonthlyTransfer(r.user.monthlyTransferLimit != null ? String(r.user.monthlyTransferLimit) : '')
      })
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load user'))
      .finally(() => setLoading(false))

    adminApi
      .getUserSessions(userId)
      .then((r) => setSessions(r.sessions || []))
      .catch(() => setSessions([]))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!userId && !data?.user.email) return
    feeProofs
      .fetchAll()
      .then((list) =>
        setProofs(
          list.filter(
            (p) =>
              p.userId === userId ||
              (data?.user.email && p.userEmail?.toLowerCase() === data.user.email.toLowerCase()),
          ),
        ),
      )
      .catch(() => {})
  }, [data?.user.email, userId])

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0f11] text-[#E5E5E5] p-8">
        <p>Missing user id</p>
        <Link to="/admin/users" className="text-[#0C8B44] underline text-sm">
          ← Back
        </Link>
      </div>
    )
  }

  const user = data?.user

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleSuspend() {
    if (!user) return
    await run(
      () =>
        adminApi.patchUser(user.id, {
          suspended: !user.suspended,
          suspendedReason: !user.suspended ? 'Admin suspension' : null,
        }),
      user.suspended ? 'User unsuspended' : 'User suspended',
    )
  }

  async function placeHold() {
    if (!user) return
    await run(
      () =>
        adminApi.placeHold(user.id, {
          holdType,
          reason: holdReason,
          note: holdNote || undefined,
          notify: true,
        }),
      'Hold placed',
    )
  }

  async function releaseHold() {
    if (!user) return
    await run(() => adminApi.releaseHold(user.id), 'Hold released')
  }

  async function setKyc(status: 'none' | 'pending' | 'approved' | 'rejected') {
    if (!user) return
    await run(() => adminApi.setKyc(user.id, { status, notify: true }), `KYC set to ${status}`)
  }

  async function saveWallet() {
    if (!user) return
    const balance = parseFloat(wBalance)
    const available = parseFloat(wAvailable)
    if (!isFinite(balance) || !isFinite(available)) {
      toast.error('Invalid numbers')
      return
    }
    await run(
      () =>
        adminApi.setWallet(user.id, {
          currency: wCurrency,
          symbol: wCurrency,
          balance,
          available,
        }),
      'Wallet updated',
    )
  }

  async function submitMoney() {
    if (!user) return
    const amount = parseFloat(moneyAmount)
    if (!isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive amount')
      return
    }
    if (moneyKind === 'deposit') {
      await run(
        () =>
          adminApi.deposit(user.id, {
            currency: moneyCurrency,
            amount,
            reason: moneyReason,
            note: moneyNote || undefined,
            status: 'completed',
            notify: true,
          }),
        `Deposited ${amount} ${moneyCurrency}`,
      )
    } else {
      await run(
        () =>
          adminApi.deduct(user.id, {
            currency: moneyCurrency,
            amount,
            reason: moneyReason,
            note: moneyNote || undefined,
            status: 'completed',
            notify: true,
          }),
        `Deducted ${amount} ${moneyCurrency}`,
      )
    }
    setMoneyAmount('')
  }

  async function saveLimits() {
    if (!user) return
    const parseOpt = (v: string) => {
      if (v.trim() === '') return null
      const n = parseFloat(v)
      return isFinite(n) ? n : null
    }
    await run(
      () =>
        adminApi.setLimits(user.id, {
          dailyWithdrawLimit: parseOpt(dailyWithdraw),
          monthlyWithdrawLimit: parseOpt(monthlyWithdraw),
          dailyTransferLimit: parseOpt(dailyTransfer),
          monthlyTransferLimit: parseOpt(monthlyTransfer),
        }),
      'Limits updated',
    )
  }

  async function chargeFee() {
    if (!user) return
    const amount = parseFloat(feeAmount)
    if (!isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive fee amount')
      return
    }
    await run(
      () =>
        adminApi.chargeFee(user.id, {
          currency: 'USD',
          amount,
          feeType,
          note: feeNote || undefined,
          notify: true,
        }),
      `Charged fee $${amount}`,
    )
    setFeeAmount('')
  }

  async function adjustHolding() {
    if (!user) return
    const amount = parseFloat(hAmount)
    const price = parseFloat(hPrice)
    if (!isFinite(amount) || amount <= 0 || !isFinite(price) || price < 0) {
      toast.error('Invalid amount or price')
      return
    }
    await run(
      () =>
        adminApi.adjustHolding(user.id, {
          symbol: hSymbol.toUpperCase(),
          name: hName || hSymbol,
          type: 'crypto',
          side: hSide,
          amount,
          price,
          reason: HOLDING_REASONS[0]?.value || 'admin_correction',
          notify: true,
        }),
      `Holding ${hSide}: ${amount} ${hSymbol}`,
    )
  }

  async function reverseTx(id: string) {
    if (!window.confirm('Reverse this transaction? Balance will be adjusted.')) return
    await run(() => adminApi.reverseTransaction(id, { notify: true }), 'Transaction reversed')
  }

  async function setPassword() {
    if (!user) return
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    await run(() => adminApi.setPassword(user.id, newPassword, true), 'Password set; sessions revoked')
    setNewPassword('')
  }

  async function revokeAllSessions() {
    if (!user) return
    if (!window.confirm('Revoke all sessions for this user?')) return
    await run(() => adminApi.revokeSessions(user.id), 'All sessions revoked')
  }

  async function revokeOneSession(sessionId: string) {
    setBusy(true)
    try {
      await adminApi.revokeSession(sessionId)
      toast.success('Session revoked')
      load()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function impersonate() {
    if (!user) return
    if (!window.confirm(`Impersonate ${user.email}? You will be signed in as this user.`)) return
    setBusy(true)
    try {
      const r = await adminApi.impersonate(user.id)
      setToken(r.token)
      toast.success(`Impersonating ${r.user.email}`)
      window.location.href = '/dashboard'
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Impersonate failed')
    } finally {
      setBusy(false)
    }
  }

  async function sendEmail() {
    if (!user) return
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Subject and body required')
      return
    }
    await run(
      () =>
        adminApi.emailUser(user.id, {
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          template: emailTemplate !== 'none' ? emailTemplate : undefined,
        }),
      'Email sent',
    )
  }

  function applyEmailTemplate(value: string) {
    setEmailTemplate(value)
    const t = EMAIL_TEMPLATES.find((x) => x.value === value)
    if (t && value !== 'none' && value !== 'custom') {
      setEmailSubject(t.subject)
      setEmailBody(t.body)
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
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4"
        >
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
                {user.investmentId && (
                  <p className="text-[11px] text-[#0C8B44] mt-1">Investment ID: {user.investmentId}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={impersonate} className={btnGhost}>
                  <UserCheck className="w-3.5 h-3.5" /> Impersonate
                </button>
                <button type="button" onClick={load} className={btnGhost}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                  user.role === 'admin' ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'bg-[#1a1a1a] text-[#737373]'
                }`}
              >
                {user.role}
              </span>
              {user.suspended ? (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#f44336]/15 text-[#f44336]">
                  Suspended
                </span>
              ) : (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#4CAF50]/15 text-[#4CAF50]">
                  Active
                </span>
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

            <div className="flex flex-wrap gap-2 mb-8">
              <button type="button" disabled={busy} onClick={toggleSuspend} className={btnGhost}>
                <Ban className="w-3.5 h-3.5" /> {user.suspended ? 'Unsuspend' : 'Suspend'}
              </button>
              {user.holdActive ? (
                <button type="button" disabled={busy} onClick={releaseHold} className={btnGhost}>
                  <LockOpen className="w-3.5 h-3.5" /> Release hold
                </button>
              ) : null}
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

            {!user.holdActive && (
              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5 mb-6">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#F57C00]" /> Place hold
                </h2>
                <div className="grid sm:grid-cols-3 gap-2 mb-2">
                  <select
                    aria-label="Hold type"
                    value={holdType}
                    onChange={(e) => setHoldType(e.target.value as typeof holdType)}
                    className={inputCls}
                  >
                    {HOLD_TYPES.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Hold reason"
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    className={inputCls}
                  >
                    {HOLD_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={holdNote}
                    onChange={(e) => setHoldNote(e.target.value)}
                    placeholder="Optional note"
                    className={inputCls}
                  />
                </div>
                <button type="button" disabled={busy} onClick={placeHold} className={btnPrimary}>
                  Place hold
                </button>
              </section>
            )}

            <div className="grid md:grid-cols-2 gap-6 mb-6">
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
                  <input value={wCurrency} onChange={(e) => setWCurrency(e.target.value.toUpperCase())} placeholder="USD" className={inputCls} />
                  <input value={wBalance} onChange={(e) => setWBalance(e.target.value)} placeholder="Balance" className={inputCls} />
                  <input value={wAvailable} onChange={(e) => setWAvailable(e.target.value)} placeholder="Available" className={inputCls} />
                </div>
                <button type="button" disabled={busy} onClick={saveWallet} className={`mt-2 ${btnPrimary}`}>
                  Save wallet
                </button>
              </section>

              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
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
                      setMoneyReason(DEDUCT_REASONS[0]?.value || 'manual_bank_wire')
                    }}
                    className={`px-3 py-1 text-xs rounded-lg ${
                      moneyKind === 'deduct' ? 'bg-[#f44336] text-white' : 'bg-[#1a1a1a] text-[#A0A0A0]'
                    }`}
                  >
                    Deduct
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={moneyCurrency} onChange={(e) => setMoneyCurrency(e.target.value.toUpperCase())} placeholder="Currency" className={inputCls} />
                  <input value={moneyAmount} onChange={(e) => setMoneyAmount(e.target.value)} placeholder="Amount" type="number" min="0" step="0.01" className={inputCls} />
                </div>
                <select aria-label="Reason" value={moneyReason} onChange={(e) => setMoneyReason(e.target.value)} className={`${inputCls} mb-2`}>
                  {(moneyKind === 'deposit' ? DEPOSIT_REASONS : DEDUCT_REASONS).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <input value={moneyNote} onChange={(e) => setMoneyNote(e.target.value)} placeholder="Note (optional)" className={`${inputCls} mb-2`} />
                <button type="button" disabled={busy} onClick={submitMoney} className={btnPrimary}>
                  {moneyKind === 'deposit' ? 'Credit deposit' : 'Apply deduct'}
                </button>
              </section>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Withdraw / transfer limits</h2>
                <p className="text-[11px] text-[#737373] mb-2">Leave blank for no limit.</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={dailyWithdraw} onChange={(e) => setDailyWithdraw(e.target.value)} placeholder="Daily withdraw" className={inputCls} />
                  <input value={monthlyWithdraw} onChange={(e) => setMonthlyWithdraw(e.target.value)} placeholder="Monthly withdraw" className={inputCls} />
                  <input value={dailyTransfer} onChange={(e) => setDailyTransfer(e.target.value)} placeholder="Daily transfer" className={inputCls} />
                  <input value={monthlyTransfer} onChange={(e) => setMonthlyTransfer(e.target.value)} placeholder="Monthly transfer" className={inputCls} />
                </div>
                <button type="button" disabled={busy} onClick={saveLimits} className={btnPrimary}>
                  Save limits
                </button>
              </section>

              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Charge fee (USD)</h2>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="Amount" type="number" min="0" step="0.01" className={inputCls} />
                  <select aria-label="Fee type" value={feeType} onChange={(e) => setFeeType(e.target.value)} className={inputCls}>
                    {FEE_TYPES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input value={feeNote} onChange={(e) => setFeeNote(e.target.value)} placeholder="Note" className={`${inputCls} mb-2`} />
                <button type="button" disabled={busy} onClick={chargeFee} className={btnPrimary}>
                  Charge fee
                </button>
              </section>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0C8B44]" /> Holdings
                </h2>
                <ul className="space-y-2 text-sm max-h-40 overflow-y-auto mb-4">
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
                <p className="text-[11px] text-[#737373] mb-2">Adjust holding</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={hSymbol} onChange={(e) => setHSymbol(e.target.value.toUpperCase())} placeholder="Symbol" className={inputCls} />
                  <input value={hName} onChange={(e) => setHName(e.target.value)} placeholder="Name" className={inputCls} />
                  <select aria-label="Side" value={hSide} onChange={(e) => setHSide(e.target.value as 'buy' | 'sell')} className={inputCls}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                  <input value={hAmount} onChange={(e) => setHAmount(e.target.value)} placeholder="Qty" type="number" className={inputCls} />
                  <input value={hPrice} onChange={(e) => setHPrice(e.target.value)} placeholder="Price" type="number" className={inputCls} />
                </div>
                <button type="button" disabled={busy} onClick={adjustHolding} className={btnPrimary}>
                  Apply holding adjust
                </button>
              </section>

              <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0C8B44]" /> Security
                </h2>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+)" className={inputCls} />
                  <button type="button" disabled={busy} onClick={setPassword} className={btnPrimary}>
                    Set password
                  </button>
                </div>
                <button type="button" disabled={busy} onClick={revokeAllSessions} className={`${btnGhost} mb-4`}>
                  Revoke all sessions
                </button>
                <p className="text-[11px] text-[#737373] mb-2">Active sessions ({sessions.length})</p>
                <ul className="space-y-2 max-h-36 overflow-y-auto text-xs">
                  {sessions.length === 0 && <li className="text-[#737373]">None loaded</li>}
                  {sessions.map((s) => (
                    <li key={s.sessionId} className="flex justify-between items-center gap-2 border border-[#ffffff08] rounded px-2 py-1.5">
                      <span className="text-[#A0A0A0] truncate">
                        {s.ipAddress || '—'} · {s.otpVerified ? 'OTP' : 'no OTP'}
                      </span>
                      <button type="button" disabled={busy} onClick={() => revokeOneSession(s.sessionId)} className="text-[#f44336] text-[10px]">
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5 mb-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0C8B44]" /> Email user
              </h2>
              <select aria-label="Email template" value={emailTemplate} onChange={(e) => applyEmailTemplate(e.target.value)} className={`${inputCls} mb-2`}>
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject" className={`${inputCls} mb-2`} />
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Body" rows={4} className={`${inputCls} mb-2`} />
              <button type="button" disabled={busy} onClick={sendEmail} className={btnPrimary}>
                Send email
              </button>
            </section>

            <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5 mb-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Recent transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[#737373] text-left">
                    <tr>
                      <th className="py-2 font-normal">Kind</th>
                      <th className="py-2 font-normal">Amount</th>
                      <th className="py-2 font-normal">Status</th>
                      <th className="py-2 font-normal">Date</th>
                      <th className="py-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {(data.transactions || []).slice(0, 25).map((t: AdminTransaction) => (
                      <tr key={t.id} className="border-t border-[#ffffff05] text-[#A0A0A0]">
                        <td className="py-2">{t.kind}</td>
                        <td className="py-2 text-[#E5E5E5]">
                          {t.amount} {t.currency}
                        </td>
                        <td className="py-2">{t.status}</td>
                        <td className="py-2">{new Date(t.createdAt).toLocaleString()}</td>
                        <td className="py-2 text-right">
                          {t.status === 'completed' && !t.reversedFromId && (
                            <button type="button" disabled={busy} onClick={() => reverseTx(t.id)} className="text-[10px] text-[#F57C00] hover:underline">
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(data.transactions || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-[#737373]">
                          No transactions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-5">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0C8B44]" /> Fee proofs
              </h2>
              <ul className="space-y-3">
                {proofs.length === 0 && <li className="text-xs text-[#737373]">No fee proofs for this user</li>}
                {proofs.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border border-[#ffffff08] rounded-lg px-3 py-2">
                    <div>
                      <span className="text-[#E5E5E5]">
                        {p.kind || 'fee'} · ${p.feeUsd}
                      </span>
                      <span className="text-[#737373] ml-2">{p.status}</span>
                      {p.feeProof && <p className="text-[#737373] mt-0.5 truncate max-w-md">{p.feeProof}</p>}
                    </div>
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => verifyProof(p.id)} className="px-2 py-1 rounded bg-[#0C8B44] text-white disabled:opacity-50">
                          Verify
                        </button>
                        <button type="button" disabled={busy} onClick={() => rejectProof(p.id)} className="px-2 py-1 rounded bg-[#f44336]/20 text-[#f44336] disabled:opacity-50">
                          Reject
                        </button>
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
