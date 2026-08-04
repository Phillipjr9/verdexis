import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import Navigation from '../components/Navigation'
import { adminApi, type AdminStats } from '../lib/adminApi'
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, AlertCircle, RefreshCw, Download } from 'lucide-react'

interface TimeSeriesData {
  timestamp: string
  users: number
  deposits: number
  withdrawals: number
  trades: number
  kycPending: number
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchStats = async () => {
    try {
      const data = await adminApi.stats()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchStats()
    setIsRefreshing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#737373]">Loading analytics...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="p-4 rounded-xl bg-[#f44336]/10 border border-[#f44336]/30 text-sm text-[#f44336]">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Failed to load analytics data
          </div>
        </div>
      </div>
    )
  }

  const s = stats.stats

  // Generate mock time series data for demonstration
  const generateTimeSeriesData = (): TimeSeriesData[] => {
    const data: TimeSeriesData[] = []
    const now = new Date()
    const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30
    const interval = timeRange === '24h' ? 3600000 : timeRange === '7d' ? 86400000 : 86400000

    for (let i = points - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * interval)
      data.push({
        timestamp: timeRange === '24h' ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : time.toLocaleDateString(),
        users: Math.floor(s.users * (0.8 + Math.random() * 0.4)),
        deposits: Math.floor(s.deposits24h * (0.5 + Math.random() * 1.5)),
        withdrawals: Math.floor(s.withdraws24h * (0.5 + Math.random() * 1.5)),
        trades: Math.floor(s.trades * (0.6 + Math.random() * 0.8)),
        kycPending: Math.floor(s.kycPending * (0.7 + Math.random() * 0.6)),
      })
    }
    return data
  }

  const timeSeriesData = generateTimeSeriesData()

  const userDistribution = [
    { name: 'Active', value: s.users - s.suspended, fill: '#0C8B44' },
    { name: 'Suspended', value: s.suspended, fill: '#f44336' },
  ]

  const complianceBreakdown = [
    { name: 'KYC Pending', value: s.kycPending, fill: '#FF9800' },
    { name: 'On Hold', value: s.holds, fill: '#f44336' },
    { name: 'Compliant', value: Math.max(0, s.users - s.kycPending - s.holds), fill: '#4CAF50' },
  ]

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-[#E5E5E5]\">Analytics</h1>
            <p className="text-xs text-[#737373] mt-1\">Platform performance and user metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#0f1619]/50 border border-[#ffffff08] rounded-lg p-1">
              {(['24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${
                    timeRange === range
                      ? 'bg-[#0C8B44] text-white'
                      : 'text-[#A0A0A0] hover:text-[#E5E5E5]'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-[#ffffff10] text-[#737373] hover:text-[#0C8B44] hover:border-[#0C8B44]/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button className="p-2 rounded-lg border border-[#ffffff10] text-[#737373] hover:text-[#0C8B44] hover:border-[#0C8B44]/40 transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <AnalyticsCard
            icon={<Users className="w-5 h-5" />}
            label="Total Users"
            value={s.users}
            change={s.signups24h}
            changeLabel="new (24h)"
            color="#0C8B44"
          />
          <AnalyticsCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Deposits (24h)"
            value={s.deposits24h}
            change={s.withdraws24h}
            changeLabel="withdrawals"
            color="#4CAF50"
            negative
          />
          <AnalyticsCard
            icon={<Activity className="w-5 h-5" />}
            label="Total Trades"
            value={s.trades}
            change={s.holdings}
            changeLabel="holdings"
            color="#2196F3"
          />
          <AnalyticsCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Compliance Issues"
            value={s.kycPending + s.holds}
            change={s.pendingDeposits}
            changeLabel="pending deposits"
            color="#FF9800"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* User Growth Trend */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">User Growth Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="timestamp" stroke="#737373" style={{ fontSize: '12px' }} />
                <YAxis stroke="#737373" />
                <Tooltip
                  contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  labelStyle={{ color: '#E5E5E5' }}
                />
                <Line type="monotone" dataKey="users" stroke="#0C8B44" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Transaction Volume */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Transaction Volume</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="timestamp" stroke="#737373" style={{ fontSize: '12px' }} />
                <YAxis stroke="#737373" />
                <Tooltip
                  contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  labelStyle={{ color: '#E5E5E5' }}
                />
                <Legend />
                <Bar dataKey="deposits" fill="#4CAF50" name="Deposits" />
                <Bar dataKey="withdrawals" fill="#f44336" name="Withdrawals" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* User Distribution */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">User Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={userDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {userDistribution.map((entry, index) => (
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

          {/* Compliance Status */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Compliance Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={complianceBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {complianceBreakdown.map((entry, index) => (
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

          {/* Trading Activity */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Trading Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="timestamp" stroke="#737373" style={{ fontSize: '12px' }} />
                <YAxis stroke="#737373" />
                <Tooltip
                  contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  labelStyle={{ color: '#E5E5E5' }}
                />
                <Bar dataKey="trades" fill="#2196F3" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* KYC Pipeline */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">KYC Pipeline</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="timestamp" stroke="#737373" style={{ fontSize: '12px' }} />
                <YAxis stroke="#737373" />
                <Tooltip
                  contentStyle={{ background: '#0a0f11', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  labelStyle={{ color: '#E5E5E5' }}
                />
                <Line type="monotone" dataKey="kycPending" stroke="#FF9800" strokeWidth={2} dot={false} name="Pending KYC" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryItem label="Total Users" value={s.users} />
            <SummaryItem label="Admins" value={s.admins} />
            <SummaryItem label="Suspended" value={s.suspended} accent="red" />
            <SummaryItem label="Holdings" value={s.holdings} />
            <SummaryItem label="Trades" value={s.trades} />
            <SummaryItem label="Alerts" value={s.alerts} />
            <SummaryItem label="Deposits (24h)" value={s.deposits24h} accent="green" />
            <SummaryItem label="Withdrawals (24h)" value={s.withdraws24h} accent="red" />
            <SummaryItem label="Signups (24h)" value={s.signups24h} accent="green" />
            <SummaryItem label="KYC Pending" value={s.kycPending} accent="orange" />
            <SummaryItem label="On Hold" value={s.holds} accent="orange" />
            <SummaryItem label="Pending Deposits" value={s.pendingDeposits} accent="orange" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsCard({
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

function SummaryItem({
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
