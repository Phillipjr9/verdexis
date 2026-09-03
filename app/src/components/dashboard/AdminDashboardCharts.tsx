import { useEffect, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { adminApi, type AdminStats } from '../../lib/adminApi'
import { TrendingUp, Users, DollarSign, Activity, AlertCircle } from 'lucide-react'

function n(v: unknown): number {
  if (v == null || v === '') return 0
  const x = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmt(v: unknown): string {
  try {
    return n(v).toLocaleString()
  } catch {
    return String(n(v))
  }
}

/** Recharts tick/tooltip formatter — never assumes value is a number. */
function chartFmt(v: unknown): string {
  return fmt(v)
}

interface ChartData {
  stats: AdminStats | null
  loading: boolean
  error: string | null
}

export function AdminDashboardCharts() {
  const [data, setData] = useState<ChartData>({ stats: null, loading: true, error: null })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const payload = await adminApi.stats() as AdminStats & Record<string, unknown>
        // Accept nested { stats: {...} } or flat stats object
        const nested = payload?.stats
        const looksFlat = nested == null && typeof (payload as { users?: unknown }).users === 'number'
        const normalized: AdminStats = looksFlat
          ? {
              stats: {
                users: n((payload as { users?: unknown }).users),
                admins: n((payload as { admins?: unknown }).admins),
                suspended: n((payload as { suspended?: unknown }).suspended),
                holdings: n((payload as { holdings?: unknown }).holdings),
                trades: n((payload as { trades?: unknown }).trades),
                alerts: n((payload as { alerts?: unknown }).alerts),
                deposits24h: n((payload as { deposits24h?: unknown }).deposits24h),
                signups24h: n((payload as { signups24h?: unknown }).signups24h),
                holds: n((payload as { holds?: unknown }).holds),
                kycPending: n((payload as { kycPending?: unknown }).kycPending),
                withdraws24h: n((payload as { withdraws24h?: unknown }).withdraws24h),
                pendingDeposits: n((payload as { pendingDeposits?: unknown }).pendingDeposits),
              },
              lastBroadcast: null,
              recentSignups: [],
              recentTx: [],
            }
          : {
              stats: {
                users: n(nested?.users),
                admins: n(nested?.admins),
                suspended: n(nested?.suspended),
                holdings: n(nested?.holdings),
                trades: n(nested?.trades),
                alerts: n(nested?.alerts),
                deposits24h: n(nested?.deposits24h),
                signups24h: n(nested?.signups24h),
                holds: n(nested?.holds),
                kycPending: n(nested?.kycPending),
                withdraws24h: n(nested?.withdraws24h),
                pendingDeposits: n(nested?.pendingDeposits),
              },
              lastBroadcast: payload.lastBroadcast ?? null,
              recentSignups: payload.recentSignups ?? [],
              recentTx: payload.recentTx ?? [],
            }
        setData({ stats: normalized, loading: false, error: null })
      } catch (err) {
        const reason = err as { error?: string; status?: number; message?: string }
        setData({
          stats: null,
          loading: false,
          error: reason?.error || reason?.message || 'Failed to load stats',
        })
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  if (data.loading) {
    return <div className="h-32 bg-[#0f1619]/50 border border-[#ffffff08] rounded-xl animate-pulse mb-8" />
  }

  if (data.error) {
    return (
      <div className="p-4 rounded-xl bg-[#ffffff08] border border-[#ffffff10] text-sm text-[#A0A0A0] mb-8">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        {data.error}
      </div>
    )
  }

  const raw = data.stats?.stats
  if (!raw) {
    return (
      <div className="p-4 rounded-xl bg-[#ffffff08] border border-[#ffffff10] text-sm text-[#A0A0A0] mb-8">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        No chart data — stats API returned an empty payload. Refresh or check /api/admin/stats.
      </div>
    )
  }

  const stats = {
    users: n(raw.users), admins: n(raw.admins), suspended: n(raw.suspended),
    holdings: n(raw.holdings), trades: n(raw.trades), alerts: n(raw.alerts),
    deposits24h: n(raw.deposits24h), signups24h: n(raw.signups24h),
    holds: n(raw.holds), kycPending: n(raw.kycPending),
    withdraws24h: n(raw.withdraws24h), pendingDeposits: n(raw.pendingDeposits),
  }

  const userGrowthData = [
    { name: 'Total', value: stats.users },
    { name: 'Admins', value: stats.admins },
    { name: 'Suspended', value: stats.suspended },
  ]
  const activityData = [
    { name: 'Holdings', value: stats.holdings, fill: '#0C8B44' },
    { name: 'Trades', value: stats.trades, fill: '#2196F3' },
    { name: 'Alerts', value: stats.alerts, fill: '#FF9800' },
  ]
  const volumeData = [
    { name: 'Deposits 24h', value: stats.deposits24h },
    { name: 'Withdraw 24h', value: stats.withdraws24h },
    { name: 'Pending', value: stats.pendingDeposits },
    { name: 'Signups 24h', value: stats.signups24h },
  ]
  const statusData = [
    { name: 'KYC pending', value: stats.kycPending },
    { name: 'On hold', value: stats.holds },
    { name: 'Suspended', value: stats.suspended },
  ].filter((d) => d.value > 0)

  const COLORS = ['#0C8B44', '#2196F3', '#FF9800', '#f44336', '#9C27B0']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="rounded-xl border border-[#ffffff10] bg-[#0f1619]/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-[#0C8B44]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Users</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={userGrowthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 11 }} />
            <YAxis tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={chartFmt} />
            <Tooltip formatter={(v) => chartFmt(v)} contentStyle={{ background: '#0f1619', border: '1px solid #ffffff20' }} />
            <Bar dataKey="value" fill="#0C8B44" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-[#ffffff10] bg-[#0f1619]/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#2196F3]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Activity</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 11 }} />
            <YAxis tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={chartFmt} />
            <Tooltip formatter={(v) => chartFmt(v)} contentStyle={{ background: '#0f1619', border: '1px solid #ffffff20' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {activityData.map((entry, i) => (
                <Cell key={entry.name} fill={entry.fill || COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-[#ffffff10] bg-[#0f1619]/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-[#FF9800]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">24h volume signals</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={volumeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 11 }} />
            <YAxis tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={chartFmt} />
            <Tooltip formatter={(v) => chartFmt(v)} contentStyle={{ background: '#0f1619', border: '1px solid #ffffff20' }} />
            <Bar dataKey="value" fill="#FF9800" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-[#ffffff10] bg-[#0f1619]/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#9C27B0]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Risk / compliance</h3>
        </div>
        {statusData.length === 0 ? (
          <p className="text-xs text-[#737373] py-16 text-center">No pending KYC, holds, or suspensions</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${fmt(value)}`}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => chartFmt(v)} contentStyle={{ background: '#0f1619', border: '1px solid #ffffff20' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
