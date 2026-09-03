import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { getToken } from '../lib/api'
import { ArrowLeft, Mail, Send, Users, DollarSign } from 'lucide-react'

type InviteResult = {
  email: string
  status: 'created' | 'credited' | 'skipped' | 'failed'
  userId?: string
  amount?: number
  emailSent?: boolean
  error?: string
}

type InviteResponse = {
  ok: boolean
  summary: {
    total: number
    created: number
    credited: number
    skipped: number
    failed: number
    emailsSent: number
    amountPerInvite: number
    currency: string
  }
  results: InviteResult[]
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function AdminInvites() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [singleEmail, setSingleEmail] = useState('')
  const [bulkEmails, setBulkEmails] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [creditExisting, setCreditExisting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<InviteResponse | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount greater than 0')
      return
    }
    const emails = mode === 'single' ? singleEmail.trim() : bulkEmails.trim()
    if (!emails) {
      toast.error(mode === 'single' ? 'Enter an email' : 'Paste at least one email')
      return
    }

    setBusy(true)
    setLast(null)
    try {
      const token = getToken()
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          emails,
          amount: amt,
          currency: 'USD',
          note: note.trim() || undefined,
          creditExisting,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as InviteResponse & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      setLast(data)
      const s = data.summary
      toast.success(
        `Done: ${s.created} created, ${s.credited} credited, ${s.emailsSent} emails sent` +
          (s.failed ? `, ${s.failed} failed` : ''),
      )
      if (mode === 'single') setSingleEmail('')
      else setBulkEmails('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[900px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to admin
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-light text-[#E5E5E5] flex items-center gap-3">
            <Mail className="w-6 h-6 text-[#0C8B44]" /> Email invites
          </h1>
          <p className="text-xs text-[#737373] mt-1">
            Invite one or many people by email. Each invite credits the amount to their wallet and
            includes that balance in the email.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-4 py-2 text-sm rounded-lg border ${
              mode === 'single'
                ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]'
                : 'border-[#ffffff15] text-[#A0A0A0]'
            }`}
          >
            Single email
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`px-4 py-2 text-sm rounded-lg border ${
              mode === 'bulk'
                ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]'
                : 'border-[#ffffff15] text-[#A0A0A0]'
            }`}
          >
            Bulk emails
          </button>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/50 p-6 space-y-5">
          {mode === 'single' ? (
            <div>
              <label className="text-xs uppercase tracking-wider text-[#737373]">Email</label>
              <input
                type="email"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
                placeholder="investor@example.com"
                className="mt-1.5 w-full rounded-lg bg-[#070C0E] border border-[#ffffff15] px-3 py-2.5 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44]/50"
                required
              />
            </div>
          ) : (
            <div>
              <label className="text-xs uppercase tracking-wider text-[#737373] flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Emails (one per line, or comma-separated)
              </label>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                rows={8}
                placeholder={'alice@example.com\nbob@example.com\ncarol@example.com'}
                className="mt-1.5 w-full rounded-lg bg-[#070C0E] border border-[#ffffff15] px-3 py-2.5 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44]/50 font-mono"
                required
              />
              <p className="text-[11px] text-[#737373] mt-1">Max 200 addresses per batch.</p>
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wider text-[#737373] flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" /> Amount (USD) — credited to each wallet
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000.00"
              className="mt-1.5 w-full rounded-lg bg-[#070C0E] border border-[#ffffff15] px-3 py-2.5 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44]/50"
              required
            />
            {Number(amount) > 0 && (
              <p className="text-xs text-[#0C8B44] mt-1">
                Each invitee receives {money(Number(amount))} in their balance and in the email.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-[#737373]">Optional note (shown in email)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Welcome bonus for Q1 partners"
              maxLength={1000}
              className="mt-1.5 w-full rounded-lg bg-[#070C0E] border border-[#ffffff15] px-3 py-2.5 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44]/50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#A0A0A0] cursor-pointer">
            <input
              type="checkbox"
              checked={creditExisting}
              onChange={(e) => setCreditExisting(e.target.checked)}
              className="rounded border-[#ffffff30]"
            />
            Also credit users who already have an account
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0C8B44] text-white text-sm font-medium disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {busy ? 'Sending…' : mode === 'single' ? 'Send invite' : 'Send bulk invites'}
          </button>
        </form>

        {last && (
          <div className="mt-8 rounded-2xl border border-[#ffffff10] bg-[#0f1619]/50 p-6">
            <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
              <Stat label="Total" value={String(last.summary.total)} />
              <Stat label="Created" value={String(last.summary.created)} />
              <Stat label="Credited (existing)" value={String(last.summary.credited)} />
              <Stat label="Emails sent" value={String(last.summary.emailsSent)} />
              <Stat label="Skipped" value={String(last.summary.skipped)} />
              <Stat label="Failed" value={String(last.summary.failed)} />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {last.results.map((r) => (
                <div
                  key={r.email}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#070C0E]/80 text-xs"
                >
                  <span className="text-[#E5E5E5] truncate">{r.email}</span>
                  <span
                    className={
                      r.status === 'failed'
                        ? 'text-[#f44336]'
                        : r.status === 'skipped'
                          ? 'text-[#FF9800]'
                          : 'text-[#0C8B44]'
                    }
                  >
                    {r.status}
                    {r.emailSent ? ' · mailed' : ''}
                    {r.error ? ` — ${r.error}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#ffffff08] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[#737373]">{label}</p>
      <p className="text-lg text-[#E5E5E5] font-light">{value}</p>
    </div>
  )
}
