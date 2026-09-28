import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi } from '../lib/adminApi'
import {
  ArrowLeft,
  Mail,
  Send,
  Users,
  User,
  DollarSign,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react'

type TabMode = 'single' | 'bulk' | 'preview' | 'history'

type InviteResult = {
  email: string
  name?: string
  status: 'created' | 'credited' | 'skipped' | 'failed'
  userId?: string
  amount?: number
  currency?: string
  emailSent?: boolean
  plainPassword?: string
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

type HistoryItem = {
  id: string
  action: string
  createdAt: string
  actor: { id: string; email: string; name: string }
  targetUser?: { id: string; email: string; name: string } | null
  details: Record<string, unknown>
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'USDT', 'BTC', 'ETH', 'SOL']

// Mirrors server-side caps in server/src/routes/admin-invites.ts (inviteSchema).
// Enforced client-side so a "Too long" value can never reach the server and
// come back as an opaque "Invalid input" 400.
const FIELD_LIMITS = {
  subject: 200,
  message: 2000,
  note: 1000,
  maxAmount: 1_000_000_000,
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Matches an email embedded inside a larger token, e.g. `Jane Doe <jane@x.com>,`
const LOOSE_EMAIL_RE = /[^\s@<>()[\]"',;]+@[^\s@<>()[\]"',;]+\.[^\s@<>()[\]"',;]+/

function parseEmailsCount(text: string): string[] {
  const unique = new Set<string>()
  for (const line of text.split(/[\r\n]+/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const token of trimmed.split(/[,;\s]+/)) {
      const m = token.match(LOOSE_EMAIL_RE)
      const candidate = (m?.[0] ?? '').toLowerCase()
      if (candidate && EMAIL_RE.test(candidate)) {
        unique.add(candidate)
      }
    }
  }
  return Array.from(unique)
}

/** Prefer the server's field-level validation message over a generic failure string. */
function formatApiError(err: unknown, fallback: string): string {
  const e = err as { error?: string; message?: string; details?: { fieldErrors?: Record<string, string[]> } }
  const fieldErrors = e?.details?.fieldErrors
  if (fieldErrors) {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && messages.length) return `${field}: ${messages[0]}`
    }
  }
  return e?.error || e?.message || fallback
}

function formatMoney(n: number, currency = 'USD') {
  if (currency === 'USD') {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }
  return `${n.toLocaleString('en-US')} ${currency}`
}

export default function AdminInvites() {
  const [tab, setTab] = useState<TabMode>('single')

  // Single form state
  const [singleEmail, setSingleEmail] = useState('')
  const [singleName, setSingleName] = useState('')
  const [singleAmount, setSingleAmount] = useState('1000')
  const [singleCurrency, setSingleCurrency] = useState('USD')
  const [singleSubject, setSingleSubject] = useState('')
  const [singleMessage, setSingleMessage] = useState('')
  const [singleNote, setSingleNote] = useState('')

  // Bulk form state
  const [bulkEmails, setBulkEmails] = useState('')
  const [bulkAmount, setBulkAmount] = useState('1000')
  const [bulkCurrency, setBulkCurrency] = useState('USD')
  const [bulkSubject, setBulkSubject] = useState('')
  const [bulkMessage, setBulkMessage] = useState('')
  const [bulkNote, setBulkNote] = useState('')

  // Shared state
  const [creditExisting, setCreditExisting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<InviteResponse | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Filter & Search for results
  const [filterStatus, setFilterStatus] = useState<'all' | 'created' | 'credited' | 'failed'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Preview state
  const [previewData, setPreviewData] = useState<{ subject: string; html: string; autoMessage: string | null } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // Which compose form the preview reflects (opened from Single vs Bulk tab)
  const [previewSource, setPreviewSource] = useState<'single' | 'bulk'>('single')

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const detectedBulkEmails = parseEmailsCount(bulkEmails)

  // Load preview whenever preview tab is opened
  useEffect(() => {
    if (tab === 'preview') {
      loadPreview()
    } else if (tab === 'history') {
      loadHistory()
    }
  }, [tab])

  function openPreview(source?: 'single' | 'bulk') {
    setPreviewSource(source ?? (tab === 'bulk' ? 'bulk' : 'single'))
    setTab('preview')
  }

  async function loadPreview() {
    setPreviewLoading(true)
    try {
      const isSingle = previewSource === 'single'
      const amount = Number(isSingle ? singleAmount : bulkAmount) || 1000
      const currency = isSingle ? singleCurrency : bulkCurrency
      const subject = isSingle ? singleSubject : bulkSubject
      const customMessage = isSingle ? singleMessage : bulkMessage
      const note = isSingle ? singleNote : bulkNote
      const previewEmail = isSingle
        ? singleEmail.trim() || 'investor@example.com'
        : detectedBulkEmails[0] || 'investor@example.com'

      const res = await adminApi.previewInvite({
        emails: previewEmail,
        amount,
        currency,
        subject: subject.trim() || undefined,
        customMessage: customMessage.trim() || undefined,
        note: note.trim() || undefined,
      })
      setPreviewData({ subject: res.subject, html: res.html, autoMessage: res.autoMessage ?? null })
    } catch (err) {
      console.warn('Preview failed', err)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await adminApi.getInviteHistory()
      setHistory(res.history || [])
    } catch (err) {
      toast.error('Failed to load invite history')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Handle CSV / TXT file upload
  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = String(event.target?.result || '')
      if (content) {
        setBulkEmails((prev) => (prev.trim() ? `${prev}\n${content}` : content))
        toast.success(`Loaded file: ${file.name}`)
      }
    }
    reader.onerror = () => toast.error('Failed to read file')
    reader.readAsText(file)
    // reset input
    e.target.value = ''
  }

  async function handleSingleSubmit(e: FormEvent) {
    e.preventDefault()
    const email = singleEmail.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      toast.error('Enter a valid email address')
      return
    }

    const amt = Number(singleAmount)
    if (isNaN(amt) || amt < 0) {
      toast.error('Enter a valid amount (0 or higher)')
      return
    }
    if (amt > FIELD_LIMITS.maxAmount) {
      toast.error(`Credit amount cannot exceed ${FIELD_LIMITS.maxAmount.toLocaleString('en-US')}`)
      return
    }
    if (singleSubject.trim().length > FIELD_LIMITS.subject) {
      toast.error(`Subject line is limited to ${FIELD_LIMITS.subject} characters`)
      return
    }
    if (singleMessage.trim().length > FIELD_LIMITS.message) {
      toast.error(`Welcome message is limited to ${FIELD_LIMITS.message.toLocaleString('en-US')} characters`)
      return
    }
    if (singleNote.trim().length > FIELD_LIMITS.note) {
      toast.error(`Admin note is limited to ${FIELD_LIMITS.note.toLocaleString('en-US')} characters`)
      return
    }

    setBusy(true)
    setLast(null)
    try {
      const data = await adminApi.sendInvites({
        emails: [{ email, name: singleName.trim() || undefined, amount: amt }],
        amount: amt,
        currency: singleCurrency,
        subject: singleSubject.trim() || undefined,
        customMessage: singleMessage.trim() || undefined,
        note: singleNote.trim() || undefined,
        creditExisting,
      })
      setLast(data)
      const s = data.summary
      if (s.created > 0) {
        toast.success(`Account created and invitation sent to ${email}`)
      } else if (s.credited > 0) {
        toast.success(`Existing user credited and invitation emailed to ${email}`)
      } else if (s.failed > 0) {
        toast.error(`Invite failed: ${data.results[0]?.error || 'Unknown error'}`)
      } else {
        toast.info('User already exists or invite skipped')
      }
      setSingleEmail('')
      setSingleName('')
    } catch (err: any) {
      toast.error(formatApiError(err, 'Invitation failed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleBulkSubmit(e: FormEvent) {
    e.preventDefault()
    if (detectedBulkEmails.length === 0) {
      toast.error('Paste or upload at least one valid email address')
      return
    }

    if (detectedBulkEmails.length > 200) {
      toast.error('Maximum 200 emails per batch. Please split your list into smaller batches.')
      return
    }

    const amt = Number(bulkAmount)
    if (isNaN(amt) || amt < 0) {
      toast.error('Enter a valid credit amount per invitee')
      return
    }
    if (amt > FIELD_LIMITS.maxAmount) {
      toast.error(`Credit amount cannot exceed ${FIELD_LIMITS.maxAmount.toLocaleString('en-US')}`)
      return
    }
    if (bulkMessage.trim().length > FIELD_LIMITS.message) {
      toast.error(`Campaign message is limited to ${FIELD_LIMITS.message.toLocaleString('en-US')} characters`)
      return
    }
    if (bulkNote.trim().length > FIELD_LIMITS.note) {
      toast.error(`Campaign note is limited to ${FIELD_LIMITS.note.toLocaleString('en-US')} characters`)
      return
    }

    setBusy(true)
    setLast(null)
    try {
      const data = await adminApi.sendInvites({
        emails: bulkEmails,
        amount: amt,
        currency: bulkCurrency,
        subject: bulkSubject.trim() || undefined,
        customMessage: bulkMessage.trim() || undefined,
        note: bulkNote.trim() || undefined,
        creditExisting,
      })
      setLast(data)
      const s = data.summary
      toast.success(
        `Batch completed: ${s.created} created, ${s.credited} credited, ${s.emailsSent} emails sent` +
          (s.failed > 0 ? `, ${s.failed} failed` : ''),
      )
      setBulkEmails('')
    } catch (err: any) {
      toast.error(formatApiError(err, 'Bulk invitation failed'))
    } finally {
      setBusy(false)
    }
  }

  function copyPassword(pw: string, index: number) {
    navigator.clipboard.writeText(pw)
    setCopiedIndex(index)
    toast.success('Temporary password copied to clipboard')
    setTimeout(() => setCopiedIndex(null), 2500)
  }

  function exportResultsCsv() {
    if (!last || !last.results.length) return
    const headers = ['Email', 'Name', 'Status', 'Amount', 'Currency', 'Email Sent', 'Temp Password', 'Error']
    const rows = last.results.map((r) => [
      `"${r.email}"`,
      `"${r.name || ''}"`,
      `"${r.status}"`,
      `"${r.amount ?? ''}"`,
      `"${r.currency || last.summary.currency}"`,
      `"${r.emailSent ? 'Yes' : 'No'}"`,
      `"${r.plainPassword || ''}"`,
      `"${r.error || ''}"`,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `verdexis_invites_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredResults = last?.results.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return r.email.toLowerCase().includes(q) || (r.name && r.name.toLowerCase().includes(q))
    }
    return true
  }) || []

  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to admin dashboard
        </Link>

        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 border border-[#0C8B44]/30 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#00E676]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-light text-[#FFFFFF]">Email Invitations</h1>
            </div>
            <p className="text-xs md:text-sm text-[#737373] max-w-2xl">
              Invite individual investors or execute bulk onboarding campaigns. Accounts are auto-created, credited with an initial wallet balance, and emailed with instant sign-in credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openPreview()}
              className="px-3.5 py-2 rounded-xl bg-[#0f1619] border border-[#ffffff15] hover:border-[#0C8B44]/40 text-xs text-[#E5E5E5] flex items-center gap-2 transition-colors"
            >
              <Eye className="w-4 h-4 text-[#00E676]" /> Live Email Preview
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#ffffff10] mb-8 overflow-x-auto gap-2">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === 'single'
                ? 'border-[#0C8B44] text-[#00E676] bg-[#0C8B44]/10 rounded-t-lg'
                : 'border-transparent text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            <User className="w-4 h-4" /> Single Invite
          </button>
          <button
            type="button"
            onClick={() => setTab('bulk')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === 'bulk'
                ? 'border-[#0C8B44] text-[#00E676] bg-[#0C8B44]/10 rounded-t-lg'
                : 'border-transparent text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            <Users className="w-4 h-4" /> Bulk Invites
            {detectedBulkEmails.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[#0C8B44] text-white">
                {detectedBulkEmails.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openPreview()}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === 'preview'
                ? 'border-[#0C8B44] text-[#00E676] bg-[#0C8B44]/10 rounded-t-lg'
                : 'border-transparent text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            <Eye className="w-4 h-4" /> Email Preview
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === 'history'
                ? 'border-[#0C8B44] text-[#00E676] bg-[#0C8B44]/10 rounded-t-lg'
                : 'border-transparent text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            <Clock className="w-4 h-4" /> Invitation History
          </button>
        </div>

        {/* Tab 1: Single Invite */}
        {tab === 'single' && (
          <form onSubmit={handleSingleSubmit} className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/60 p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2">
                  Recipient Email Address <span className="text-[#00E676]">*</span>
                </label>
                <input
                  type="email"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  placeholder="investor@example.com"
                  className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-[#00E676]" /> Initial Wallet Credit Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={singleAmount}
                  onChange={(e) => setSingleAmount(e.target.value)}
                  placeholder="1000.00"
                  className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2">
                  Currency
                </label>
                <select
                  value={singleCurrency}
                  onChange={(e) => setSingleCurrency(e.target.value)}
                  className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {Number(singleAmount) > 0 && (
              <div className="rounded-xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 p-4 flex items-center gap-3 text-xs text-[#00E676]">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>
                  The recipient will receive an instant credit of <strong>{formatMoney(Number(singleAmount), singleCurrency)}</strong> in their wallet balance ready to use upon initial sign-in.
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0]">
                  Custom Subject Line (Optional)
                </label>
                <span className={`text-[10px] ${singleSubject.length >= FIELD_LIMITS.subject ? 'text-[#f44336]' : 'text-[#525252]'}`}>
                  {singleSubject.length}/{FIELD_LIMITS.subject}
                </span>
              </div>
              <input
                type="text"
                value={singleSubject}
                onChange={(e) => setSingleSubject(e.target.value)}
                maxLength={FIELD_LIMITS.subject}
                placeholder={`You're invited to Verdexis — ${formatMoney(Number(singleAmount) || 0, singleCurrency)} credited`}
                className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0]">
                  Personal Welcome Message (Included in Email)
                </label>
                <span className={`text-[10px] ${singleMessage.length >= FIELD_LIMITS.message ? 'text-[#f44336]' : 'text-[#525252]'}`}>
                  {singleMessage.length}/{FIELD_LIMITS.message.toLocaleString('en-US')}
                </span>
              </div>
              <textarea
                value={singleMessage}
                onChange={(e) => setSingleMessage(e.target.value)}
                rows={3}
                maxLength={FIELD_LIMITS.message}
                placeholder="Leave blank — a complete personalized welcome message is generated automatically…"
                className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
              />
              <p className="text-[11px] text-[#737373] mt-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#00E676] flex-shrink-0" />
                Optional. When left blank, each recipient automatically receives a complete message covering their invitation, credited balance, and sign-in steps.
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2">
                Internal Admin Note (Optional)
              </label>
              <input
                type="text"
                value={singleNote}
                onChange={(e) => setSingleNote(e.target.value)}
                maxLength={FIELD_LIMITS.note}
                placeholder="Q1 Executive onboarding batch"
                className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 text-sm text-[#A0A0A0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={creditExisting}
                  onChange={(e) => setCreditExisting(e.target.checked)}
                  className="rounded border-[#ffffff30] text-[#0C8B44] focus:ring-0 w-4 h-4 bg-[#070C0E]"
                />
                <span>Also credit users if they already have an existing account</span>
              </label>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-[#ffffff0a]">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#0C8B44] text-white text-sm font-medium hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0C8B44]/20"
              >
                {busy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending Invitation…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Invitation
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => openPreview('single')}
                className="px-5 py-3.5 rounded-xl bg-[#070C0E] border border-[#ffffff15] hover:border-[#ffffff30] text-sm text-[#E5E5E5] transition-colors"
              >
                Preview Email
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Bulk Invites */}
        {tab === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/60 p-6 md:p-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#00E676]" /> Email Addresses (One per line, comma, or CSV)
                </label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070C0E] border border-[#ffffff15] hover:border-[#0C8B44]/40 text-xs text-[#E5E5E5] cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#00E676]" /> Upload CSV / TXT
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                rows={9}
                placeholder={'alice@example.com\nbob@example.com, Robert Smith, 2500\ncarol@example.com\ndavid@example.com'}
                className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors font-mono"
                required
              />

              <div className="flex items-center justify-between text-xs text-[#737373] mt-2">
                <span>Supports plain list or CSV formats: <code className="text-[#A0A0A0]">email, Full Name, amount</code></span>
                <span className={`font-medium ${detectedBulkEmails.length > 200 ? 'text-[#f44336]' : 'text-[#00E676]'}`}>
                  {detectedBulkEmails.length} unique valid {detectedBulkEmails.length === 1 ? 'recipient' : 'recipients'} detected (max 200)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-[#00E676]" /> Default Credit Amount Per User
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  placeholder="1000.00"
                  className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2">
                  Currency
                </label>
                <select
                  value={bulkCurrency}
                  onChange={(e) => setBulkCurrency(e.target.value)}
                  className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-[#A0A0A0]">
                  Campaign / Welcome Message (Optional)
                </label>
                <span className={`text-[10px] ${bulkMessage.length >= FIELD_LIMITS.message ? 'text-[#f44336]' : 'text-[#525252]'}`}>
                  {bulkMessage.length}/{FIELD_LIMITS.message.toLocaleString('en-US')}
                </span>
              </div>
              <textarea
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                rows={2}
                maxLength={FIELD_LIMITS.message}
                placeholder="Leave blank — a complete personalized welcome message is generated automatically…"
                className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
              />
              <p className="text-[11px] text-[#737373] mt-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#00E676] flex-shrink-0" />
                Optional. When left blank, every recipient in the batch automatically receives a complete personalized welcome message.
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-[#A0A0A0] block mb-2">
                Campaign Note / Reference (Optional)
              </label>
              <input
                type="text"
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                maxLength={FIELD_LIMITS.note}
                placeholder="Institutional Partners Q1"
                className="w-full rounded-xl bg-[#070C0E] border border-[#ffffff15] px-4 py-3 text-sm text-[#E5E5E5] outline-none focus:border-[#0C8B44] transition-colors"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 text-sm text-[#A0A0A0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={creditExisting}
                  onChange={(e) => setCreditExisting(e.target.checked)}
                  className="rounded border-[#ffffff30] text-[#0C8B44] focus:ring-0 w-4 h-4 bg-[#070C0E]"
                />
                <span>Also credit users if they already have an existing account</span>
              </label>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-[#ffffff0a]">
              <button
                type="submit"
                disabled={busy || detectedBulkEmails.length === 0}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#0C8B44] text-white text-sm font-medium hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0C8B44]/20"
              >
                {busy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending {detectedBulkEmails.length} Invites…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Bulk Invites ({detectedBulkEmails.length})
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => openPreview('bulk')}
                className="px-5 py-3.5 rounded-xl bg-[#070C0E] border border-[#ffffff15] hover:border-[#ffffff30] text-sm text-[#E5E5E5] transition-colors"
              >
                Preview Email
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Live Preview */}
        {tab === 'preview' && (
          <div className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/60 p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#00E676]" /> Email Live Template Preview
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  This preview renders exactly what your invited clients will see in their inboxes.
                </p>
              </div>

              <button
                onClick={loadPreview}
                disabled={previewLoading}
                className="px-3 py-1.5 rounded-lg bg-[#070C0E] border border-[#ffffff15] hover:border-[#0C8B44]/40 text-xs text-[#E5E5E5] flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#00E676] ${previewLoading ? 'animate-spin' : ''}`} /> Refresh Preview
              </button>
            </div>

            {previewData && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#070C0E] border border-[#ffffff10] text-xs">
                  <span className="text-[#737373]">Subject line: </span>
                  <span className="font-semibold text-[#FFFFFF]">{previewData.subject}</span>
                </div>

                {previewData.autoMessage && (
                  <div className="p-3.5 rounded-xl bg-[#0C8B44]/5 border border-[#0C8B44]/25 text-xs">
                    <span className="text-[#00E676] font-medium flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Auto message (sent when the message field is left blank)
                    </span>
                    <p className="text-[#A0A0A0] whitespace-pre-wrap leading-relaxed">{previewData.autoMessage}</p>
                  </div>
                )}

                <div className="rounded-xl border border-[#ffffff15] bg-[#070C0E] p-4 overflow-hidden">
                  <iframe
                    title="Email Preview"
                    srcDoc={previewData.html}
                    className="w-full h-[650px] rounded-lg border-0 bg-transparent"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: History */}
        {tab === 'history' && (
          <div className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/60 p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#00E676]" /> Invitation Audit History
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Recent single and bulk invitations dispatched by platform administrators.
                </p>
              </div>

              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="px-3 py-1.5 rounded-lg bg-[#070C0E] border border-[#ffffff15] hover:border-[#0C8B44]/40 text-xs text-[#E5E5E5] flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#00E676] ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="py-16 text-center text-sm text-[#737373] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#00E676]" />
                <span>Loading invitation logs…</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#737373] rounded-xl bg-[#070C0E]/50 border border-[#ffffff08]">
                No invitation history records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#ffffff10] text-[#737373] uppercase tracking-wider">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Admin</th>
                      <th className="py-3 px-3">Target / Recipient</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ffffff08]">
                    {history.map((h) => {
                      const d = h.details || {}
                      const email = d.email ? String(d.email) : h.targetUser?.email || '—'
                      const amt = typeof d.amount === 'number' ? formatMoney(d.amount, String(d.currency || 'USD')) : '—'
                      const mailSent = d.emailSent ? 'Delivered' : 'Logged / Pending'
                      return (
                        <tr key={h.id} className="hover:bg-[#ffffff05] transition-colors">
                          <td className="py-3 px-3 text-[#A0A0A0] whitespace-nowrap">
                            {new Date(h.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#00E676]">
                            {h.action}
                          </td>
                          <td className="py-3 px-3 text-[#E5E5E5]">
                            {h.actor.name || h.actor.email}
                          </td>
                          <td className="py-3 px-3 text-[#E5E5E5]">
                            {email}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#00E676]">
                            {amt}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${d.emailSent ? 'bg-[#0C8B44]/20 text-[#00E676]' : 'bg-[#ffffff10] text-[#A0A0A0]'}`}>
                              {mailSent}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Results Panel */}
        {last && (
          <div className="mt-10 rounded-2xl border border-[#ffffff15] bg-[#0f1619]/90 p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#ffffff10]">
              <div>
                <h2 className="text-xl font-medium text-white flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-[#00E676]" /> Invitation Dispatch Results
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Batch summary and itemized status for all processed recipients.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={exportResultsCsv}
                  className="px-4 py-2 rounded-xl bg-[#070C0E] border border-[#ffffff15] hover:border-[#0C8B44]/40 text-xs text-[#E5E5E5] flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4 text-[#00E676]" /> Export to CSV
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatTile label="Total Batch" value={String(last.summary.total)} />
              <StatTile label="Accounts Created" value={String(last.summary.created)} color="text-[#00E676]" />
              <StatTile label="Existing Credited" value={String(last.summary.credited)} color="text-[#2196F3]" />
              <StatTile label="Emails Sent" value={String(last.summary.emailsSent)} color="text-[#00E676]" />
              <StatTile label="Skipped" value={String(last.summary.skipped)} color="text-[#FF9800]" />
              <StatTile label="Failed" value={String(last.summary.failed)} color="text-[#f44336]" />
            </div>

            {/* Filter / Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipient email or name…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#070C0E] border border-[#ffffff15] text-xs text-[#E5E5E5] outline-none focus:border-[#0C8B44]"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Filter className="w-3.5 h-3.5 text-[#737373]" />
                {(['all', 'created', 'credited', 'failed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1 rounded-lg text-xs capitalize transition-colors ${
                      filterStatus === st
                        ? 'bg-[#0C8B44] text-white font-medium'
                        : 'bg-[#070C0E] text-[#737373] hover:text-[#E5E5E5]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Itemized Table */}
            <div className="rounded-xl border border-[#ffffff10] bg-[#070C0E] overflow-hidden">
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#0c1214] border-b border-[#ffffff10] text-[#737373] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Credit</th>
                      <th className="py-3 px-4">Temporary Password</th>
                      <th className="py-3 px-4">Email Delivery</th>
                      <th className="py-3 px-4">Notes / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ffffff08]">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#737373]">
                          No results matching the filter.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((r, idx) => {
                        const statusColor =
                          r.status === 'created'
                            ? 'bg-[#0C8B44]/20 text-[#00E676] border-[#0C8B44]/30'
                            : r.status === 'credited'
                              ? 'bg-[#2196F3]/20 text-[#2196F3] border-[#2196F3]/30'
                              : r.status === 'skipped'
                                ? 'bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30'
                                : 'bg-[#f44336]/20 text-[#f44336] border-[#f44336]/30'

                        return (
                          <tr key={r.email} className="hover:bg-[#ffffff05] transition-colors">
                            <td className="py-3.5 px-4 font-medium text-[#E5E5E5]">
                              <div>{r.email}</div>
                              {r.name && <div className="text-[11px] text-[#737373]">{r.name}</div>}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase font-semibold border ${statusColor}`}>
                                {r.status}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-semibold text-[#00E676]">
                              {typeof r.amount === 'number' ? formatMoney(r.amount, r.currency || last.summary.currency) : '—'}
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              {r.plainPassword ? (
                                <div className="flex items-center gap-2">
                                  <span className="bg-[#1a1a1a] px-2 py-0.5 rounded text-[#00E676]">
                                    {r.plainPassword}
                                  </span>
                                  <button
                                    onClick={() => copyPassword(r.plainPassword!, idx)}
                                    className="p-1 rounded hover:bg-[#ffffff10] text-[#A0A0A0] hover:text-white transition-colors"
                                    title="Copy temporary password"
                                  >
                                    {copiedIndex === idx ? (
                                      <Check className="w-3.5 h-3.5 text-[#00E676]" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[#525252]">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              {r.emailSent ? (
                                <span className="inline-flex items-center gap-1 text-[#00E676]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                </span>
                              ) : (
                                <span className="text-[#737373]">Logged</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-[#A0A0A0]">
                              {r.error ? <span className="text-[#f44336]">{r.error}</span> : 'Success'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, color = 'text-[#E5E5E5]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[#ffffff0a] bg-[#070C0E] p-3.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">{label}</p>
      <p className={`text-xl font-light ${color}`}>{value}</p>
    </div>
  )
}
