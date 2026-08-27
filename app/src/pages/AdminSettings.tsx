import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowLeft, Settings, Save, Shield, Gift, Percent, RefreshCw } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { adminApi } from '../lib/adminApi'

interface OtpAnalytics {
  totalUsers: number
  otpEnabledCount: number
  adoptionRate: string
  methods?: Record<string, number>
  requirements: { login: number; transactions: number; withdrawals: number; twoFactor: number }
  activity24h: { totalOTPs: number; failedOTPs: number; successRate: string }
}

function errMsg(e: unknown, fallback: string) {
  const x = e as { error?: string; detail?: string; message?: string }
  if (x?.error && x?.detail) return `${x.error}: ${x.detail}`
  return x?.error || x?.message || fallback
}

export default function AdminSettings() {
  const [ratePct, setRatePct] = useState<number>(11.8)
  const [feeLoading, setFeeLoading] = useState(true)
  const [feeSaving, setFeeSaving] = useState(false)

  const [bonusEnabled, setBonusEnabled] = useState(false)
  const [bonusAmount, setBonusAmount] = useState(0)
  const [bonusNote, setBonusNote] = useState('')
  const [bonusLoading, setBonusLoading] = useState(true)
  const [bonusSaving, setBonusSaving] = useState(false)

  const [otp, setOtp] = useState<OtpAnalytics | null>(null)
  const [otpLoading, setOtpLoading] = useState(true)

  const [govSettings, setGovSettings] = useState({
    requireOtpForWithdrawals: true,
    requireKycForWithdrawals: true,
    autoVerifySettings: true,
    flagSuspiciousLogins: true,
  })
  const [auditNote, setAuditNote] = useState('')

  useEffect(() => {
    adminApi.get('/settings/panel/withdrawal-fee')
      .then((r: { ratePct: number }) => {
        setRatePct(Number(r.ratePct) || 11.8)
        setFeeLoading(false)
      })
      .catch((e) => {
        console.error('Failed to load withdrawal fee config:', e)
        toast.error(errMsg(e, 'Failed to load withdrawal fee'))
        setFeeLoading(false)
      })

    adminApi.get('/settings/panel/signup-bonus')
      .then((r: { enabled: boolean; amountUsd: number; note?: string }) => {
        setBonusEnabled(!!r.enabled)
        setBonusAmount(Number(r.amountUsd) || 0)
        setBonusNote(r.note ?? '')
        setBonusLoading(false)
      })
      .catch((e) => {
        console.error('Failed to load signup bonus:', e)
        toast.error(errMsg(e, 'Failed to load signup bonus'))
        setBonusLoading(false)
      })

    adminApi.get('/settings/panel/otp-analytics')
      .then((r: OtpAnalytics) => {
        setOtp(r)
        setOtpLoading(false)
      })
      .catch((e) => {
        console.warn('Failed to load OTP analytics:', e)
        setOtpLoading(false)
      })

    Promise.all([
      adminApi.getSetting('requireOtpForWithdrawals').then(r => r.setting.value === 'true').catch(() => true),
      adminApi.getSetting('requireKycForWithdrawals').then(r => r.setting.value === 'true').catch(() => true),
      adminApi.getSetting('autoVerifySettings').then(r => r.setting.value === 'true').catch(() => true),
      adminApi.getSetting('flagSuspiciousLogins').then(r => r.setting.value === 'true').catch(() => true),
    ])
      .then(([otpReq, kyc, auto, flag]) => {
        setGovSettings({
          requireOtpForWithdrawals: otpReq,
          requireKycForWithdrawals: kyc,
          autoVerifySettings: auto,
          flagSuspiciousLogins: flag,
        })
      })
      .catch((e) => {
        console.warn('Failed to load governance settings (using defaults):', e)
      })
  }, [])

  const saveFee = async () => {
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      toast.error('Rate must be between 0 and 100')
      return
    }
    setFeeSaving(true)
    try {
      await adminApi.put('/settings/panel/withdrawal-fee', { ratePct })
      toast.success(`Withdrawal fee updated to ${ratePct}%`)
    } catch (e) {
      console.error('Failed to save withdrawal fee:', e)
      toast.error(errMsg(e, 'Failed to save withdrawal fee'))
    } finally {
      setFeeSaving(false)
    }
  }

  const saveBonus = async () => {
    if (!Number.isFinite(bonusAmount) || bonusAmount < 0) {
      toast.error('Amount must be 0 or greater')
      return
    }
    setBonusSaving(true)
    try {
      // POST is more reliable through some proxies than PUT
      await adminApi.post('/settings/panel/signup-bonus', {
        enabled: bonusEnabled,
        amountUsd: bonusAmount,
        note: bonusNote || '',
      })
      toast.success('Signup bonus settings saved')
    } catch (e) {
      console.error('Failed to save signup bonus:', e)
      toast.error(errMsg(e, 'Failed to save signup bonus'))
    } finally {
      setBonusSaving(false)
    }
  }

  const refreshOtp = () => {
    setOtpLoading(true)
    adminApi.get('/settings/panel/otp-analytics')
      .then((r: OtpAnalytics) => {
        setOtp(r)
        setOtpLoading(false)
      })
      .catch((e) => {
        console.warn('Failed to refresh OTP analytics:', e)
        toast.error('Failed to refresh OTP analytics')
        setOtpLoading(false)
      })
  }

  const setGovToggle = async (key: keyof typeof govSettings, value: boolean) => {
    setGovSettings((prev) => ({ ...prev, [key]: value }))
    try {
      await adminApi.saveSetting(key, value ? 'true' : 'false')
      toast.success('Governance setting updated')
    } catch (error) {
      console.error('Failed to save governance setting:', error)
      toast.error(errMsg(error, 'Failed to save governance setting'))
      setGovSettings((prev) => ({ ...prev, [key]: !value }))
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <Toaster position="top-right" theme="dark" richColors />

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to admin
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5]">Admin Settings</h1>
            <p className="text-xs text-[#737373]">Core platform controls and governance options</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Link to="/admin/users" className="rounded-lg border border-[#ffffff08] bg-[#0f1619]/50 px-3 py-2 text-xs text-[#A0A0A0] hover:border-[#0C8B44]/40 hover:text-[#0C8B44]">Users</Link>
          <Link to="/admin/audit" className="rounded-lg border border-[#ffffff08] bg-[#0f1619]/50 px-3 py-2 text-xs text-[#A0A0A0] hover:border-[#0C8B44]/40 hover:text-[#0C8B44]">Audit</Link>
          <Link to="/admin/broadcast" className="rounded-lg border border-[#ffffff08] bg-[#0f1619]/50 px-3 py-2 text-xs text-[#A0A0A0] hover:border-[#0C8B44]/40 hover:text-[#0C8B44]">Broadcast</Link>
          <Link to="/admin/settings" className="rounded-lg border border-[#0C8B44]/30 bg-[#0C8B44]/10 px-3 py-2 text-xs text-[#0C8B44]">Active settings</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 lg:col-span-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[#737373] mb-4">Core platform controls</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-[#121a1f]/80 border border-[#ffffff08] p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-[#0C8B44]" />
                  <h2 className="text-lg font-medium text-[#E5E5E5]">Withdrawal Processing Fee</h2>
                </div>
                <p className="text-xs text-[#737373] mb-5">
                  Flat-rate fee charged on every withdrawal. Shown to users before they confirm.
                </p>

                {feeLoading ? (
                  <p className="text-xs text-[#737373]">Loading…</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Processing fee rate (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={ratePct}
                          onChange={(e) => setRatePct(parseFloat(e.target.value))}
                          className="w-36 px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                        />
                        <span className="text-sm text-[#737373]">%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={saveFee}
                      disabled={feeSaving}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {feeSaving ? 'Saving…' : 'Save fee rate'}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-[#121a1f]/80 border border-[#ffffff08] p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-[#0C8B44]" />
                  <h2 className="text-lg font-medium text-[#E5E5E5]">Signup Bonus</h2>
                </div>
                <p className="text-xs text-[#737373] mb-5">
                  Credit new users with a USD bonus on register. Set 0 or disable to turn off.
                </p>

                {bonusLoading ? (
                  <p className="text-xs text-[#737373]">Loading…</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bonusEnabled}
                        onClick={() => setBonusEnabled(!bonusEnabled)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${bonusEnabled ? 'bg-[#0C8B44]' : 'bg-[#2a2a2a]'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${bonusEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-sm text-[#E5E5E5]">{bonusEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Bonus amount (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(parseFloat(e.target.value) || 0)}
                        className="w-36 px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Internal note (optional)</label>
                      <input
                        type="text"
                        maxLength={300}
                        value={bonusNote}
                        onChange={(e) => setBonusNote(e.target.value)}
                        placeholder="e.g. Q3 promo campaign"
                        className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={saveBonus}
                      disabled={bonusSaving}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {bonusSaving ? 'Saving…' : 'Save bonus settings'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 lg:col-span-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[#737373] mb-4">Monitoring & compliance</h2>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#0C8B44]" />
                    <h2 className="text-lg font-medium text-[#E5E5E5]">OTP / 2FA Analytics</h2>
                  </div>
                  <button type="button" onClick={refreshOtp} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                <p className="text-xs text-[#737373] mb-5">Platform-wide OTP adoption and activity.</p>

                {otpLoading ? (
                  <p className="text-xs text-[#737373]">Loading…</p>
                ) : !otp ? (
                  <p className="text-xs text-[#737373]">Analytics unavailable.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBox label="Total users" value={otp.totalUsers.toLocaleString()} />
                    <StatBox label="OTP enabled" value={otp.otpEnabledCount.toLocaleString()} accent="green" />
                    <StatBox label="Adoption rate" value={otp.adoptionRate} accent="green" />
                    <StatBox label="2FA (twoFactor)" value={String(otp.requirements.twoFactor)} />
                    <StatBox label="OTPs (24h)" value={otp.activity24h.totalOTPs.toLocaleString()} />
                    <StatBox label="Failed OTPs (24h)" value={otp.activity24h.failedOTPs.toLocaleString()} accent={otp.activity24h.failedOTPs > 0 ? 'orange' : undefined} />
                    <StatBox label="Success rate (24h)" value={otp.activity24h.successRate} accent="green" />
                    <StatBox label="Required for login" value={String(otp.requirements.login)} />
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-[#121a1f]/80 border border-[#ffffff08] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-[#0C8B44]" />
                  <h3 className="text-lg font-medium text-[#E5E5E5]">Verification & governance</h3>
                </div>

                <div className="space-y-4">
                  <ToggleRow
                    label="Require OTP on withdrawals"
                    enabled={govSettings.requireOtpForWithdrawals}
                    onToggle={(value) => setGovToggle('requireOtpForWithdrawals', value)}
                  />
                  <ToggleRow
                    label="Require KYC before withdrawals"
                    enabled={govSettings.autoVerifySettings ? govSettings.requireKycForWithdrawals : govSettings.requireKycForWithdrawals}
                    onToggle={(value) => setGovToggle('requireKycForWithdrawals', value)}
                  />
                  <ToggleRow
                    label="Auto-verify admin setting changes"
                    enabled={govSettings.autoVerifySettings}
                    onToggle={(value) => setGovToggle('autoVerifySettings', value)}
                  />
                  <ToggleRow
                    label="Flag suspicious logins"
                    enabled={govSettings.flagSuspiciousLogins}
                    onToggle={(value) => setGovToggle('flagSuspiciousLogins', value)}
                  />

                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-[#737373] block mb-2">Audit note</label>
                    <input
                      type="text"
                      value={auditNote}
                      onChange={(e) => setAuditNote(e.target.value)}
                      placeholder="Optional review note"
                      className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#ffffff08] bg-[#10181b] px-3 py-2.5">
      <span className="text-sm text-[#E5E5E5]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggle(!enabled)
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-[#0C8B44]' : 'bg-[#2d2d2d]'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'orange' }) {
  const color = accent === 'green' ? 'text-[#4CAF50]' : accent === 'orange' ? 'text-[#F57C00]' : 'text-[#E5E5E5]'
  return (
    <div className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">{label}</p>
      <p className={`text-xl font-light ${color}`}>{value}</p>
    </div>
  )
}
