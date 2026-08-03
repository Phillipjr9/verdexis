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
  methods: Record<string, number>
  requirements: { login: number; transactions: number; withdrawals: number; twoFactor: number }
  activity24h: { totalOTPs: number; failedOTPs: number; successRate: string }
}

export default function AdminSettings() {
  // --- Withdrawal fee ---
  const [ratePct, setRatePct] = useState<number>(11.8)
  const [feeLoading, setFeeLoading] = useState(true)
  const [feeSaving, setFeeSaving] = useState(false)

  // --- Signup bonus ---
  const [bonusEnabled, setBonusEnabled] = useState(false)
  const [bonusAmount, setBonusAmount] = useState(0)
  const [bonusNote, setBonusNote] = useState('')
  const [bonusLoading, setBonusLoading] = useState(true)
  const [bonusSaving, setBonusSaving] = useState(false)

  // --- OTP analytics ---
  const [otp, setOtp] = useState<OtpAnalytics | null>(null)
  const [otpLoading, setOtpLoading] = useState(true)

  useEffect(() => {
    adminApi.get('/withdrawal-fee-config')
      .then((r: { ratePct: number }) => setRatePct(r.ratePct))
      .catch(() => {})
      .finally(() => setFeeLoading(false))

    adminApi.getSignupBonus()
      .then((r) => { setBonusEnabled(r.enabled); setBonusAmount(r.amountUsd); setBonusNote(r.note ?? '') })
      .catch(() => {})
      .finally(() => setBonusLoading(false))

    adminApi.get('/otp/analytics')
      .then((r: OtpAnalytics) => setOtp(r))
      .catch(() => {})
      .finally(() => setOtpLoading(false))
  }, [])

  const saveFee = async () => {
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      toast.error('Rate must be between 0 and 100')
      return
    }
    setFeeSaving(true)
    try {
      await adminApi.setWithdrawalFeeConfig({ ratePct })
      toast.success(`Withdrawal fee updated to ${ratePct}%`)
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed to save')
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
      await adminApi.setSignupBonus({ enabled: bonusEnabled, amountUsd: bonusAmount, note: bonusNote })
      toast.success('Signup bonus settings saved')
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed to save')
    } finally {
      setBonusSaving(false)
    }
  }

  const refreshOtp = () => {
    setOtpLoading(true)
    adminApi.get('/otp/analytics')
      .then((r: OtpAnalytics) => setOtp(r))
      .catch(() => {})
      .finally(() => setOtpLoading(false))
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
            <p className="text-xs text-[#737373]">Configure platform-wide parameters</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Withdrawal Processing Fee */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Withdrawal Processing Fee</h2>
            </div>
            <p className="text-xs text-[#737373] mb-5">
              Flat-rate fee charged on every withdrawal. Shown to users before they confirm.
              Changes take effect immediately for all new withdrawal requests.
            </p>

            {feeLoading ? (
              <p className="text-xs text-[#737373]">Loading…</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">
                    Processing fee rate (%)
                  </label>
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
                    <span className="text-xs text-[#A0A0A0]">
                      e.g. on $10,000 → fee = ${(10000 * (ratePct / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#F57C00] mt-2">
                    Current default: 11.8% — paid externally by the user, not deducted from balance.
                  </p>
                </div>
                <button
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

          {/* Signup Bonus */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Signup Bonus</h2>
            </div>
            <p className="text-xs text-[#737373] mb-5">
              Automatically credit new users with a USD bonus when they register.
              Set amount to 0 or disable to turn off.
            </p>

            {bonusLoading ? (
              <p className="text-xs text-[#737373]">Loading…</p>
            ) : (
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setBonusEnabled(!bonusEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${bonusEnabled ? 'bg-[#0C8B44]' : 'bg-[#2a2a2a]'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${bonusEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-[#E5E5E5]">{bonusEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>

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

          {/* OTP Analytics */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0C8B44]" />
                <h2 className="text-lg font-medium text-[#E5E5E5]">OTP / 2FA Analytics</h2>
              </div>
              <button onClick={refreshOtp} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44] flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <p className="text-xs text-[#737373] mb-5">
              Platform-wide OTP adoption and activity. Manage per-user OTP settings from the user detail page.
            </p>

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
        </div>
      </div>
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
