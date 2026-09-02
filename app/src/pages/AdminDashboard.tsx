import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminSessionStats, type AdminStats } from '../lib/adminApi'
import { api } from '../lib/api'
import { AdminDashboardCharts } from '../components/dashboard/AdminDashboardCharts'
import { AdminFeeProofsPanel } from '../components/admin/AdminFeeProofsPanel'
import {
  Users, ShieldCheck, ArrowLeftRight, Banknote, MegaphoneIcon, Settings as Cog, Activity, FileCheck2,
  ArrowDownToLine, Gift, MapPin, Hourglass, BarChart3, AlertCircle,
} from 'lucide-react'

function money(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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
    Promise.allSettled([
      adminApi.stats(),
      adminApi.getSessionStats(),
      adminApi.listPendingReviews(),
    ]).then(async ([statsOutcome, sessionOutcome, reviewOutcome]) => {
      if (!active) return
      if (statsOutcome.status === 'fulfilled') {
        setStats(statsOutcome.value)
        setStatsError(null)
      } else {
        const err = statsOutcome.reason as { status?: number; error?: string; name?: string } | undefined
        const transient = err?.status === 401 || err?.status === 403 || err?.name === 'AbortError'
        if (!transient) setStatsError(err?.error || 'Unable to load dashboard data')
      }
      if (sessionOutcome.status === 'fulfilled') setSessionStats(sessionOutcome.value.stats)
      if (reviewOutcome.status === 'fulfilled') setPendingReviewCount(reviewOutcome.value.reviews.length)
      try {
        const w = await api.get('/api/wallet')
        const usd = w.balances?.find((b: { currency?: string; balance?: number }) => b.currency === 'USD')
        if (usd) setTreasuryBalance(Number(usd.balance) || 0)
      } catch (e) {
        console.warn('Treasury balance load failed:', e)
      }
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
      const message = typeof error === 'object' && error !== null && 'error' in error ? (error as { error?: string }).error : 'Failed to seed treasury'
      toast.error(message)
    } finally {
      setSeedLoading(false)
    }
  }

  const s = stats?.stats ?? {
    users: 0, admins: 0, suspended: 0, holdings: 0, trades: 0, alerts: 0,
    deposits24h: 0, signups24h: 0, holds: 0, kycPending: 0, withdraws24h: 0, pendingDeposits: 0,
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-4xl font-light text-[#E5E5E5] mb-2">Super Admin / Admin Dashboard</h1>
            <p className="text-sm text-[#737373]">Live platform data from this instance</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/analytics" className="px-4 py-2.5 bg-[#2196F3]/10 border border-[#2196F3]/30 text-[#2196F3] text-sm rounded-lg">Full Analytics</Link>
            <button onClick={() => setShowCharts(!showCharts)} className="px-4 py-2.5 bg-[#0C8B44]/10 border border-[#0C8B44]/30 text-[#0C8B44] text-sm rounded-lg">
              {showCharts ? 'Hide' : 'Show'} Charts
            </button>
          </div>
        </div>

        {statsError && (
          <div className="mb-6 rounded-2xl border border-[#f44336]/30 bg-[#f44336]/10 p-4 text-sm text-[#f44336]">
            Unable to load admin data: {statsError}
          </div>
        )}

        {showCharts && (
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-8">
            <h2 className="text-sm font-semibold text-[#E5E5E5] mb-6 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#FF9800]" /> Real-time Metrics</h2>
            <AdminDashboardCharts />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          <Tile label="Users" value={String(s.users)} />
          <Tile label="Admins" value={String(s.admins)} />
          <Tile label="Suspended" value={String(s.suspended)} />
          <Tile label="Signups 24h" value={String(s.signups24h)} />
          <Tile label="Deposits 24h" value={String(s.deposits24h)} />
          <Tile label="Withdrawals 24h" value={String(s.withdraws24h)} />
          <Tile label="Pending deposits" value={String(s.pendingDeposits)} />
          <Tile label="KYC pending" value={String(s.kycPending)} />
          <Tile label="On hold" value={String(s.holds)} />
          <Tile label="Holdings" value={String(s.holdings)} />
          <Tile label="Trades" value={String(s.trades)} />
          <Tile label="Treasury" value={money(treasuryBalance)} />
        </div>

        {sessionStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Tile label="Active sessions" value={String(sessionStats.totalActiveSessions)} />
            <Tile label="OTP verified" value={String(sessionStats.otpVerifiedSessions)} />
            <Tile label="Expired sessions" value={String(sessionStats.expiredSessions)} />
            <Tile label="Avg session sec" value={`${sessionStats.averageSessionDuration}s`} />
          </div>
        )}

        {pendingReviewCount !== null && (
          <p className="text-sm text-[#A0A0A0] mb-6">Pending testimonials: {pendingReviewCount}</p>
        )}

        <div className="rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 px-5 py-4 mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">Admin treasury</p>
            <p className="text-3xl font-light text-[#0C8B44]">{money(treasuryBalance)}</p>
          </div>
          <button onClick={handleSeedTreasury} disabled={seedLoading} className="px-4 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg disabled:opacity-50">
            {seedLoading ? 'Seeding…' : 'Seed Treasury'}
          </button>
        </div>

        <LiveQueues />
        <AdminFeeProofsPanel />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-8">
          <Op to="/admin/users" icon={<Users className="w-5 h-5" />} label="Users" />
          <Op to="/admin/transfer" icon={<ArrowLeftRight className="w-5 h-5" />} label="Transfer" />
          <Op to="/admin/deposits" icon={<Banknote className="w-5 h-5" />} label="Deposits" />
          <Op to="/admin/broadcast" icon={<MegaphoneIcon className="w-5 h-5" />} label="Broadcast" />
          <Op to="/admin/audit" icon={<Activity className="w-5 h-5" />} label="Audit" />
          <Op to="/admin/settings" icon={<Cog className="w-5 h-5" />} label="Settings" />
          <Op to="/admin/signup-bonus" icon={<Gift className="w-5 h-5" />} label="Bonus" />
          <Op to="/admin/deposit-addresses" icon={<MapPin className="w-5 h-5" />} label="Addresses" />
          <Op to="/admin/security-events" icon={<ShieldCheck className="w-5 h-5" />} label="Security" />
          <Op to="/admin/reviews" icon={<FileCheck2 className="w-5 h-5" />} label="Reviews" />
          <Op to="/admin/analytics" icon={<BarChart3 className="w-5 h-5" />} label="Analytics" />
          <Op to="/admin/wallets" icon={<ArrowDownToLine className="w-5 h-5" />} label="Wallets" />
          <Op to="/admin/users?kycStatus=pending" icon={<Hourglass className="w-5 h-5" />} label="KYC queue" />
          <Op to="/admin/users?hold=true" icon={<AlertCircle className="w-5 h-5" />} label="Holds" />
        </div>
      </div>
    </div>
  )
}

function LiveQueues() {
  const [deposits, setDeposits] = useState<Awaited<ReturnType<typeof adminApi.listPendingDeposits>>['deposits']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    const load = () => {
      adminApi.listPendingDeposits()
        .then((r) => { if (on) setDeposits(r.deposits || []) })
        .catch(() => { if (on) setDeposits([]) })
        .finally(() => { if (on) setLoading(false) })
    }
    load()
    const t = setInterval(load, 30_000)
    return () => { on = false; clearInterval(t) }
  }, [])

  return (
    <section className="mb-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Pending deposit approvals</h2>
      {loading ? (
        <p className="text-xs text-[#737373]">Loading…</p>
      ) : deposits.length === 0 ? (
        <p className="text-xs text-[#737373]">No pending deposit requests.</p>
      ) : (
        <div className="space-y-2">
          {deposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
              <div className="min-w-0">
                <p className="text-sm text-[#E5E5E5] truncate">{d.user?.name} · {d.user?.email}</p>
                <p className="text-[11px] text-[#737373] truncate">{d.reference || 'No reference'}</p>
              </div>
              <p className="text-sm text-[#E5E5E5]">{(d.amount ?? 0).toLocaleString()} {d.currency}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#ffffff10] bg-[#0f1619]/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#737373]">{label}</p>
      <p className="text-lg font-light text-[#E5E5E5] mt-1">{value}</p>
    </div>
  )
}

function Op({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40">
      <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center text-[#0C8B44]">{icon}</div>
      <span className="text-xs font-medium text-[#E5E5E5] text-center">{label}</span>
    </Link>
  )
}
