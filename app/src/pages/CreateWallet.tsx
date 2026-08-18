import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CryptoDepositAddresses } from '../components/CryptoDepositAddresses'
import DocumentTitle from '../components/DocumentTitle'
import Navigation from '../components/Navigation'

export default function CreateWallet() {
  return (
    <>
      <DocumentTitle />
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-24 pb-12 px-6">
          <div className="max-w-2xl mx-auto">
            <Link to="/wallet" className="inline-flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44] mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Wallet
            </Link>
            <CryptoDepositAddresses />
          </div>
        </div>
      </div>
    </>
  )
}
