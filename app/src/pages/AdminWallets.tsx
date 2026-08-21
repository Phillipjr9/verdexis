import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import { adminApi } from '../lib/adminApi'
import { ShieldCheck } from 'lucide-react'

export default function AdminWallets() {
  const [loading, setLoading] = useState(true)
  const [wallets, setWallets] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await (adminApi as any).get?.('/wallets')
        if (result?.wallets) setWallets(result.wallets)
        else setWallets([])
      } catch {
        toast.error('Failed to load wallet review data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AdminLayout title="Wallets" subtitle="Review self-custody wallet links">
      <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <div className="bg-[#0a0e10] border-b border-[#ffffff08] px-6 py-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0C8B44]" />
          <p className="text-sm font-medium text-[#E5E5E5]">Wallet links awaiting review</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading wallet details...</div>
        ) : wallets.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#737373]">No wallet review items found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0e10] border-b border-[#ffffff08]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">User</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Wallet</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Chain</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Verified</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Requested</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.id} className="border-b border-[#ffffff08] hover:bg-[#0a0e10]/30 transition-colors">
                    <td className="px-6 py-4 text-[#E5E5E5]">{wallet.userEmail || wallet.userId}</td>
                    <td className="px-6 py-4 text-[#E5E5E5] font-mono text-xs">{wallet.walletAddress}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{wallet.chainId || 'Unknown'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{wallet.verifiedAt ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">
                      {wallet.createdAt ? new Date(wallet.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
