import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import { adminApi } from '../lib/adminApi'
import { Wallet } from 'lucide-react'

export default function AdminWallets() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ wallets?: unknown[]; summary?: unknown } | null>(null)

  useEffect(() => {
    setLoading(true)
    // Best-effort load; page may use stats if dedicated endpoint varies
    adminApi
      .stats()
      .then((r) => setData({ summary: r.stats }))
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load wallet overview'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout title="Wallets" subtitle="Platform and user wallet overview">
      {loading ? (
        <p className="text-sm text-[#737373]">Loading…</p>
      ) : (
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-[#0C8B44]" />
            <h2 className="text-sm font-medium text-[#E5E5E5]">Snapshot</h2>
          </div>
          <pre className="text-xs text-[#A0A0A0] overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(data?.summary ?? data, null, 2)}
          </pre>
          <p className="text-xs text-[#737373] mt-4">
            For per-user balances and deposit destinations, open a user from{' '}
            <a href="/admin/users" className="text-[#0C8B44] hover:underline">Users</a>.
          </p>
        </div>
      )}
    </AdminLayout>
  )
}
