import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { adminApi, type AdminStats } from '../lib/adminApi'
import { AdminDashboardCharts } from '../components/dashboard/AdminDashboardCharts'
import {
  Users,
  ShieldCheck,
  Ban,
  Banknote,
  ArrowDownToLine,
  AlertCircle,
  FileCheck2,
  Lock,
  BarChart3,
  Inbox,
  Hourglass,
} from 'lucide-react'

export default function AdminDashboard() {
  const [showCharts, setShowCharts] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [pendingReviewCount, setPendingReviewCount] = useState<number | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([adminApi.stats(), adminApi.listPendingReviews()])
      .then(([statsResult, reviewResult]) => {
        if (!active) return
        setStats(statsResult)
        setPendingReviewCount(reviewResult.reviews.length)
        setStatsError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        const status =
          typeof err === 'object' && err !== null && 'status' in err
            ? Number((err as { status?: number }).status)
            : undefined
        const isTransient =
          status === 401 ||
          status === 403 ||
          (typeof err === 'object' &&
            err !== null &&
            'name' in err &&
            (err as { name?: string }).name === 'AbortError')
        if (isTransient) {
          setStatsError(null)
          return
        }
        const message =
          typeof err === 'object' && err !== null && 'error' in err
            ? String((err as { error?: string }).error)
            : 'Unable to load dashboard data'
        setStatsError(message)
      })
    return () => {
      active = false
    }
  }, [])

  const s = stats?.stats ?? {
    users: 0,
    admins: 0,
    suspended: 0,
    holdings: 0,
    trades: 0,
    alerts: 0,
    deposits24h: 0,
    signups24h: 0,
    holds: 0,
    kycPending: 0,
    withdraws24h: 0,
    pendingDeposits: 0,
  }

  const recentSignups = stats?.recentSignups ?? []
  const recentTx = stats?.recentTx ?? []
  const issues = s.kycPending + s.holds + s.pendingDeposits

  return (
    <AdminLayout
      title="Overview"
      subtitle="Work queues first, then platform pulse"
      actions={
        <>
          <Link
            to="/admin/queues"
            className="px-4 py-2.5 bg-[#0C8B44]/10 border border-[#0C8B44]/30 text-[#0C8B44] text-sm font-medium rounded-lg hover:bg-[#0C8B44]/20 transition-colors inline-flex items-center gap-2"
          >
            <Inbox className="w-4 h-4" />
            Open queues
          </Link>
          <Link
            to="/admin/analytics"
            className="px-4 py-2.5 bg-[#2196F3]/10 border border-[#2196F3]/30 text-[#2196F3] text-sm font-medium rounded-lg hover:bg-[#2196F3]/20 transition-colors inline-flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          <button
            type="button"
            onClick={() => setShowCharts((v) => !v)}
            className="px-4 py-2.5 bg-[#ffffff08] border border-[#ffffff12] text-[#A0A0A0] text-sm font-medium rounded-lg hover:text-[#E5E5E5] transition-colors"
          >
            {showCharts ? 'Hide charts' : 'Show charts'}
          </button>
        </>
      }
    >
      {statsError && (
        <div className="mb-6 rounded-2xl border border-[#f44336]/30 bg-[#f44336]/10 p-4 text-sm text-[#f44336]">
          Unable to load admin data: {statsError}
        </div>
      )}

      {/* 1. KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricBadge icon={<Users className="w-4 h-4" />} label="Users" value={fmt(s.users)} hint={`+${s.signups24h} today`} color="green" />
        <MetricBadge icon={<ShieldCheck className="w-4 h-4" />} label="Admins" value={fmt(s.admins)} hint="live" color="blue" />
        <MetricBadge icon={<Ban className="w-4 h-4" />} label="Suspended" value={fmt(s.suspended)} hint={s.suspended > 0 ? 'review' : 'clear'} color="red" />
        <MetricBadge icon={<Banknote className="w-4 h-4" />} label="Deposits 24h" value={fmt(s.deposits24h)} hint={s.deposits24h > 0 ? 'live' : '—'} color="green" />
        <MetricBadge icon={<ArrowDownToLine className="w-4 h-4" />} label="Withdrawals 24h" value={fmt(s.withdraws24h)} hint={s.withdraws24h > 0 ? 'live' : '—'} color="orange" />
        <MetricBadge icon={<AlertCircle className="w-4 h-4" />} label="Open issues" value={fmt(issues)} hint={issues > 0 ? 'action' : 'clear'} color="red" />
      </div>

      {/* 2. Work queues summary — primary ops focus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <QueueCard
          to="/admin/queues"
          title="Pending deposits"
          count={s.pendingDeposits}
          icon={<Banknote className="w-4 h-4" />}
          color="orange"
        />
        <QueueCard
          to="/admin/users?kycStatus=pending"
          title="KYC pending"
          count={s.kycPending}
          icon={<FileCheck2 className="w-4 h-4" />}
          color="orange"
        />
        <QueueCard
          to="/admin/users"
          title="Accounts on hold"
          count={s.holds}
          icon={<Lock className="w-4 h-4" />}
          color="red"
        />
        <QueueCard
          to="/admin/reviews"
          title="Testimonials"
          count={pendingReviewCount ?? 0}
          icon={<Hourglass className="w-4 h-4" />}
          color="orange"
        />
      </div>

      <p className="text-xs text-[#737373] mb-6">
        Full approve/reject flows live on{' '}
        <Link to="/admin/queues" className="text-[#0C8B44] hover:underline">
          Queues
        </Link>
        . Sidebar keeps navigation in one place.
      </p>

      {/* 3. Optional charts (off by default) */}
      {showCharts && (
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#FF9800]" />
            Real-time metrics
          </h2>
          <AdminDashboardCharts />
        </div>
      )}

      {/* 4. Single recent activity block (no duplication) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ActivityPanel
          title="Recent signups"
          empty="No recent signups."
          items={recentSignups.slice(0, 6).map((u) => ({
            primary: u.name || u.email,
            secondary: u.email,
            meta: relTime(u.createdAt),
            badge: u.role,
          }))}
        />
        <ActivityPanel
          title="Recent transactions"
          empty="No activity yet."
          items={recentTx.slice(0, 6).map((tx) => ({
            primary: tx.kind.toUpperCase(),
            secondary: tx.user?.email || 'System',
            meta: relTime(tx.createdAt),
            badge: `${tx.kind === 'deposit' ? '+' : '-'}${money(Math.abs(tx.amount))}`,
          }))}
        />
      </div>
    </AdminLayout>
  )
}

function MetricBadge({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  color: 'green' | 'red' | 'orange' | 'blue'
}) {
  const border =
    color === 'green'
      ? 'bg-[#4CAF50]/10 border-[#4CAF50]/30'
      : color === 'red'
        ? 'bg-[#f44336]/10 border-[#f44336]/30'
        : color === 'orange'
          ? 'bg-[#FF9800]/10 border-[#FF9800]/30'
          : 'bg-[#2196F3]/10 border-[#2196F3]/30'
  const text =
    color === 'green'
      ? 'text-[#4CAF50]'
      : color === 'red'
        ? 'text-[#f44336]'
        : color === 'orange'
          ? 'text-[#FF9800]'
          : 'text-[#2196F3]'
  return (
    <div className={`rounded-xl border ${border} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={text}>{icon}</div>
        <span className="text-[10px] uppercase tracking-wider text-[#737373]">{label}</span>
      </div>
      <p className="text-lg font-light text-[#E5E5E5]">{value}</p>
      <p className={`text-xs mt-1 ${text}`}>{hint}</p>
    </div>
  )
}

function QueueCard({
  to,
  title,
  count,
  icon,
  color,
}: {
  to: string
  title: string
  count: number
  icon: ReactNode
  color: 'orange' | 'red'
}) {
  const border =
    color === 'orange' ? 'border-[#FF9800]/30 bg-[#FF9800]/10' : 'border-[#f44336]/30 bg-[#f44336]/10'
  const text = color === 'orange' ? 'text-[#FF9800]' : 'text-[#f44336]'
  return (
    <Link
      to={to}
      className={`rounded-2xl border ${border} p-4 hover:opacity-90 transition-opacity block`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
          {icon}
          {title}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${text}`}>{count}</span>
      </div>
      <p className="text-xs text-[#A0A0A0]">
        {count > 0 ? 'Needs attention — open to process' : 'Clear'}
      </p>
    </Link>
  )
}

function ActivityPanel({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: { primary: string; secondary: string; meta: string; badge?: string }[]
}) {
  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5">
      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-[#737373]">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={`${title}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#ffffff05] bg-[#0a0f11]/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[#E5E5E5]">{item.primary}</p>
                <p className="truncate text-xs text-[#737373]">{item.secondary}</p>
              </div>
              <div className="text-right shrink-0">
                {item.badge && (
                  <span className="mb-1 block rounded-full bg-[#0C8B44]/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#0C8B44]">
                    {item.badge}
                  </span>
                )}
                <p className="text-xs text-[#737373]">{item.meta}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function money(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function relTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Back-compat for any imports of the old inline queues component */
export { AdminApprovalQueues as AdminConsoleContent } from '../components/admin/AdminApprovalQueues'
