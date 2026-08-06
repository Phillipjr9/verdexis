import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { api } from '../lib/api'
import { ArrowLeft, ShieldCheck, Link as LinkIcon } from 'lucide-react'

export default function WalletVerification() {
  return <RequireAuth><WalletVerificationInner /></RequireAuth>
}

function WalletVerificationInner() {
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.get('/wallet-verification/requests')
        setRequests(result.requests || [])
      } catch (error) {
        toast.error('Failed to load wallet verification data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/wallet" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to wallet
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
            <LinkIcon className="w-8 h-8 text-[#0C8B44]" />Wallet Verification
          </h1>
          <p className="text-sm text-[#737373]">Verify your connected wallet addresses and signature challenges.</p>
        </div>

        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading wallet verification requests...</div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">No wallet verification requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0e10] border-b border-[#ffffff08]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Wallet Address</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Chain</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Challenge</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id} className="border-b border-[#ffffff08] hover:bg-[#0a0e10]/30 transition-colors">
                      <td className="px-6 py-4 text-[#E5E5E5]">{item.walletAddress}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{item.walletLink?.chainId || 'Unknown'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{item.verificationChallenge || '—'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{item.verifiedAt ? 'Yes' : 'No'}</td>
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
