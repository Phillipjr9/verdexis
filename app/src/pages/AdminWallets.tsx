import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAdmin from '../components/RequireAdmin'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, ShieldCheck, Wallet } from 'lucide-react'

export default function AdminWallets() {
  return <RequireAdmin><AdminWalletsInner /></RequireAdmin>
}

function AdminWalletsInner() {
  const [loading, setLoading] = useState(true)
  const [wallets, setWallets] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await adminApi.get('/wallets')
        setWallets(result.wallets || [])
      } catch (error) {
        toast.error('Failed to load wallet review data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-[#0C8B44]" />Wallet Review
          </h1>
          <p className="text-sm text-[#737373]">Review and verify self-custody wallet links before approval.</p>
        </div>

        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          <div className="bg-[#0a0e10] border-b border-[#ffffff08] px-6 py-4">
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
                      <td className="px-6 py-4 text-[#E5E5E5]">{wallet.walletAddress}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{wallet.chainId || 'Unknown'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{wallet.verifiedAt ? 'Yes' : 'No'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{wallet.createdAt ? new Date(wallet.createdAt).toLocaleDateString() : '—'}</td>
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
