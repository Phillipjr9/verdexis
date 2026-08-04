import { useState } from 'react'
import { Search, Filter, Bell, AlertCircle, TrendingUp, TrendingDown, CheckCircle, Clock, Eye, Download } from 'lucide-react'

export function AdminSearchBar() {
  const [query, setQuery] = useState('')
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
      <input
        type="text"
        placeholder="Search users, transactions, alerts..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
      />
    </div>
  )
}

export function AdminAlerts() {
  const alerts = [
    { id: 1, type: 'warning', title: 'High withdrawal volume', message: '5x normal withdrawal rate detected', time: '5m ago' },
    { id: 2, type: 'error', title: 'Failed KYC verification', message: '3 users failed verification', time: '15m ago' },
    { id: 3, type: 'info', title: 'New user signup spike', message: '45 new signups in last hour', time: '1h ago' },
  ]

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#E5E5E5] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#FF9800]" />
          System Alerts
        </h3>
        <span className="text-xs text-[#737373]">{alerts.length} active</span>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className={`p-3 rounded-lg border ${
            alert.type === 'error' ? 'bg-[#f44336]/10 border-[#f44336]/30' :
            alert.type === 'warning' ? 'bg-[#FF9800]/10 border-[#FF9800]/30' :
            'bg-[#2196F3]/10 border-[#2196F3]/30'
          }`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                alert.type === 'error' ? 'text-[#f44336]' :
                alert.type === 'warning' ? 'text-[#FF9800]' :
                'text-[#2196F3]'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#E5E5E5]">{alert.title}</p>
                <p className="text-xs text-[#A0A0A0] mt-1">{alert.message}</p>
                <p className="text-xs text-[#737373] mt-1">{alert.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminQuickStats() {
  const stats = [
    { label: 'Avg Response Time', value: '245ms', trend: 'down', icon: TrendingDown, color: 'green' },
    { label: 'API Success Rate', value: '99.8%', trend: 'up', icon: TrendingUp, color: 'green' },
    { label: 'Active Sessions', value: '342', trend: 'up', icon: TrendingUp, color: 'blue' },
    { label: 'Failed Logins (24h)', value: '12', trend: 'down', icon: TrendingDown, color: 'green' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div key={i} className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-2">{stat.label}</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-light text-[#E5E5E5]">{stat.value}</p>
            <stat.icon className={`w-4 h-4 ${stat.color === 'green' ? 'text-[#4CAF50]' : 'text-[#2196F3]'}`} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminExportData() {
  const exports = [
    { label: 'Users Report', format: 'CSV', size: '2.4 MB' },
    { label: 'Transactions', format: 'CSV', size: '5.1 MB' },
    { label: 'Audit Log', format: 'JSON', size: '8.7 MB' },
  ]

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
        <Download className="w-4 h-4 text-[#2196F3]" />
        Export Data
      </h3>
      <div className="space-y-2">
        {exports.map((exp, i) => (
          <button key={i} className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40 transition-colors group">
            <div className="text-left">
              <p className="text-sm text-[#E5E5E5]">{exp.label}</p>
              <p className="text-xs text-[#737373]">{exp.format} • {exp.size}</p>
            </div>
            <Download className="w-4 h-4 text-[#737373] group-hover:text-[#0C8B44]" />
          </button>
        ))}
      </div>
    </div>
  )
}

export function AdminNotifications() {
  const notifications = [
    { id: 1, title: 'New user verification', message: 'Alice Brown submitted KYC', time: '2m ago', read: false },
    { id: 2, title: 'Large transaction', message: '$50,000 withdrawal requested', time: '15m ago', read: false },
    { id: 3, title: 'System update', message: 'Database backup completed', time: '1h ago', read: true },
  ]

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#E5E5E5] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0C8B44]" />
          Notifications
        </h3>
        <span className="text-xs text-[#737373]">{notifications.filter(n => !n.read).length} unread</span>
      </div>
      <div className="space-y-2">
        {notifications.map((notif) => (
          <div key={notif.id} className={`p-3 rounded-lg border ${notif.read ? 'bg-[#1a1a1a]/30 border-[#ffffff05]' : 'bg-[#0C8B44]/10 border-[#0C8B44]/30'}`}>
            <div className="flex items-start gap-3">
              {!notif.read && <div className="w-2 h-2 rounded-full bg-[#0C8B44] mt-1.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#E5E5E5]">{notif.title}</p>
                <p className="text-xs text-[#A0A0A0] mt-1">{notif.message}</p>
                <p className="text-xs text-[#737373] mt-1">{notif.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminPerformanceMetrics() {
  const metrics = [
    { label: 'Database Query Time', value: '45ms', status: 'healthy' },
    { label: 'Cache Hit Rate', value: '94.2%', status: 'healthy' },
    { label: 'Memory Usage', value: '62%', status: 'healthy' },
    { label: 'Disk Usage', value: '78%', status: 'warning' },
  ]

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-4">Performance Metrics</h3>
      <div className="space-y-3">
        {metrics.map((metric, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#A0A0A0]">{metric.label}</span>
              <span className="text-sm font-medium text-[#E5E5E5]">{metric.value}</span>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className={`h-full ${metric.status === 'healthy' ? 'bg-[#4CAF50]' : 'bg-[#FF9800]'}`} style={{ width: metric.value }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminUserActivity() {
  const activities = [
    { user: 'John Doe', action: 'Logged in', time: '2m ago', icon: Eye },
    { user: 'Jane Smith', action: 'Placed trade', time: '5m ago', icon: TrendingUp },
    { user: 'Bob Johnson', action: 'Withdrew funds', time: '12m ago', icon: TrendingDown },
    { user: 'Alice Brown', action: 'Updated profile', time: '25m ago', icon: CheckCircle },
  ]

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h3 className="text-sm font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#2196F3]" />
        User Activity
      </h3>
      <div className="space-y-3">
        {activities.map((activity, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a]/50 border border-[#ffffff05]">
            <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[#0C8B44]">
              <activity.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#E5E5E5]">{activity.user}</p>
              <p className="text-xs text-[#737373]">{activity.action}</p>
            </div>
            <p className="text-xs text-[#737373] shrink-0">{activity.time}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
