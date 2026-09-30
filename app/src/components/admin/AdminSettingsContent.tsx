import React, { useState } from 'react'
import { Settings, Save, X } from 'lucide-react'

export function AdminSettingsContent() {
  const [settings, setSettings] = useState({
    companyName: 'Verdexis',
    maxWithdrawalAmount: 100000,
    minDepositAmount: 10,
    emailNotifications: true,
    twoFactorRequired: true,
  })

  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="space-y-6">
      {/* Platform Settings */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings size={24} />
            Platform Settings
          </h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              isEditing
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isEditing ? 'Cancel' : 'Edit Settings'}
          </button>
        </div>

        <div className="space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Platform Name</label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Max Withdrawal */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Withdrawal Amount (USD)</label>
            <input
              type="number"
              value={settings.maxWithdrawalAmount}
              onChange={(e) => setSettings({ ...settings, maxWithdrawalAmount: parseInt(e.target.value) })}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Min Deposit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Deposit Amount (USD)</label>
            <input
              type="number"
              value={settings.minDepositAmount}
              onChange={(e) => setSettings({ ...settings, minDepositAmount: parseInt(e.target.value) })}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            {[
              { key: 'emailNotifications', label: 'Email Notifications' },
              { key: 'twoFactorRequired', label: 'Require Two-Factor Authentication' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[item.key as keyof typeof settings] as boolean}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  disabled={!isEditing}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 text-green-600 disabled:opacity-50"
                />
                <span className="text-white font-medium">{item.label}</span>
              </label>
            ))}
          </div>

          {/* Save Button */}
          {isEditing && (
            <div className="flex gap-4 pt-6 border-t border-slate-700">
              <button className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition">
                <Save size={18} />
                Save Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <h3 className="text-xl font-semibold text-white mb-6">API Keys</h3>
        <p className="text-gray-400 mb-4">Manage API keys for integrations</p>
        
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition">
          Generate New API Key
        </button>

        <div className="mt-6 space-y-3">
          {[
            { name: 'Production API', created: '2024-09-15', lastUsed: '2 hours ago' },
            { name: 'Development API', created: '2024-09-01', lastUsed: '5 days ago' },
          ].map((key, i) => (
            <div key={i} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{key.name}</p>
                <p className="text-xs text-gray-500">Created: {key.created} | Last used: {key.lastUsed}</p>
              </div>
              <button className="p-2 hover:bg-red-900/30 rounded-lg transition text-gray-400 hover:text-red-400">
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
