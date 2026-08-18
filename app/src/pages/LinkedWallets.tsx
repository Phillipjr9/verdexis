import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import LinkedWalletsPanel from '../components/LinkedWalletsPanel'
import { useWeb3 } from '../hooks/use-web3'
import { ArrowLeft, Wallet } from 'lucide-react'

export default function LinkedWallets() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { address, isConnected, disconnect } = useWeb3()

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/wallet"
            className="inline-flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Wallet
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5] tracking-tight">Linked Wallets</h1>
              <p className="text-sm text-[#737373]">Manage your connected Web3 wallet addresses</p>
            </div>
          </div>

          <Link
            to="/create-wallet"
            className="mb-6 flex items-center justify-between rounded-2xl border border-[#0C8B44]/30 bg-[#0C8B44]/10 px-4 py-4 hover:border-[#0C8B44]/60 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-[#E5E5E5]">Create a new deposit wallet</p>
              <p className="text-xs text-[#737373] mt-1">Generate a 12-word wallet like Trust Wallet. Use it for ETH / ERC-20 deposits.</p>
            </div>
            <span className="text-xs text-[#0C8B44]">Create →</span>
          </Link>

          <LinkedWalletsPanel
            activeAddress={isConnected ? (address ?? null) : null}
            refreshKey={refreshKey}
            onActiveRemoved={() => {
              disconnect?.()
              setRefreshKey(k => k + 1)
            }}
          />
        </div>
      </div>
      <Footer />
    </div>
  )
}
