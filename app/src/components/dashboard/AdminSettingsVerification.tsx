import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Clock, Save, RefreshCw, Eye, EyeOff, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface AdminSetting {
  id: string
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  category: 'fees' | 'wallet' | 'bank' | 'security' | 'general'
  lastModified: string
  modifiedBy: string
  verified: boolean
  verificationStatus: 'pending' | 'verified' | 'failed'
  verificationTimestamp?: string
}

interface SettingsSaveLog {
  id: string
  settingKey: string
  oldValue: string
  newValue: string
  status: 'success' | 'failed'
  timestamp: string
  adminId: string
  adminEmail: string
  errorMessage?: string
}

export function AdminSettingsVerification() {
  const [settings, setSettings] = useState<AdminSetting[]>([])
  const [saveLogs, setSaveLogs] = useState<SettingsSaveLog[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('verdexis_token')}`,
        },
      })
      const data = await response.json()
      setSettings(data.settings || [])
      setSaveLogs(data.logs || [])
    } catch (error) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const verifySetting = async (settingId: string) => {
    setVerifying(true)
    try {
      const response = await fetch(`/api/admin/settings/${settingId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('verdexis_token')}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json()
      if (data.verified) {
        toast.success('Setting verified successfully')
        loadSettings()
      } else {
        toast.error('Verification failed: ' + data.error)
      }
    } catch (error) {
      toast.error('Verification error')
    } finally {
      setVerifying(false)
    }
  }

  const verifyAllSettings = async () => {
    setVerifying(true)
    try {
      const response = await fetch('/api/admin/settings/verify-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('verdexis_token')}`,
        },
      })
      const data = await response.json()
      toast.success(`${data.verified} settings verified, ${data.failed} failed`)
      loadSettings()
    } catch (error) {
      toast.error('Batch verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = []
    acc[setting.category].push(setting)
    return acc
  }, {} as Record<string, AdminSetting[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-[#E5E5E5]">Settings Verification</h2>
          <p className="text-xs text-[#737373] mt-1">Monitor and verify all admin configurations</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={verifyAllSettings}
            disabled={verifying}
            className="px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {verifying ? 'Verifying...' : 'Verify All'}
          </button>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-4 py-2.5 bg-[#2196F3]/10 border border-[#2196F3]/30 text-[#2196F3] text-sm font-medium rounded-lg hover:bg-[#2196F3]/20 transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            {showLogs ? 'Hide' : 'Show'} Logs
          </button>
        </div>
      </div>

      {/* Settings by Category */}
      {loading ? (
        <div className="text-center py-12 text-[#737373]">Loading settings...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSettings).map(([category, categorySettings]) => (
            <SettingsCategoryCard
              key={category}
              category={category}
              settings={categorySettings}
              onVerify={verifySetting}
              verifying={verifying}
            />
          ))}
        </div>
      )}

      {/* Save Logs */}
      {showLogs && (
        <SettingsSaveLogsPanel logs={saveLogs} />
      )}

      {/* Verification Summary */}
      <VerificationSummary settings={settings} />
    </div>
  )
}

function SettingsCategoryCard({
  category,
  settings,
  onVerify,
  verifying,
}: {
  category: string
  settings: AdminSetting[]
  onVerify: (id: string) => void
  verifying: boolean
}) {
  const categoryIcons: Record<string, React.ReactNode> = {
    fees: '💰',
    wallet: '👛',
    bank: '🏦',
    security: '🔒',
    general: '⚙️',
  }

  const verifiedCount = settings.filter(s => s.verified).length
  const failedCount = settings.filter(s => s.verificationStatus === 'failed').length

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{categoryIcons[category] || '⚙️'}</span>
          <div>
            <h3 className="text-lg font-semibold text-[#E5E5E5] capitalize">{category}</h3>
            <p className="text-xs text-[#737373]">{verifiedCount} verified, {failedCount} failed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <span className="px-2.5 py-1 bg-[#f44336]/15 text-[#f44336] text-xs rounded-full">
              {failedCount} failed
            </span>
          )}
          {verifiedCount === settings.length && (
            <span className="px-2.5 py-1 bg-[#4CAF50]/15 text-[#4CAF50] text-xs rounded-full">
              All verified
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {settings.map((setting) => (
          <SettingItem
            key={setting.id}
            setting={setting}
            onVerify={() => onVerify(setting.id)}
            verifying={verifying}
          />
        ))}
      </div>
    </div>
  )
}

function SettingItem({
  setting,
  onVerify,
  verifying,
}: {
  setting: AdminSetting
  onVerify: () => void
  verifying: boolean
}) {
  const [showValue, setShowValue] = useState(false)
  const [copied, setCopied] = useState(false)

  const statusColor =
    setting.verificationStatus === 'verified'
      ? 'text-[#4CAF50]'
      : setting.verificationStatus === 'failed'
        ? 'text-[#f44336]'
        : 'text-[#FF9800]'

  const statusBg =
    setting.verificationStatus === 'verified'
      ? 'bg-[#4CAF50]/10'
      : setting.verificationStatus === 'failed'
        ? 'bg-[#f44336]/10'
        : 'bg-[#FF9800]/10'

  const copyToClipboard = () => {
    navigator.clipboard.writeText(setting.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-medium text-[#E5E5E5]">{setting.key}</p>
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${statusBg} ${statusColor}`}>
            {setting.verificationStatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-[#737373]">
            {showValue ? setting.value : '••••••••'}
          </p>
          <button
            onClick={() => setShowValue(!showValue)}
            className="text-[#737373] hover:text-[#0C8B44]"
          >
            {showValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={copyToClipboard}
            className="text-[#737373] hover:text-[#0C8B44]"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[10px] text-[#737373] mt-1">
          Modified {new Date(setting.lastModified).toLocaleDateString()} by {setting.modifiedBy}
        </p>
      </div>
      <button
        onClick={onVerify}
        disabled={verifying}
        className="ml-4 px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] transition-colors disabled:opacity-50"
      >
        Verify
      </button>
    </div>
  )
}

function SettingsSaveLogsPanel({ logs }: { logs: SettingsSaveLog[] }) {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')

  const filteredLogs = logs.filter(log => filter === 'all' || log.status === filter)

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E5E5E5]">Save History</h3>
        <div className="flex items-center gap-2">
          {['all', 'success', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[#0C8B44] text-white'
                  : 'bg-[#1a1a1a]/50 text-[#A0A0A0] hover:text-[#E5E5E5]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <p className="text-xs text-[#737373] text-center py-4">No logs found</p>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg border ${
                log.status === 'success'
                  ? 'bg-[#4CAF50]/10 border-[#4CAF50]/30'
                  : 'bg-[#f44336]/10 border-[#f44336]/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E5E5E5]">{log.settingKey}</p>
                  <p className="text-xs text-[#737373] mt-1">
                    {log.oldValue} → {log.newValue}
                  </p>
                  <p className="text-[10px] text-[#737373] mt-1">
                    {log.adminEmail} • {new Date(log.timestamp).toLocaleString()}
                  </p>
                  {log.errorMessage && (
                    <p className="text-[10px] text-[#f44336] mt-1">{log.errorMessage}</p>
                  )}
                </div>
                <span
                  className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                    log.status === 'success'
                      ? 'bg-[#4CAF50]/20 text-[#4CAF50]'
                      : 'bg-[#f44336]/20 text-[#f44336]'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function VerificationSummary({ settings }: { settings: AdminSetting[] }) {
  const total = settings.length
  const verified = settings.filter(s => s.verified).length
  const failed = settings.filter(s => s.verificationStatus === 'failed').length
  const pending = settings.filter(s => s.verificationStatus === 'pending').length

  const verificationRate = total > 0 ? Math.round((verified / total) * 100) : 0

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/20 to-[#0C8B44]/5 border border-[#0C8B44]/30 p-6">
      <h3 className="text-lg font-semibold text-[#E5E5E5] mb-4">Verification Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Settings" value={total} color="blue" />
        <SummaryCard label="Verified" value={verified} color="green" />
        <SummaryCard label="Pending" value={pending} color="orange" />
        <SummaryCard label="Failed" value={failed} color="red" />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#A0A0A0]">Verification Rate</span>
          <span className="text-sm font-medium text-[#0C8B44]">{verificationRate}%</span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0C8B44] transition-all duration-300"
            style={{ width: `${verificationRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClass =
    color === 'green'
      ? 'text-[#4CAF50]'
      : color === 'red'
        ? 'text-[#f44336]'
        : color === 'orange'
          ? 'text-[#FF9800]'
          : 'text-[#2196F3]'

  return (
    <div className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-2">{label}</p>
      <p className={`text-2xl font-light ${colorClass}`}>{value}</p>
    </div>
  )
}
