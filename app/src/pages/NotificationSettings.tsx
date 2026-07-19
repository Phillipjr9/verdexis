import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, Clock, Mail, Smartphone, AlertCircle, Check } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { notificationsApi } from '../lib/advancedFeaturesApi'
import { toast } from 'sonner'

interface NotificationPreferences {
  emailAlerts?: boolean
  pushAlerts?: boolean
  priceAlerts?: boolean
  newsDigest?: boolean
  smsAlerts?: boolean
  marketingEmails?: boolean
  quietHoursEnabled?: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
  [key: string]: boolean | string | undefined
}

function ToggleSwitch({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string
  description?: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[#E5E5E5]">{label}</p>
        {description && <p className="mt-1 text-xs text-[#737373]">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? 'bg-[#0C8B44]' : 'bg-[#1a1a1a]'
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#E5E5E5] mb-2">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#ffffff08] bg-[#070C0E]/70 px-3 py-2 text-[#E5E5E5] placeholder-[#737373] focus:border-[#0C8B44] focus:outline-none"
      />
    </div>
  )
}

function NotificationSettingsContent() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailAlerts: true,
    pushAlerts: true,
    priceAlerts: true,
    newsDigest: false,
    smsAlerts: false,
    marketingEmails: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await notificationsApi.getPreferences()
        if (result?.preferences) {
          setPrefs(result.preferences)
          setHasChanges(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const handleToggle = (key: keyof NotificationPreferences) => {
    const value = !prefs[key]
    setPrefs((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleTimeChange = (key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      await notificationsApi.updatePreferences(prefs)
      setHasChanges(false)
      toast.success('Notification preferences saved')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to settings
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="rounded-full border border-[#0C8B44]/20 bg-[#0C8B44]/10 p-3">
              <Bell className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-3xl font-light text-[#E5E5E5]">Notification preferences</h1>
              <p className="mt-1 text-sm text-[#737373]">Control how and when you receive updates</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 mb-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-10 text-center text-[#737373]">
              Loading preferences…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Alert Types */}
              <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-[#0C8B44]" />
                  <h2 className="text-lg font-medium text-[#E5E5E5]">Alert channels</h2>
                </div>
                <div className="space-y-3">
                  <ToggleSwitch
                    label="Email alerts"
                    description="Receive important updates via email"
                    enabled={!!prefs.emailAlerts}
                    onChange={() => handleToggle('emailAlerts')}
                  />
                  <ToggleSwitch
                    label="Push notifications"
                    description="Browser and mobile push alerts"
                    enabled={!!prefs.pushAlerts}
                    onChange={() => handleToggle('pushAlerts')}
                  />
                  <ToggleSwitch
                    label="SMS alerts"
                    description="Text messages to your phone"
                    enabled={!!prefs.smsAlerts}
                    onChange={() => handleToggle('smsAlerts')}
                  />
                </div>
              </div>

              {/* Alert Types Content */}
              <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="w-4 h-4 text-[#0C8B44]" />
                  <h2 className="text-lg font-medium text-[#E5E5E5]">Notification types</h2>
                </div>
                <div className="space-y-3">
                  <ToggleSwitch
                    label="Price alerts"
                    description="Notify when assets hit target prices"
                    enabled={!!prefs.priceAlerts}
                    onChange={() => handleToggle('priceAlerts')}
                  />
                  <ToggleSwitch
                    label="News digest"
                    description="Weekly summary of market news"
                    enabled={!!prefs.newsDigest}
                    onChange={() => handleToggle('newsDigest')}
                  />
                  <ToggleSwitch
                    label="Marketing emails"
                    description="New features, promotions, and updates"
                    enabled={!!prefs.marketingEmails}
                    onChange={() => handleToggle('marketingEmails')}
                  />
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-[#0C8B44]" />
                  <h2 className="text-lg font-medium text-[#E5E5E5]">Quiet hours</h2>
                </div>
                <div className="space-y-4">
                  <ToggleSwitch
                    label="Enable quiet hours"
                    description="Pause notifications during specific times"
                    enabled={!!prefs.quietHoursEnabled}
                    onChange={() => handleToggle('quietHoursEnabled')}
                  />
                  {prefs.quietHoursEnabled && (
                    <div className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-4 space-y-4">
                      <TimeInput
                        label="Start time"
                        value={prefs.quietHoursStart || '22:00'}
                        onChange={(v) => handleTimeChange('quietHoursStart', v)}
                      />
                      <TimeInput
                        label="End time"
                        value={prefs.quietHoursEnd || '07:00'}
                        onChange={(v) => handleTimeChange('quietHoursEnd', v)}
                      />
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#737373]">
                        Notifications will be paused between these times
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0C8B44] px-4 py-3 text-sm font-medium text-white hover:bg-[#0a6b34] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NotificationSettings() {
  return (
    <RequireAuth>
      <NotificationSettingsContent />
    </RequireAuth>
  )
}
