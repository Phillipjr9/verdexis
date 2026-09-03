import { useEffect, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { adminApi, type AdminStats } from '../../lib/adminApi'
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, AlertCircle } from 'lucide-react'

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmt(v: unknown) {
  return n(v).toLocaleString()
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
        const stats = await adminApi.stats()
        setData({ stats, loading: false, error: null })
      } catch (err) {
        const reason = err as { error?: string; status?: number }
        setData({ stats: null, loading: false, error: reason?.error || 'Failed to load stats' })
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  if (data.loading) {
    return <div className="h-32 bg-[#0f1619]/50 border border-[#ffffff08] rounded-xl animate-pulse mb-8" />
  }

  const raw = data.stats?.stats
  if (data.error || !raw) {
    return (
      <div className="p-4 rounded-xl bg-[#ffffff08] border border-[#ffffff10] text-sm text-[#A0A0A0] mb-8">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        {data.error || 'No chart data'}
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<Users className="w-5 h-5" />} label="Total Users" value={stats.users} change={stats.signups24h} changeLabel="signups (24h)" color="#0C8B44" />
        <KPICard icon={<Activity className="w-5 h-5" />} label="Active Holdings" value={stats.holdings} change={stats.trades} changeLabel="trades" color="#2196F3" />
        <KPICard icon={<DollarSign className="w-5 h-5" />} label="Deposits (24h)" value={stats.deposits24h} change={stats.withdraws24h} changeLabel="withdrawals" color="#4CAF50" />
        <KPICard icon={<AlertCircle className="w-5 h-5" />} label="Pending Review" value={stats.kycPending + stats.holds} change={stats.pendingDeposits} changeLabel="pending deposits" color="#FF9800" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">User Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#737373" />
              <YAxis stroke="#737373" />
              <Tooltip contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10' }} />
              <Bar dataKey="value" fill="#0C8B44" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Activity Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={activityData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${n(value)}`}>
                {activityData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, change, changeLabel, color }: { icon: React.ReactNode; label: string; value: number; change: number; changeLabel: string; color: string }) {
  return (
    <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}1f` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#4CAF50]">
          <TrendingUp className="w-3 h-3" />{n(change)}
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{label}</p>
      <p className="text-2xl font-light text-[#E5E5E5]">{fmt(value)}</p>
      <p className="text-[10px] text-[#737373] mt-1">{changeLabel}</p>
    </div>
  )
}
