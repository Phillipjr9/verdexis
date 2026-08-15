import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminSessionStats, type AdminStats } from '../lib/adminApi'
import { AdminDashboardCharts } from '../components/dashboard/AdminDashboardCharts'
import {
  Users, ShieldCheck, Ban, ArrowLeftRight, Banknote, UserPlus, MegaphoneIcon, Settings as Cog, Activity, FileCheck2,
  Lock, ArrowDownToLine, Link2 as LinkIcon, Gift, ArrowUpRight, MapPin, Hourglass, BarChart3, AlertCircle, Zap,
} from 'lucide-react'

export default function AdminDashboard() {
  const [showCharts, setShowCharts] = useState(true)
  const [seedLoading, setSeedLoading] = useState(false)
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [sessionStats, setSessionStats] = useState<AdminSessionStats | null>(null)
  const [pendingReviewCount, setPendingReviewCount] = useState<number | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([
      adminApi.stats(),
      adminApi.getSessionStats(),
      adminApi.listPendingReviews(),
    ])
      .then(([statsResult, sessionResult, reviewResult]) => {
        if (!active) return
        setStats(statsResult)
        setSessionStats(sessionResult.stats)
        setPendingReviewCount(reviewResult.reviews.length)
        setStatsError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status?: number }).status) : undefined
        const isTransient = status === 401 || status === 403 || (typeof err === 'object' && err !== null && 'name' in err && (err as { name?: string }).name === 'AbortError')
        if (isTransient) {
          setStatsError(null)
          return
        }
        const message = typeof err === 'object' && err !== null && 'error' in err ? String((err as { error?: string }).error) : 'Unable to load dashboard data'
        setStatsError(message)
      })

    return () => { active = false }
  }, [])

  const handleSeedTreasury = async () => {
    if (seedLoading) return
    setSeedLoading(true)
    try {
      const result = await adminApi.seedTreasury()
      toast.success(result.message)
      setTreasuryBalance(result.balance)
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'error' in error ? (error as any).error : 'Failed to seed treasury'
      toast.error(message)
    } finally {
      setSeedLoading(false)
    }
  }

  const statValues = stats?.stats ?? {
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

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-4xl font-light text-[#E5E5E5] mb-2">Super Admin / Admin Dashboard</h1>
              <p className="text-sm text-[#737373]">Platform operations, governance, and real-time monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/analytics" className="px-4 py-2.5 bg-[#2196F3]/10 border border-[#2196F3]/30 text-[#2196F3] text-sm font-medium rounded-lg hover:bg-[#2196F3]/20 transition-colors flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Full Analytics
              </Link>
              <button
                onClick={() => setShowCharts(!showCharts)}
                className="px-4 py-2.5 bg-[#0C8B44]/10 border border-[#0C8B44]/30 text-[#0C8B44] text-sm font-medium rounded-lg hover:bg-[#0C8B44]/20 transition-colors flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                {showCharts ? 'Hide' : 'Show'} Charts
              </button>
            </div>
          </div>

          {statsError && (
            <div className="mb-8 rounded-2xl border border-[#f44336]/30 bg-[#f44336]/10 p-4 text-sm text-[#f44336]">
              Unable to load admin data: {statsError}
            </div>
          )}

          {showCharts && (
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-8">
              <h2 className="text-sm font-semibold text-[#E5E5E5] mb-6 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#FF9800]" />
                Real-time Metrics
              </h2>
              <AdminDashboardCharts />
            </div>
          )}

          {sessionStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <MetricBadge icon={<Activity className="w-4 h-4" />} label="Active sessions" value={String(sessionStats.totalActiveSessions)} trend="" color="green" />
              <MetricBadge icon={<ShieldCheck className="w-4 h-4" />} label="OTP verified" value={String(sessionStats.otpVerifiedSessions)} trend="" color="blue" />
              <MetricBadge icon={<Hourglass className="w-4 h-4" />} label="Expired sessions" value={String(sessionStats.expiredSessions)} trend="" color="orange" />
              <MetricBadge icon={<BarChart3 className="w-4 h-4" />} label="Avg session sec" value={`${sessionStats.averageSessionDuration}s`} trend="" color="green" />
            </div>
          )}
          {pendingReviewCount !== null && (
            <div className="mb-8">
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5 inline-flex items-center gap-3">
                <FileCheck2 className="w-5 h-5 text-[#0C8B44]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[#737373]">Pending testimonials</p>
                  <p className="text-2xl font-light text-[#E5E5E5]">{pendingReviewCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Admin Console Summary */}
          <div className="rounded-2xl bg-[#0f1619]/60 border border-[#ffffff0d] p-6 mb-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#737373]">Admin console</p>
                <h2 className="text-3xl font-light text-[#E5E5E5]">Full operator control over every account on this instance.</h2>
              </div>
              <div className="rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">Treasury</p>
                <p className="text-3xl font-light text-[#0C8B44]">$999,999,993,615.3</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
              <div className="rounded-2xl bg-[#121a1f]/90 border border-[#ffffff08] p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-[#737373] mb-3">Send funds to user</p>
                <div className="rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 p-4 text-sm text-[#E5E5E5]">RECIPIENT</div>
              </div>
              <div className="rounded-2xl bg-[#121a1f]/90 border border-[#ffffff08] p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-[#737373] mb-3">Withdraw from user</p>
                <div className="rounded-2xl bg-[#FF9800]/10 border border-[#FF9800]/20 p-4 text-sm text-[#E5E5E5]">USER</div>
              </div>
              <div className="rounded-2xl bg-[#121a1f]/90 border border-[#ffffff08] p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-[#737373] mb-3">Governance</p>
                <p className="text-sm text-[#A0A0A0]">Platform settings now live in the dedicated admin settings page.</p>
              </div>
              <div className="rounded-2xl bg-[#121a1f]/90 border border-[#ffffff08] p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-[#737373] mb-3">Total Net Worth</p>
                <p className="text-2xl font-light text-[#E5E5E5]">$999,999,993,615.3</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <StatBadge label="Signups (24h)" value={String(statValues.signups24h)} />
              <StatBadge label="Holdings" value={String(statValues.holdings)} />
              <StatBadge label="Trades" value={String(statValues.trades)} />
              <StatBadge label="Active Alerts" value={String(statValues.alerts)} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
              <DashboardPanel
                title="Recent signups"
                subtitle=""
                emptyText={recentSignups.length ? '' : 'No recent signups.'}
                items={recentSignups.slice(0, 4).map((signup) => ({
                  title: signup.name || signup.email,
                  subtitle: signup.email,
                  meta: formatRelativeTime(signup.createdAt),
                  badge: signup.role,
                }))}
              />
              <DashboardPanel
                title="Recent transactions"
                subtitle=""
                emptyText={recentTx.length ? '' : 'No activity yet.'}
                items={recentTx.slice(0, 4).map((tx) => ({
                  title: tx.kind.toUpperCase(),
                  subtitle: tx.user?.email || 'System',
                  meta: formatRelativeTime(tx.createdAt),
                  badge: `${tx.kind === 'deposit' ? '+' : '-'}${formatCurrency(Math.abs(tx.amount))}`,
                }))}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
              <DashboardPanel
                title="Pending deposit approvals"
                subtitle=""
                emptyText={statValues.pendingDeposits > 0 ? `There are ${statValues.pendingDeposits} pending deposit requests.` : 'No pending deposit requests. New user deposits will appear here for approval before they affect balances.'}
              />
              <DashboardPanel
                title="On-chain deposit approvals"
                subtitle=""
                emptyText="Deposits initiated from a user’s connected self-custody wallet (MetaMask / WalletConnect / etc.) to the admin treasury address. Click the tx hash to verify on-chain, then approve to credit the user. No on-chain deposits awaiting verification."
              />
              <DashboardPanel
                title="Pending withdrawal payouts"
                subtitle=""
                emptyText="Crypto withdrawal requests queued for manual payout. Send the funds to the user’s wallet address, then click Approve and paste the tx hash. No pending withdrawal requests."
              />
            </div>
          </div>

          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetricBadge icon={<Users className="w-4 h-4" />} label="Users" value={formatCompactNumber(statValues.users)} trend={`+${statValues.signups24h}`} color="green" />
            <MetricBadge icon={<ShieldCheck className="w-4 h-4" />} label="Admins" value={formatCompactNumber(statValues.admins)} trend="live" color="blue" />
            <MetricBadge icon={<Ban className="w-4 h-4" />} label="Suspended" value={formatCompactNumber(statValues.suspended)} trend={statValues.suspended > 0 ? 'review' : 'clear'} color="red" />
            <MetricBadge icon={<Banknote className="w-4 h-4" />} label="Deposits (24h)" value={formatCompactNumber(statValues.deposits24h)} trend={statValues.deposits24h > 0 ? 'live' : 'none'} color="green" />
            <MetricBadge icon={<ArrowDownToLine className="w-4 h-4" />} label="Withdrawals (24h)" value={formatCompactNumber(statValues.withdraws24h)} trend={statValues.withdraws24h > 0 ? 'live' : 'none'} color="orange" />
            <MetricBadge icon={<AlertCircle className="w-4 h-4" />} label="Issues" value={formatCompactNumber(statValues.kycPending + statValues.holds + statValues.pendingDeposits)} trend={statValues.pendingDeposits > 0 ? 'pending' : 'clear'} color="red" />
          </div>
        </div>

        {/* Quick Actions & Operations */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6 mb-8">
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0C8B44]" />
                Core Operations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ActionButton to="/admin/users" icon={<Users className="w-4 h-4" />} label="Manage Users" />
                <ActionButton to="/admin/transfer" icon={<ArrowLeftRight className="w-4 h-4" />} label="Transfer Funds" />
                <ActionButton to="/admin/deposits" icon={<Banknote className="w-4 h-4" />} label="Deposit Settings" />
                <ActionButton to="/admin/reviews" icon={<FileCheck2 className="w-4 h-4" />} label="Review Testimonials" />
                <ActionButton to="/admin/broadcast" icon={<MegaphoneIcon className="w-4 h-4" />} label="Send Broadcast" />
                <ActionButton to="/admin/audit" icon={<Activity className="w-4 h-4" />} label="View Audit Log" />
              </div>
            </div>

            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
                <Cog className="w-4 h-4 text-[#A0A0A0]" />
                Settings & Governance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ActionButton to="/admin/settings" icon={<Cog className="w-4 h-4" />} label="Platform Settings" />
                <ActionButton to="/admin/signup-bonus" icon={<Gift className="w-4 h-4" />} label="Signup Bonus" />
                <ActionButton to="/admin/referrals" icon={<Gift className="w-4 h-4" />} label="Referrals" />
                <ActionButton to="/admin/deposit-addresses" icon={<LinkIcon className="w-4 h-4" />} label="Deposit Addresses" />
                <ActionButton to="/admin/security-events" icon={<ShieldCheck className="w-4 h-4" />} label="Security Events" />
                <ActionButton to="/admin/analytics" icon={<BarChart3 className="w-4 h-4" />} label="Analytics" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/20 to-[#0C8B44]/5 border border-[#0C8B44]/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#E5E5E5]">Admin Treasury</h3>
                <Banknote className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <p className="text-3xl font-light text-[#0C8B44] mb-4">${treasuryBalance !== null ? treasuryBalance.toLocaleString('en-US') : '1.2M'}</p>
              <button
                onClick={handleSeedTreasury}
                disabled={seedLoading}
                className="w-full px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedLoading ? 'Seeding Treasury...' : 'Seed Treasury'}
              </button>
            </div>

            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h3 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#2196F3]" />
                System Status
              </h3>
              <div className="space-y-3">
                <StatusItem label="API Health" status="healthy" />
                <StatusItem label="Database" status="healthy" />
                <StatusItem label="Cache" status="healthy" />
                <StatusItem label="Email Service" status="healthy" />
              </div>
            </div>
          </div>
        </div>

        {/* Pending Actions Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <PendingSection
            title="Pending Deposits"
            icon={<Banknote className="w-4 h-4" />}
            count={12}
            color="orange"
            items={[
              { user: 'John Doe', amount: '$5,000', time: '2m ago' },
              { user: 'Jane Smith', amount: '$3,500', time: '15m ago' },
              { user: 'Bob Johnson', amount: '$2,200', time: '1h ago' },
            ]}
            link="/admin/deposits"
          />
          <PendingSection
            title="KYC Pending"
            icon={<FileCheck2 className="w-4 h-4" />}
            count={23}
            color="orange"
            items={[
              { user: 'Alice Brown', amount: 'Pending', time: '3h ago' },
              { user: 'Charlie Davis', amount: 'Pending', time: '5h ago' },
              { user: 'Diana Wilson', amount: 'Pending', time: '1d ago' },
            ]}
            link="/admin/users?kycStatus=pending"
          />
          <PendingSection
            title="Accounts on Hold"
            icon={<Lock className="w-4 h-4" />}
            count={5}
            color="red"
            items={[
              { user: 'Eve Martinez', amount: 'Hold', time: '2d ago' },
              { user: 'Frank Garcia', amount: 'Hold', time: '3d ago' },
              { user: 'Grace Lee', amount: 'Hold', time: '5d ago' },
            ]}
            link="/admin/users?hold=true"
          />
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ActivityCard
            title="Recent Signups"
            icon={<UserPlus className="w-4 h-4" />}
            items={recentSignups.slice(0, 4).map((signup) => ({
              name: signup.name || signup.email,
              email: signup.email,
              time: formatRelativeTime(signup.createdAt),
              role: signup.role,
            }))}
          />
          <ActivityCard
            title="Recent Transactions"
            icon={<ArrowLeftRight className="w-4 h-4" />}
            items={recentTx.slice(0, 4).map((tx) => ({
              name: tx.kind.toUpperCase(),
              email: tx.user?.email || 'System',
              time: formatRelativeTime(tx.createdAt),
              amount: `${tx.kind === 'deposit' ? '+' : '-'}${formatCurrency(Math.abs(tx.amount))}`,
            }))}
          />
        </div>

        {/* All Operations Grid */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h2 className="text-sm font-semibold text-[#E5E5E5] mb-6 flex items-center gap-2">
            <Cog className="w-4 h-4 text-[#737373]" />
            All Admin Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <OperationLink to="/admin/users" icon={<Users className="w-5 h-5" />} label="Users" />
            <OperationLink to="/admin/transfer" icon={<ArrowLeftRight className="w-5 h-5" />} label="Transfer" />
            <OperationLink to="/admin/deposits" icon={<Banknote className="w-5 h-5" />} label="Deposits" />
            <OperationLink to="/admin/broadcast" icon={<MegaphoneIcon className="w-5 h-5" />} label="Broadcast" />
            <OperationLink to="/admin/audit" icon={<Activity className="w-5 h-5" />} label="Audit" />
            <OperationLink to="/admin/settings" icon={<Cog className="w-5 h-5" />} label="Settings" />
            <OperationLink to="/admin/signup-bonus" icon={<Gift className="w-5 h-5" />} label="Bonus" />
            <OperationLink to="/admin/referrals" icon={<Gift className="w-5 h-5" />} label="Referrals" />
            <OperationLink to="/admin/deposit-addresses" icon={<MapPin className="w-5 h-5" />} label="Addresses" />
            <OperationLink to="/admin/security-events" icon={<ShieldCheck className="w-5 h-5" />} label="Security" />
            <OperationLink to="/admin/analytics" icon={<BarChart3 className="w-5 h-5" />} label="Analytics" />
            <OperationLink to="/admin/reviews" icon={<FileCheck2 className="w-5 h-5" />} label="Reviews" />
            <OperationLink to="/admin/status" icon={<Activity className="w-5 h-5" />} label="Status" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricBadge({ icon, label, value, trend, color }: { icon: ReactNode; label: string; value: string; trend: string; color: 'green' | 'red' | 'orange' | 'blue' }) {
  const colorClass = color === 'green' ? 'bg-[#4CAF50]/10 border-[#4CAF50]/30' : color === 'red' ? 'bg-[#f44336]/10 border-[#f44336]/30' : color === 'orange' ? 'bg-[#FF9800]/10 border-[#FF9800]/30' : 'bg-[#2196F3]/10 border-[#2196F3]/30'
  const textColor = color === 'green' ? 'text-[#4CAF50]' : color === 'red' ? 'text-[#f44336]' : color === 'orange' ? 'text-[#FF9800]' : 'text-[#2196F3]'
  return (
    <div className={`rounded-xl border ${colorClass} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={textColor}>{icon}</div>
        <span className="text-[10px] uppercase tracking-wider text-[#737373]">{label}</span>
      </div>
      <p className="text-lg font-light text-[#E5E5E5]">{value}</p>
      <p className={`text-xs mt-1 ${textColor}`}>{trend}</p>
    </div>
  )
}

function ActionButton({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/5 transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center text-[#0C8B44] group-hover:bg-[#0C8B44]/20 transition-colors">{icon}</div>
      <span className="text-sm text-[#E5E5E5]">{label}</span>
      <ArrowUpRight className="w-3 h-3 text-[#737373] ml-auto group-hover:text-[#0C8B44] transition-colors" />
    </Link>
  )
}

function StatusItem({ label, status }: { label: string; status: 'healthy' | 'warning' | 'error' }) {
  const statusColor = status === 'healthy' ? 'bg-[#4CAF50]' : status === 'warning' ? 'bg-[#FF9800]' : 'bg-[#f44336]'
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#A0A0A0]">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="text-xs text-[#737373] capitalize">{status}</span>
      </div>
    </div>
  )
}

function PendingSection({ title, icon, count, color, items, link }: { title: string; icon?: ReactNode; count: number; color: 'orange' | 'red'; items: Array<{ user: string; amount: string; time: string }>; link: string }) {
  const bgColor = color === 'orange' ? 'bg-[#FF9800]/10 border-[#FF9800]/30' : 'bg-[#f44336]/10 border-[#f44336]/30'
  const textColor = color === 'orange' ? 'text-[#FF9800]' : 'text-[#f44336]'
  const iconDisplay = icon ?? (color === 'orange' ? <Hourglass className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />)
  return (
    <Link to={link} className={`rounded-2xl border ${bgColor} p-6 hover:border-opacity-60 transition-colors group`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#E5E5E5] flex items-center gap-2">
          {iconDisplay}
          {title}
        </h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${textColor} bg-opacity-20 bg-current`}>{count}</span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={`adm-row-${i}`} className="flex items-center justify-between py-2 border-t border-[#ffffff05]">
            <div className="min-w-0">
              <p className="text-sm text-[#E5E5E5] truncate">{item.user}</p>
              <p className="text-xs text-[#737373]">{item.time}</p>
            </div>
            <p className="text-sm font-medium text-[#A0A0A0]">{item.amount}</p>
          </div>
        ))}
      </div>
    </Link>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#121a1f]/90 border border-[#ffffff08] p-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[#737373] mb-2">{label}</p>
      <p className="text-2xl font-light text-[#E5E5E5]">{value}</p>
    </div>
  )
}

function DashboardPanel({ title, subtitle, emptyText, items }: { title: string; subtitle: string; emptyText: string; items?: Array<{ title: string; subtitle: string; meta: string; badge?: string }> }) {
  return (
    <div className="rounded-2xl bg-[#121a1f]/90 border border-[#ffffff08] p-5 h-full">
      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-3">{title}</h3>
      {subtitle ? <p className="text-sm text-[#A0A0A0] mb-4">{subtitle}</p> : null}
      {items && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#ffffff05] bg-[#0f1619]/80 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-[#E5E5E5]">{item.title}</p>
                <p className="truncate text-xs text-[#737373]">{item.subtitle}</p>
              </div>
              <div className="text-right">
                {item.badge && <span className="mb-1 block rounded-full bg-[#0C8B44]/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#0C8B44]">{item.badge}</span>}
                <p className="text-xs text-[#737373]">{item.meta}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1619]/80 border border-[#ffffff05] p-4 text-sm text-[#A0A0A0]">{emptyText}</div>
      )}
    </div>
  )
}

function ActivityCard({ title, icon, items }: { title: string; icon: ReactNode; items: Array<{ name: string; email: string; time: string; role?: string; amount?: string }> }) {
  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={`adm-row2-${i}`} className="flex items-center justify-between py-3 border-b border-[#ffffff05] last:border-0">
            <div className="min-w-0">
              <p className="text-sm text-[#E5E5E5] truncate">{item.name}</p>
              <p className="text-xs text-[#737373] truncate">{item.email}</p>
            </div>
            <div className="text-right ml-3">
              {item.role && <span className="text-[9px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-1.5 py-0.5 rounded">{item.role}</span>}
              {item.amount && <p className="text-sm font-medium text-[#E5E5E5]">{item.amount}</p>}
              <p className="text-xs text-[#737373]">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OperationLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/5 transition-colors group">
      <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center text-[#0C8B44] group-hover:bg-[#0C8B44]/20 transition-colors">{icon}</div>
      <span className="text-xs font-medium text-[#E5E5E5] text-center">{label}</span>
    </Link>
  )
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatRelativeTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const diff = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diff / 60000))

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`

  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

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
      {/* Pending Deposits Section */}
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#E5E5E5]">{d.user.name} <span className="text-[#737373]">·</span> <span className="text-[11px] text-[#737373]">{d.user.email}</span></p>
                  </div>
                  <p className="text-[11px] text-[#737373] truncate">{d.reference || 'No reference'}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium text-[#E5E5E5]">{(d.amount ?? 0).toLocaleString()} {d.currency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyTx === d.id} onClick={() => handleApprove(d.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50">Approve</button>
                  <button type="button" disabled={busyTx === d.id} onClick={() => handleReject(d.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-[#3B99FC]" /> On-chain deposit approvals
            {onchain.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#3B99FC]/15 text-[#3B99FC]">{onchain.length}</span>
            )}
          </h2>
          <button type="button" onClick={refreshOnchain} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
        </div>
        {onchainLoading ? (
          <p className="text-xs text-[#737373]">Loading…</p>
        ) : onchain.length === 0 ? (
          <p className="text-xs text-[#737373]">No on-chain deposits awaiting verification.</p>
        ) : (
          <div className="space-y-2">
            {onchain.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/admin/users/${d.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">{d.user.name}</Link>
                    <span className="text-[#737373]">·</span>
                    <span className="text-[11px] text-[#737373]">{d.user.email}</span>
                  </div>
                  <p className="text-[11px] text-[#737373] truncate font-mono mt-1">
                    from {d.fromAddress.slice(0, 10)}…{d.fromAddress.slice(-6)} → {d.toAddress.slice(0, 10)}…{d.toAddress.slice(-6)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium text-[#E5E5E5]">{d.amount} {d.asset}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyOnchain === d.id} onClick={() => handleApproveOnchain(d)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50">Approve & credit</button>
                  <button type="button" disabled={busyOnchain === d.id} onClick={() => handleRejectOnchain(d)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[#f44336]" /> Pending withdrawal payouts
            {pendingWithdrawals.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f44336]/15 text-[#f44336]">{pendingWithdrawals.length}</span>
            )}
          </h2>
          <button type="button" onClick={refreshWithdrawals} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
        </div>
        {withdrawalsLoading ? (
          <p className="text-xs text-[#737373]">Loading…</p>
        ) : pendingWithdrawals.length === 0 ? (
          <p className="text-xs text-[#737373]">No pending withdrawal requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingWithdrawals.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/admin/users/${w.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">{w.user.name}</Link>
                    <span className="text-[#737373]">·</span>
                    <span className="text-[11px] text-[#737373]">{w.user.email}</span>
                  </div>
                  <p className="text-[11px] text-[#737373] font-mono mt-1 truncate">
                    Send to: {w.walletLink?.address ?? 'unknown'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium text-[#E5E5E5]">{w.amount} {w.asset}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyWithdrawal === w.id} onClick={() => handleApproveWithdrawal(w.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50">Approve & mark sent</button>
                  <button type="button" disabled={busyWithdrawal === w.id} onClick={() => handleRejectWithdrawal(w.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
