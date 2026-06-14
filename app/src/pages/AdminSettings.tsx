import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowLeft, Settings, Save } from 'lucide-react'
import { Toaster, toast } from 'sonner'

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    tradingFeeRate: 0.1,
    minDepositUSD: 100,
    maxDepositUSD: 100000,
    withdrawalLockDays: 0,
    enableTwoFA: true,
    enableKYC: true,
  })

  const handleSave = () => {
    toast.success('Settings saved successfully')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <Toaster position="top-right" theme="dark" richColors />

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <Link to="/admin/deposits" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to admin
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5]">Admin Settings</h1>
            <p className="text-xs text-[#737373]">Configure platform-wide parameters</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-lg font-medium text-[#E5E5E5] mb-4">Trading</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Trading Fee Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.tradingFeeRate}
                  onChange={(e) => setSettings({ ...settings, tradingFeeRate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                />
                <p className="text-[11px] text-[#737373] mt-1">Applied to every trade</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-lg font-medium text-[#E5E5E5] mb-4">Deposits & Withdrawals</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Min Deposit (USD)</label>
                <input
                  type="number"
                  value={settings.minDepositUSD}
                  onChange={(e) => setSettings({ ...settings, minDepositUSD: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Max Deposit (USD)</label>
                <input
                  type="number"
                  value={settings.maxDepositUSD}
                  onChange={(e) => setSettings({ ...settings, maxDepositUSD: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Withdrawal Lock (Days)</label>
                <input
                  type="number"
                  value={settings.withdrawalLockDays}
                  onChange={(e) => setSettings({ ...settings, withdrawalLockDays: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-lg font-medium text-[#E5E5E5] mb-4">Security</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableTwoFA}
                  onChange={(e) => setSettings({ ...settings, enableTwoFA: e.target.checked })}
                  className="w-4 h-4 accent-[#0C8B44]"
                />
                <span className="text-sm text-[#E5E5E5]">Require 2FA for all users</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableKYC}
                  onChange={(e) => setSettings({ ...settings, enableKYC: e.target.checked })}
                  className="w-4 h-4 accent-[#0C8B44]"
                />
                <span className="text-sm text-[#E5E5E5]">Require KYC verification</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-lg font-medium text-[#E5E5E5] mb-4">Actions</h2>
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
