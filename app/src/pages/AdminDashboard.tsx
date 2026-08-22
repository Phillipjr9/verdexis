import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { adminApi, type AdminStats } from '../lib/adminApi'
import { api } from '../lib/api'
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
  Wallet,
  TrendingUp,
  Activity,
  ArrowLeftRight,
  History,
} from 'lucide-react'

type WalletBalanceRow = {
  currency?: string
  symbol?: string
  balance?: number
  available?: number
}

type RecentTx = {
  id: string
  transactionId?: string
  userId?: string
  kind: string
  currency?: string
  amount: number
  status?: string
  reference?: string | null
  subType?: string | null
  createdAt: string
  user?: { id?: string; email?: string; name?: string | null }
}

export default function AdminDashboard() {
  const [showCharts, setShowCharts] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [pendingReviewCount, setPendingReviewCount] = useState<number | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [walletBalances, setWalletBalances] = useState<WalletBalanceRow[]>([])
  const [walletError, setWalletError] = useState<string | null>(null)
  const [txFilter, setTxFilter] = useState<'all' | 'deposit' | 'transfer' | 'withdrawal' | 'other'>('all')

  useEffect(() => {
    let active = true
    Promise.allSettled([adminApi.stats(), adminApi.listPendingReviews(), api.getWallet()]).then(
      ([statsSettled, reviewSettled, walletSettled]) => {
        if (!active) return

        if (statsSettled.status === 'fulfilled') {
          setStats(statsSettled.value)
          setStatsError(null)
        } else {
          const err = statsSettled.reason
          const status =
            typeof err === 'object' && err !== null && 'status' in err
              ? Number((err as { status?: number }).status)
              : undefined
          if (status !== 401 && status !== 403) {
            const message =
              typeof err === 'object' && err !== null && 'error' in err
                ? String((err as { error?: string }).error)
                : 'Unable to load dashboard data'
            setStatsError(message)
          }
        }

        if (reviewSettled.status === 'fulfilled') {
          setPendingReviewCount(reviewSettled.value.reviews?.length ?? 0)
        } else {
          setPendingReviewCount(0)
        }

        if (walletSettled.status === 'fulfilled') {
          const body = walletSettled.value as { balances?: WalletBalanceRow[] }
          setWalletBalances(Array.isArray(body.balances) ? body.balances : [])
          setWalletError(null)
        } else {
          const err = walletSettled.reason
          const message =
            typeof err === 'object' && err !== null && 'error' in err
              ? String((err as { error?: string }).error)
              : 'Unable to load wallet balance'
          setWalletError(message)
          setWalletBalances([])
        }
      }
    )
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
  const recentTx: RecentTx[] = Array.isArray(stats?.recentTx) ? stats.recentTx : []
  const issues = s.kycPending + s.holds + s.pendingDeposits

  const usdRow =
    walletBalances.find((b) => (b.currency || '').toUpperCase() === 'USD') || walletBalances[0]
  const availableUsd = Number(usdRow?.available ?? usdRow?.balance ?? 0)
  const totalUsd = Number(usdRow?.balance ?? availableUsd)
  const lockedUsd = Math.max(0, totalUsd - availableUsd)

  const filteredTx = useMemo(() => {
    if (txFilter === 'all') return recentTx
    if (txFilter === 'other') {
      return recentTx.filter((tx) => !['deposit', 'transfer', 'withdrawal', 'withdraw'].includes(tx.kind))
    }
    if (txFilter === 'withdrawal') {
      return recentTx.filter((tx) => tx.kind === 'withdrawal' || tx.kind === 'withdraw')
    }
    return recentTx.filter((tx) => tx.kind === txFilter)
  }, [recentTx, txFilter])

  return (
    <AdminLayout
      title="Overview"
      subtitle="Balance, transactions, and platform pulse"
      actions={
        <>
          <Link
            to="/admin/transfer"
            className="px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Transfer funds
          </Link>
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

      {/* Admin balance */}
      <div className="mb-6 rounded-2xl border border-[#0C8B44]/30 bg-gradient-to-br from-[#0C8B44]/15 to-[#0a0f11] p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#0C8B44] mb-2">
              <Wallet className="w-5 h-5" />
              <span className="text-xs uppercase tracking-wider font-medium">Your admin balance</span>
            </div>
            <p className="text-3xl md:text-4xl font-light text-[#E5E5E5] tracking-tight">{money(availableUsd)}</p>
            <p className="text-sm text-[#A0A0A0] mt-1">
              Available to transfer or credit users
              {lockedUsd > 0 && <span className="text-[#FF9800]"> · {money(lockedUsd)} locked</span>}
            </p>
            {walletError && <p className="text-xs text-[#f44336] mt-2">{walletError}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/transfer" className="px-4 py-2 rounded-lg bg-[#0C8B44] text-white text-sm font-medium hover:bg-[#0a7539]">
              Transfer to user
            </Link>
            <Link to="/admin/users" className="px-4 py-2 rounded-lg border border-[#ffffff15] text-[#E5E5E5] text-sm hover:bg-[#ffffff08]">
              Manage users
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricBadge icon={<Users className="w-4 h-4" />} label="Users" value={fmt(s.users)} hint={`+${s.signups24h} today`} color="green" />
        <MetricBadge icon={<ShieldCheck className="w-4 h-4" />} label="Admins" value={fmt(s.admins)} hint="live" color="blue" />
        <MetricBadge icon={<Ban className="w-4 h-4" />} label="Suspended" value={fmt(s.suspended)} hint={s.suspended > 0 ? 'review' : 'clear'} color="red" />
        <MetricBadge icon={<Banknote className="w-4 h-4" />} label="Deposits 24h" value={fmt(s.deposits24h)} hint={s.deposits24h > 0 ? 'live' : '—'} color="green" />
        <MetricBadge icon={<ArrowDownToLine className="w-4 h-4" />} label="Withdrawals 24h" value={fmt(s.withdraws24h)} hint={s.withdraws24h > 0 ? 'live' : '—'} color="orange" />
        <MetricBadge icon={<AlertCircle className="w-4 h-4" />} label="Open issues" value={fmt(issues)} hint={issues > 0 ? 'action' : 'clear'} color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricBadge icon={<TrendingUp className="w-4 h-4" />} label="Holdings" value={fmt(s.holdings)} hint="open positions" color="blue" />
        <MetricBadge icon={<Activity className="w-4 h-4" />} label="Trades" value={fmt(s.trades)} hint="all time" color="green" />
        <MetricBadge icon={<AlertCircle className="w-4 h-4" />} label="Alerts" value={fmt(s.alerts)} hint={s.alerts > 0 ? 'check' : 'clear'} color="orange" />
        <MetricBadge icon={<FileCheck2 className="w-4 h-4" />} label="KYC pending" value={fmt(s.kycPending)} hint={s.kycPending > 0 ? 'review' : 'clear'} color="orange" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <QueueCard to="/admin/queues" title="Pending deposits" count={s.pendingDeposits} icon={<Banknote className="w-4 h-4" />} color="orange" />
        <QueueCard to="/admin/users?kycStatus=pending" title="KYC pending" count={s.kycPending} icon={<FileCheck2 className="w-4 h-4" />} color="orange" />
        <QueueCard to="/admin/users" title="Accounts on hold" count={s.holds} icon={<Lock className="w-4 h-4" />} color="red" />
        <QueueCard to="/admin/reviews" title="Testimonials" count={pendingReviewCount ?? 0} icon={<Hourglass className="w-4 h-4" />} color="orange" />
      </div>

      {/* Transaction history table */}
      <div className="mb-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-[#ffffff08]">
          <h2 className="text-sm font-semibold text-[#E5E5E5] flex items-center gap-2">
            <History className="w-4 h-4 text-[#0C8B44]" />
            Transaction history
            <span className="text-xs font-normal text-[#737373]">({filteredTx.length})</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'deposit', 'transfer', 'withdrawal', 'other'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTxFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors ${
                  txFilter === f
                    ? 'bg-[#0C8B44]/20 text-[#0C8B44] border border-[#0C8B44]/40'
                    : 'bg-[#ffffff06] text-[#A0A0A0] border border-transparent hover:text-[#E5E5E5]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#737373] border-b border-[#ffffff08]">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Txn ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#737373]">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => {
                  const positive = tx.amount >= 0
                  const kind = (tx.kind || 'other').toLowerCase()
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-[#ffffff05] hover:bg-[#ffffff04] transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-[#A0A0A0]">
                        <div>{relTime(tx.createdAt)}</div>
                        <div className="text-[10px] text-[#555]">{fmtDate(tx.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium ${
                            kind === 'deposit'
                              ? 'bg-[#4CAF50]/15 text-[#4CAF50]'
                              : kind === 'transfer'
                                ? 'bg-[#2196F3]/15 text-[#2196F3]'
                                : kind === 'withdrawal' || kind === 'withdraw'
                                  ? 'bg-[#FF9800]/15 text-[#FF9800]'
                                  : 'bg-[#ffffff10] text-[#A0A0A0]'
                          }`}
                        >
                          {tx.subType ? `${kind} · ${tx.subType}` : kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="truncate text-[#E5E5E5] text-xs">{tx.user?.name || '—'}</div>
                        <div className="truncate text-[10px] text-[#737373]">{tx.user?.email || tx.userId || '—'}</div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                          positive ? 'text-[#4CAF50]' : 'text-[#f44336]'
                        }`}
                      >
                        {positive ? '+' : ''}
                        {money(tx.amount, tx.currency || 'USD')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider ${
                            tx.status === 'completed'
                              ? 'text-[#4CAF50]'
                              : tx.status === 'pending'
                                ? 'text-[#FF9800]'
                                : 'text-[#A0A0A0]'
                          }`}
                        >
                          {tx.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-xs text-[#A0A0A0]" title={tx.reference || ''}>
                          {tx.reference || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[10px] text-[#737373] font-mono">
                          {(tx.transactionId || tx.id || '').slice(0, 18)}
                          {(tx.transactionId || tx.id || '').length > 18 ? '…' : ''}
                        </code>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCharts && (
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#FF9800]" />
            Real-time metrics
          </h2>
          <AdminDashboardCharts />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ActivityPanel
          title="Recent signups"
          empty="No recent signups."
          items={recentSignups.slice(0, 6).map((u: { name?: string; email: string; createdAt: string; role?: string }) => ({
            primary: u.name || u.email,
            secondary: u.email,
            meta: relTime(u.createdAt),
            badge: u.role,
          }))}
        />
        <ActivityPanel
          title="Quick activity"
          empty="No activity yet."
          items={recentTx.slice(0, 6).map((tx) => ({
            primary: (tx.kind || '').toUpperCase(),
            secondary: tx.user?.email || 'System',
            meta: relTime(tx.createdAt),
            badge: `${tx.amount >= 0 ? '+' : ''}${money(tx.amount)}`,
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
    <Link to={to} className={`rounded-2xl border ${border} p-4 hover:opacity-90 transition-opacity block`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
          {icon}
          {title}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${text}`}>{count}</span>
      </div>
      <p className="text-xs text-[#A0A0A0]">{count > 0 ? 'Needs attention — open to process' : 'Clear'}</p>
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

function money(n: number, currency = 'USD') {
  if (currency && currency.toUpperCase() !== 'USD') {
    return `${n.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${currency}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
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

function fmtDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export { AdminApprovalQueues as AdminConsoleContent } from '../components/admin/AdminApprovalQueues'
