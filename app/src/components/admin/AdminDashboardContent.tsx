import React from 'react'
import { BarChart3, Users, TrendingUp, AlertCircle } from 'lucide-react'

export function AdminDashboardContent() {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Users', value: '1,234', change: '+12%', icon: Users, color: 'blue' },
          { label: 'Active Users', value: '856', change: '+8%', icon: TrendingUp, color: 'green' },
          { label: 'Total Deposits', value: '$2.5M', change: '+24%', icon: BarChart3, color: 'purple' },
          { label: 'Pending Withdrawals', value: '23', change: '+5', icon: AlertCircle, color: 'orange' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
                <p className={`text-xs mt-2 ${stat.color === 'green' ? 'text-green-400' : 'text-gray-400'}`}>
                  {stat.change}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                stat.color === 'green' ? 'bg-green-500/20' :
                stat.color === 'blue' ? 'bg-blue-500/20' :
                stat.color === 'purple' ? 'bg-purple-500/20' :
                'bg-orange-500/20'
              }`}>
                <stat.icon className={`${
                  stat.color === 'green' ? 'text-green-400' :
                  stat.color === 'blue' ? 'text-blue-400' :
                  stat.color === 'purple' ? 'text-purple-400' :
                  'text-orange-400'
                }`} size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[
            { action: 'User KYC approved', user: 'john@example.com', time: '2 hours ago' },
            { action: 'Deposit confirmed', user: 'jane@example.com', time: '4 hours ago' },
            { action: 'Withdrawal processed', user: 'bob@example.com', time: '1 day ago' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-b-0">
              <div>
                <p className="text-white font-medium">{item.action}</p>
                <p className="text-sm text-gray-400">{item.user}</p>
              </div>
              <p className="text-xs text-gray-500">{item.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
