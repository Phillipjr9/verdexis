import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, TRANSFER_REASONS, type AdminUserSummary } from '../lib/adminApi'
import { api } from '../lib/api'
import { userFromMe } from '../lib/authMe'
import { ArrowLeft, ArrowRightLeft, Search, Lock } from 'lucide-react'

export default function AdminTransfer() {
  const [from, setFrom] = useState<AdminUserSummary | null>(null)
  const [to, setTo] = useState<AdminUserSummary | null>(null)
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('manual_correction')
  const [note, setNote] = useState('')
  const [allowNegative, setAllowNegative] = useState(false)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fromError, setFromError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.me()
      .then((r) => {
        if (cancelled) return
        const u = userFromMe(r)
        if (!u) {
          setFromError('Could not load your admin profile. Please re-login.')
          return
        }
        setFrom({
          id: u.id,
          email: u.email,
          name: u.name || u.email,
          role: (u.role as AdminUserSummary['role']) || 'admin',
          suspended: !!u.suspended,
          createdAt: new Date().toISOString(),
        } as AdminUserSummary)
      })
      .catch((err: any) => {
        if (cancelled) return
        const status = err && typeof err.status === 'number' ? err.status : undefined
        if (status === 401) {
          setFromError('Could not load your admin profile. Please re-login.')
          toast.error('Could not load admin profile — please re-login')
          return
        }
        setFromError('Network error while loading your profile. Try again shortly.')
        toast.error('Network temporarily unavailable — please try again')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!busy) {
      setProgress(0)
      return
    }
    setProgress(12)
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 92) return value
        const step = value < 36 ? 14 : value < 72 ? 8 : 6
        return Math.min(92, value + step)
      })
    }, 700)
    return () => window.clearInterval(timer)
  }, [busy])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!from || !to || from.id === to.id) { toast.error('Choose two distinct users'); return }
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) { toast.error('Amount must be > 0'); return }
    setBusy(true)
    try {
      await adminApi.adminTransfer({
        fromUserId: from.id, toUserId: to.id, currency: currency.toUpperCase(),
        amount: amt, reason, note: note || undefined, allowNegative, notify,
      })
      toast.success(`Transferred ${amt} ${currency.toUpperCase()} from ${from.email} → ${to.email}`)
      setAmount(''); setNote('')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Transfer failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[900px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5]">Fund Transfer</h1>
            <p className="text-xs text-[#737373]">Move funds between two user accounts. All actions are audited.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="From (operator — locked)">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0a0f11] border border-[#0C8B44]/40 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm text-[#E5E5E5] truncate">{from?.name || (fromError ? 'Unavailable' : 'Loading…')}</p>
                  <p className={`text-[11px] truncate ${fromError ? 'text-[#f44336]' : 'text-[#737373]'}`}>{fromError || from?.email || ''}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#0C8B44] uppercase tracking-wider"><Lock className="w-3 h-3" /> Locked</span>
              </div>
            </Field>
            <UserPicker label="To user" value={to} onChange={setTo} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" /></Field>
            <Field label="Amount"><input type="number" step="0.0001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" /></Field>
            <Field label="Reason">
              <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]">
                {TRANSFER_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Note (optional, included in both audit log entries)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" /></Field>
          <div className="flex flex-wrap gap-4 text-xs text-[#A0A0A0]">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} className="accent-[#0C8B44]" />Allow negative balance on source</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#0C8B44]" />Notify both users</label>
          </div>
          {busy && (
            <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-3">
              <div className="flex items-center justify-between text-[11px] text-[#FDE68A]">
                <span>Transfer is being processed</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-[#FBBF24] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <button type="submit" disabled={busy || !from || !to || !amount} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
            <ArrowRightLeft className="w-4 h-4" />{busy ? 'Transferring…' : 'Transfer funds'}
          </button>
        </form>
      </div>
    </div>
  )
}

function UserPicker({ label, value, onChange }: { label: string; value: AdminUserSummary | null; onChange: (u: AdminUserSummary | null) => void }) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<AdminUserSummary[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const display = useMemo(() => value ? `${value.name} <${value.email}>` : '', [value])

  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (value) return
    if (!q || q.trim().length < 1) {
      setOptions([])
      setSearchError(null)
      return
    }
    const t = setTimeout(() => {
      setSearching(true)
      setSearchError(null)
      adminApi.listUsers({ q: q.trim(), page: 1, limit: 20, role: 'all' })
        .then((r) => {
          const users = (r.users || []).filter((u) => u.role !== 'admin' || true)
          setOptions(users)
          setOpen(true)
          if (!users.length) setSearchError('No users matched that search')
        })
        .catch((err: any) => {
          setOptions([])
          const msg = err?.error || err?.message || 'Failed to search users'
          setSearchError(String(msg))
          toast.error(`User search failed: ${msg}`)
        })
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q, value])

  // Close dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (value) {
    return (
      <Field label={label}>
        <div className="flex items-center justify-between px-3 py-2 bg-[#0a0f11] border border-[#0C8B44]/40 rounded-lg">
          <div className="min-w-0">
            <p className="text-sm text-[#E5E5E5] truncate">{value.name}</p>
            <p className="text-[11px] text-[#737373] truncate">{value.email}</p>
          </div>
          <button type="button" onClick={() => { onChange(null); setQ('') }} className="text-[11px] text-[#A0A0A0] hover:text-[#f44336]">Change</button>
        </div>
      </Field>
    )
  }

  return (
    <Field label={label}>
      <div className="relative" ref={wrapRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          placeholder="Search by name, email or ID…"
          className="w-full pl-9 pr-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
        />
        {open && options.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-[#0f1619] border border-[#ffffff10] shadow-xl">
            {options.map((u) => (
              <button
                type="button"
                key={u.id}
                // mousedown fires before input blur — required so selection sticks
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(u)
                  setOpen(false)
                  setQ('')
                  setOptions([])
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#0C8B44]/10"
              >
                <p className="text-sm text-[#E5E5E5]">{u.name || 'User'}</p>
                <p className="text-[11px] text-[#737373]">{u.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      {searching && <p className="text-[10px] text-[#737373] mt-1">Searching…</p>}
      {searchError && <p className="text-[10px] text-[#f44336] mt-1">{searchError}</p>}
      <p className="text-[10px] text-[#737373] mt-1">Type name, email, or user ID to search. Currently selected: {display || 'none'}</p>
    </Field>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}
