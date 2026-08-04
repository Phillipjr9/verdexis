import { useEffect, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { adminApi, type AdminStats } from '../../lib/adminApi'
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, AlertCircle } from 'lucide-react'

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
        setData({ stats: null, loading: false, error: (err as { error?: string }).error || 'Failed to load stats' })
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  if (data.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-[#0f1619]/50 border border-[#ffffff08] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (data.error || !data.stats) {
    return (
      <div className="p-4 rounded-xl bg-[#f44336]/10 border border-[#f44336]/30 text-sm text-[#f44336] mb-8">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        {data.error || 'Unable to load dashboard data'}
      </div>
    )
  }

  const stats = data.stats.stats

  // Prepare chart data
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

  const transactionData = [
    { name: 'Deposits (24h)', value: stats.deposits24h, fill: '#4CAF50' },
    { name: 'Withdrawals (24h)', value: stats.withdraws24h, fill: '#f44336' },
    { name: 'Pending', value: stats.pendingDeposits, fill: '#FFC107' },
  ]

  const kycData = [
    { name: 'Pending', value: stats.kycPending, fill: '#FF9800' },
    { name: 'On Hold', value: stats.holds, fill: '#f44336' },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<Users className="w-5 h-5" />}
          label="Total Users"
          value={stats.users}
          change={stats.signups24h}
          changeLabel="signups (24h)"
          color="#0C8B44"
        />
        <KPICard
          icon={<Activity className="w-5 h-5" />}
          label="Active Holdings"
          value={stats.holdings}
          change={stats.trades}
          changeLabel="trades"
          color="#2196F3"
        />
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="Deposits (24h)"
          value={stats.deposits24h}
          change={stats.withdraws24h}
          changeLabel="withdrawals"
          color="#4CAF50"
          negative
        />
        <KPICard
          icon={<AlertCircle className="w-5 h-5" />}
          label="Pending Review"
          value={stats.kycPending + stats.holds}
          change={stats.pendingDeposits}
          changeLabel="pending deposits"
          color="#FF9800"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Distribution */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">User Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#737373" />
              <YAxis stroke="#737373" />
              <Tooltip
                contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                labelStyle={{ color: '#E5E5E5' }}
              />
              <Bar dataKey="value" fill="#0C8B44" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Overview */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Activity Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={activityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {activityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                labelStyle={{ color: '#E5E5E5' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Flow */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Transaction Flow (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={transactionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#737373" />
              <YAxis stroke="#737373" />
              <Tooltip
                contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                labelStyle={{ color: '#E5E5E5' }}
              />
              <Area type="monotone" dataKey="value" fill="#0C8B44" stroke="#0C8B44" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance Status */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Compliance Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={kycData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#737373" />
              <YAxis stroke="#737373" />
              <Tooltip
                contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                labelStyle={{ color: '#E5E5E5' }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {kycData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
        <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Detailed Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatItem label="Total Users" value={stats.users} />
          <StatItem label="Admins" value={stats.admins} />
          <StatItem label="Suspended" value={stats.suspended} accent="red" />
          <StatItem label="Holdings" value={stats.holdings} />
          <StatItem label="Trades" value={stats.trades} />
          <StatItem label="Alerts" value={stats.alerts} />
          <StatItem label="Deposits (24h)" value={stats.deposits24h} accent="green" />
          <StatItem label="Withdrawals (24h)" value={stats.withdraws24h} accent="red" />
          <StatItem label="Signups (24h)" value={stats.signups24h} accent="green" />
          <StatItem label="KYC Pending" value={stats.kycPending} accent="orange" />
          <StatItem label="On Hold" value={stats.holds} accent="orange" />
          <StatItem label="Pending Deposits" value={stats.pendingDeposits} accent="orange" />
        </div>
      </div>
    </div>
  )
}

function KPICard({
  icon,
  label,
  value,
  change,
  changeLabel,
  color,
  negative = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  change: number
  changeLabel: string
  color: string
  negative?: boolean
}) {
  const isPositive = !negative || change >= 0
  return (
    <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 hover:border-[#0C8B44]/40 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}1f` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{label}</p>
      <p className="text-2xl font-light text-[#E5E5E5]">{value.toLocaleString()}</p>
      <p className="text-[10px] text-[#737373] mt-1">{changeLabel}</p>
    </div>
  )
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'red' | 'green' | 'orange'
}) {
  const colorClass =
    accent === 'red' ? 'text-[#f44336]' : accent === 'green' ? 'text-[#4CAF50]' : accent === 'orange' ? 'text-[#FF9800]' : 'text-[#E5E5E5]'
  return (
    <div className="p-3 rounded-lg bg-[#1a1a1a]/50 border border-[#ffffff05]">
      <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{label}</p>
      <p className={`text-lg font-light ${colorClass}`}>{value.toLocaleString()}</p>
    </div>
  )
}
