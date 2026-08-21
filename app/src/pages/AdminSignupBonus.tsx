import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import { adminApi } from '../lib/adminApi'
import { Gift, Save } from 'lucide-react'

type BonusForm = {
  enabled: boolean
  amountUsd: number
  note: string
}

export default function AdminSignupBonus() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BonusForm>({
    enabled: false,
    amountUsd: 0,
    note: '',
  })

  useEffect(() => {
    setLoading(true)
    adminApi
      .getSignupBonus?.()
      .then((r: any) => {
        setForm({
          enabled: !!r?.enabled,
          amountUsd: Number(r?.amountUsd) || 0,
          note: r?.note || '',
        })
      })
      .catch(() => {
        // endpoint may vary; keep defaults
      })
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await (adminApi as any).setSignupBonus?.(form)
      toast.success('Signup bonus saved')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout title="Signup bonus" subtitle="New-user bonus configuration">
      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-6">
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-[#0C8B44]" />
              <p className="text-sm text-[#E5E5E5]">Credit new accounts on signup</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#A0A0A0]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.checked }))}
                className="accent-[#0C8B44]"
              />
              Enabled
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-[#737373]">Amount (USD)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.amountUsd}
                onChange={(e) => setForm((c) => ({ ...c, amountUsd: Number(e.target.value) || 0 }))}
                className="mt-1 w-full rounded-lg border border-[#ffffff10] bg-[#0a0f11] px-3 py-2 text-sm text-[#E5E5E5]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-[#737373]">Note</span>
              <textarea
                value={form.note}
                onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))}
                rows={3}
                maxLength={300}
                className="mt-1 w-full rounded-lg border border-[#ffffff10] bg-[#0a0f11] px-3 py-2 text-sm text-[#E5E5E5]"
              />
            </label>
            <p className="text-xs text-[#737373]">
              {form.enabled && form.amountUsd > 0
                ? `New users receive $${form.amountUsd.toFixed(2)} on signup.`
                : 'Signup bonus is disabled.'}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0C8B44] px-4 py-2 text-sm text-white hover:bg-[#0a7539] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </form>
    </AdminLayout>
  )
}
