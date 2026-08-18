import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CryptoDepositAddresses } from '../components/CryptoDepositAddresses'
import { PendingDepositsCard } from '../components/PendingDepositsCard'
import { TransferStatusCard } from '../components/TransferStatusCard'
import { WithdrawalStatusCard } from '../components/WithdrawalStatusCard'
import DocumentTitle from '../components/DocumentTitle'
import Navigation from '../components/Navigation'

export default function CreateWallet() {
  return (
    <>
      <DocumentTitle />
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-24 pb-12 px-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <Link to="/wallet?tab=deposit" className="inline-flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44]">
              <ArrowLeft className="w-4 h-4" />
              Back to Wallet
            </Link>
            <CryptoDepositAddresses />
            <PendingDepositsCard />
            <TransferStatusCard />
            <WithdrawalStatusCard />
          </div>
        </div>
      </div>
    </>
  )
}
