import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowLeft, Settings, Save } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { api } from '../lib/api'
import { adminApi } from '../lib/adminApi'

export default function AdminSettings() {
  const [ratePct, setRatePct] = useState<number>(11.8)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<{ ratePct: number }>('/api/admin/withdrawal-fee-config')
      .then((r) => setRatePct(r.ratePct))
      .catch(() => { /* keep default */ })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      toast.error('Rate must be between 0 and 100')
      return
    }
    setSaving(true)
    try {
      await adminApi.post('/withdrawal-fee-config', { ratePct })
      toast.success(`Withdrawal processing fee updated to ${ratePct}%`)
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed to save')
    } finally {
      setSaving(false)
    }
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

        <div className="max-w-md rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h2 className="text-lg font-medium text-[#E5E5E5] mb-1">Withdrawal Processing Fee</h2>
          <p className="text-xs text-[#737373] mb-5">
            Flat-rate fee charged on every withdrawal. Shown to users before they confirm.
            Changes take effect immediately for all new withdrawal requests.
          </p>

          {loading ? (
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
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save fee rate'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
