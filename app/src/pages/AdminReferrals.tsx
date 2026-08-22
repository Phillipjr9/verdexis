import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAdmin from '../components/RequireAdmin'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, Gift, CheckCircle, Clock, XCircle, Settings2, Power } from 'lucide-react'

type ReferralSettings = {
  enabled: boolean
  referrerBonusUsd: number
  refereeBonusUsd: number
  minDepositUsd: number
  note?: string
}

export default function AdminReferrals() {
  return (
    <RequireAdmin>
      <AdminReferralsInner />
    </RequireAdmin>
  )
}

function AdminReferralsInner() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<{
    totalReferrals: number
    activeReferrals: number
    pendingReferrals: number
    conversionRate: string
    totalBonusesAwarded: number
    totalBonusesPending: number
  } | null>(null)
  const [referrals, setReferrals] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [settings, setSettings] = useState<ReferralSettings>({
    enabled: false,
    referrerBonusUsd: 250,
    refereeBonusUsd: 10,
    minDepositUsd: 50,
    note: '',
  })
  const [draft, setDraft] = useState<ReferralSettings>(settings)

  const loadAll = async () => {
    try {
      const [statsResp, referralsResp, settingsResp] = await Promise.all([
        adminApi.get('/referrals/stats'),
        adminApi.get(`/referrals${filter !== 'all' ? `?status=${filter}` : ''}`),
        adminApi.get('/referral-settings').catch(() => null),
      ])
      setStats(statsResp)
      setReferrals(referralsResp.referrals || [])
      if (settingsResp) {
        const next: ReferralSettings = {
          enabled: settingsResp.enabled === true,
          referrerBonusUsd: Number(settingsResp.referrerBonusUsd) || 0,
          refereeBonusUsd: Number(settingsResp.refereeBonusUsd) || 0,
          minDepositUsd: Number(settingsResp.minDepositUsd) || 0,
          note: settingsResp.note || '',
        }
        setSettings(next)
        setDraft(next)
      }
    } catch {
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const updated = await adminApi.put('/referral-settings', {
        enabled: draft.enabled === true,
        referrerBonusUsd: Math.max(0, Number(draft.referrerBonusUsd) || 0),
        refereeBonusUsd: Math.max(0, Number(draft.refereeBonusUsd) || 0),
        minDepositUsd: Math.max(0, Number(draft.minDepositUsd) || 0),
        note: (draft.note || '').trim().slice(0, 500),
      })
      const next: ReferralSettings = {
        enabled: updated.enabled === true,
        referrerBonusUsd: Number(updated.referrerBonusUsd) || 0,
        refereeBonusUsd: Number(updated.refereeBonusUsd) || 0,
        minDepositUsd: Number(updated.minDepositUsd) || 0,
        note: updated.note || '',
      }
      setSettings(next)
      setDraft(next)
      toast.success(next.enabled ? 'Referral program enabled' : 'Referral program disabled')
    } catch {
      toast.error('Failed to save referral settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async () => {
    const next = { ...draft, enabled: !draft.enabled }
    setDraft(next)
    setSaving(true)
    try {
      const updated = await adminApi.put('/referral-settings', next)
      setSettings({
        enabled: updated.enabled === true,
        referrerBonusUsd: Number(updated.referrerBonusUsd) || 0,
        refereeBonusUsd: Number(updated.refereeBonusUsd) || 0,
        minDepositUsd: Number(updated.minDepositUsd) || 0,
        note: updated.note || '',
      })
      setDraft({
        enabled: updated.enabled === true,
        referrerBonusUsd: Number(updated.referrerBonusUsd) || 0,
        refereeBonusUsd: Number(updated.refereeBonusUsd) || 0,
        minDepositUsd: Number(updated.minDepositUsd) || 0,
        note: updated.note || '',
      })
      toast.success(updated.enabled ? 'Program is now ON' : 'Program is now OFF')
    } catch {
      toast.error('Failed to toggle program')
      setDraft(settings)
    } finally {
      setSaving(false)
    }
  }

  const cancelReferral = async (referralId: string) => {
    if (!confirm('Are you sure you want to cancel this referral?')) return
    try {
      await adminApi.post(`/referrals/${referralId}/cancel`, { reason: 'admin_action' })
      toast.success('Referral cancelled')
      const updatedReferrals = await adminApi.get(`/referrals${filter !== 'all' ? `?status=${filter}` : ''}`)
      setReferrals(updatedReferrals.referrals || [])
    } catch {
      toast.error('Failed to cancel referral')
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to admin
        </Link>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
              <Gift className="w-8 h-8 text-[#0C8B44]" />
              Referral Program Management
            </h1>
            <p className="text-sm text-[#737373]">
              Signups always record who referred whom. Bonuses only pay when the program is ON and the referee meets the min deposit.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              draft.enabled
                ? 'bg-[#0C8B44]/20 text-[#0C8B44] border border-[#0C8B44]/40 hover:bg-[#0C8B44]/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
            }`}
          >
            <Power className="w-4 h-4" />
            {draft.enabled ? 'Program ON' : 'Program OFF'}
          </button>
        </div>

        {/* Settings panel */}
        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-[#0C8B44]" />
            <h2 className="text-sm font-medium text-[#E5E5E5]">Program settings</h2>
            <span
              className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                settings.enabled ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {settings.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-[#737373] mb-4">
            When disabled, new signups still attribute the referrer (so you can see who invited whom), but deposit activation will not create bonuses.
            Existing pending/active referrals are left as-is.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-[#737373]">Referrer bonus (USD)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={draft.referrerBonusUsd}
                onChange={(e) => setDraft((d) => ({ ...d, referrerBonusUsd: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0a0e10] border border-[#ffffff12] text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-[#737373]">Referee bonus (USD)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={draft.refereeBonusUsd}
                onChange={(e) => setDraft((d) => ({ ...d, refereeBonusUsd: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0a0e10] border border-[#ffffff12] text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-[#737373]">Min first deposit (USD)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={draft.minDepositUsd}
                onChange={(e) => setDraft((d) => ({ ...d, minDepositUsd: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0a0e10] border border-[#ffffff12] text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
            </label>
            <label className="block md:col-span-2 lg:col-span-1">
              <span className="text-[10px] uppercase tracking-wider text-[#737373]">Internal note</span>
              <input
                type="text"
                maxLength={500}
                value={draft.note || ''}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="Optional"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0a0e10] border border-[#ffffff12] text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#0C8B44] text-white text-xs font-medium hover:bg-[#0a7539] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button
              type="button"
              onClick={() => setDraft(settings)}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#ffffff08] text-[#A0A0A0] text-xs hover:bg-[#ffffff12] transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Total Referrals</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{stats.totalReferrals}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Active</p>
              <p className="text-2xl font-light text-[#0C8B44]">{stats.activeReferrals}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Pending</p>
              <p className="text-2xl font-light text-yellow-400">{stats.pendingReferrals}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Conversion</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{stats.conversionRate}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Awarded</p>
              <p className="text-2xl font-light text-[#4CAF50]">${stats.totalBonusesAwarded}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Pending Pay</p>
              <p className="text-2xl font-light text-orange-400">${stats.totalBonusesPending}</p>
            </div>
          </div>
        )}

        {/* Filter and List */}
        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          <div className="bg-[#0a0e10] border-b border-[#ffffff08] px-6 py-4 flex items-center gap-4">
            <p className="text-sm font-medium text-[#E5E5E5]">Who referred whom</p>
            <div className="flex gap-2">
              {(['all', 'active', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    filter === f
                      ? 'bg-[#0C8B44] text-white'
                      : 'bg-[#ffffff05] text-[#A0A0A0] hover:bg-[#ffffff10]'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Pending'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading...</div>
          ) : referrals.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">No referrals found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0e10] border-b border-[#ffffff08]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Referrer</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Code</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Referee</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Status</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Deposit</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Joined</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-[#ffffff08] hover:bg-[#0a0e10]/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-[#E5E5E5] font-medium">{r.referrer?.name || r.referrer?.email || 'Unknown'}</p>
                        <p className="text-xs text-[#737373]">{r.referrer?.email || r.referrer?.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-[#0C8B44] tracking-wide">
                          {r.referrer?.referralCode || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[#E5E5E5]">{r.referee?.name || r.refereeEmail || '—'}</p>
                        <p className="text-xs text-[#737373]">{r.refereeEmail || r.referee?.email || ''}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                            r.status === 'active'
                              ? 'bg-[#0C8B44]/15 text-[#0C8B44]'
                              : r.status === 'pending'
                                ? 'bg-yellow-400/15 text-yellow-400'
                                : 'bg-red-500/15 text-red-500'
                          }`}
                        >
                          {r.status === 'active' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : r.status === 'pending' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.firstDepositAmount ? (
                          <p className="text-[#E5E5E5]">${Number(r.firstDepositAmount).toFixed(2)}</p>
                        ) : (
                          <p className="text-xs text-[#737373]">—</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#A0A0A0]">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : r.firstDepositAt
                            ? new Date(r.firstDepositAt).toLocaleDateString()
                            : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {r.status !== 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => cancelReferral(r.id)}
                              className="px-3 py-1 text-xs bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
