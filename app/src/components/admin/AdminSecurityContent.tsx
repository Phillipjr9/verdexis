import React from 'react'
import { AlertTriangle, Lock, Shield, CheckCircle } from 'lucide-react'

export function AdminSecurityContent() {
  return (
    <div className="space-y-6">
      {/* Security Events */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Shield size={24} className="text-green-400" />
          Recent Security Events
        </h3>

        <div className="space-y-4">
          {[
            { event: 'Failed login attempt', user: 'john@example.com', severity: 'medium', time: '2 hours ago' },
            { event: 'IP address changed', user: 'jane@example.com', severity: 'low', time: '4 hours ago' },
            { event: '2FA disabled', user: 'bob@example.com', severity: 'high', time: '1 day ago' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div>
                <p className="text-white font-medium">{item.event}</p>
                <p className="text-sm text-gray-400">{item.user}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  item.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                  item.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {item.severity === 'high' && <AlertTriangle size={14} />}
                  {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                </span>
                <span className="text-sm text-gray-500 min-w-24 text-right">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <CheckCircle size={24} className="text-blue-400" />
          Audit Log
        </h3>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {[
            { action: 'Admin login', admin: 'admin@verdexis.com', date: '2024-09-30 14:23' },
            { action: 'User suspended', admin: 'admin@verdexis.com', date: '2024-09-30 13:45' },
            { action: 'KYC verified', admin: 'admin@verdexis.com', date: '2024-09-30 12:30' },
            { action: 'Deposit approved', admin: 'admin@verdexis.com', date: '2024-09-30 11:15' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3 px-4 hover:bg-slate-800/30 rounded transition border-b border-slate-800 last:border-b-0">
              <div>
                <p className="text-white font-medium text-sm">{item.action}</p>
                <p className="text-xs text-gray-500">{item.admin}</p>
              </div>
              <span className="text-xs text-gray-400">{item.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Lock size={24} className="text-purple-400" />
          Security Settings
        </h3>

        <div className="space-y-4">
          {[
            { setting: 'Two-Factor Authentication', status: 'enabled' },
            { setting: 'IP Whitelist', status: 'enabled' },
            { setting: 'API Rate Limiting', status: 'enabled' },
            { setting: 'Withdrawal Limits', status: 'enabled' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-white font-medium">{item.setting}</p>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                <CheckCircle size={14} />
                {item.status === 'enabled' ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
