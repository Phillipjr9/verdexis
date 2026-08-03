import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Clock, Save, RefreshCw, Eye, EyeOff, Copy, Download, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'

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
  const [summary, setSummary] = useState<any>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    loadSettings()
    loadSummary()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getAllSettings()
      setSettings(data.settings || [])
      setSaveLogs(data.logs || [])
    } catch (error) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    try {
      const data = await adminApi.getSettingsSummary()
      setSummary(data)
    } catch (error) {
      console.error('Failed to load summary:', error)
    }
  }

  const verifySetting = async (settingId: string) => {
    setVerifying(true)
    try {
      const data = await adminApi.verifySetting(settingId)
      if (data.verified) {
        toast.success('Setting verified successfully')
        loadSettings()
        loadSummary()
      } else {
        toast.error('Verification failed: ' + (data.error || 'Unknown error'))
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
      const data = await adminApi.verifyAllSettings()
      toast.success(`${data.verified} settings verified, ${data.failed} failed`)
      loadSettings()
      loadSummary()
    } catch (error) {
      toast.error('Batch verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const saveSetting = async (key: string, value: string) => {
    try {
      await adminApi.saveSetting(key, value)
      toast.success('Setting saved successfully')
      setEditingId(null)
      setEditValue('')
      loadSettings()
      loadSummary()
    } catch (error: any) {
      toast.error(error.error || 'Failed to save setting')
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
          <button
            onClick={loadSettings}
            className="px-4 py-2.5 bg-[#737373]/10 border border-[#737373]/30 text-[#737373] text-sm font-medium rounded-lg hover:bg-[#737373]/20 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Verification Summary */}
      {summary && <VerificationSummary summary={summary} />}

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
              onEdit={(id, value) => {
                setEditingId(id)
                setEditValue(value)
              }}
              onSave={saveSetting}
              editingId={editingId}
              editValue={editValue}
              setEditValue={setEditValue}
              verifying={verifying}
            />
          ))}
        </div>
      )}

      {/* Save Logs */}
      {showLogs && <SettingsSaveLogsPanel logs={saveLogs} />}
    </div>
  )
}

function SettingsCategoryCard({
  category,
  settings,
  onVerify,
  onEdit,
  onSave,
  editingId,
  editValue,
  setEditValue,
  verifying,
}: {
  category: string
  settings: AdminSetting[]
  onVerify: (id: string) => void
  onEdit: (id: string, value: string) => void
  onSave: (key: string, value: string) => void
  editingId: string | null
  editValue: string
  setEditValue: (value: string) => void
  verifying: boolean
}) {
  const categoryIcons: Record<string, string> = {
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
            onEdit={() => onEdit(setting.id, setting.value)}
            onSave={() => onSave(setting.key, editValue)}
            isEditing={editingId === setting.id}
            editValue={editValue}
            setEditValue={setEditValue}
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
  onEdit,
  onSave,
  isEditing,
  editValue,
  setEditValue,
  verifying,
}: {
  setting: AdminSetting
  onVerify: () => void
  onEdit: () => void
  onSave: () => void
  isEditing: boolean
  editValue: string
  setEditValue: (value: string) => void
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

  if (isEditing) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg bg-[#1a1a1a]/50 border border-[#0C8B44]/40">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#E5E5E5] mb-2">{setting.key}</p>
          <input
            type={setting.type === 'number' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            placeholder={`Enter ${setting.type}`}
          />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setEditValue(setting.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
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
      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#2196F3]/10 text-[#2196F3] hover:bg-[#2196F3]/20 transition-colors flex items-center gap-1"
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={onVerify}
          disabled={verifying}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] transition-colors disabled:opacity-50"
        >
          Verify
        </button>
      </div>
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

function VerificationSummary({ summary }: { summary: any }) {
  if (!summary) return null

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/20 to-[#0C8B44]/5 border border-[#0C8B44]/30 p-6">
      <h3 className="text-lg font-semibold text-[#E5E5E5] mb-4">Verification Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Settings" value={summary.total} color="blue" />
        <SummaryCard label="Verified" value={summary.verified} color="green" />
        <SummaryCard label="Pending" value={summary.pending} color="orange" />
        <SummaryCard label="Failed" value={summary.failed} color="red" />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#A0A0A0]">Verification Rate</span>
          <span className="text-sm font-medium text-[#0C8B44]">{summary.verificationRate}%</span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0C8B44] transition-all duration-300"
            style={{ width: `${summary.verificationRate}%` }}
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
