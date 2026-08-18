import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { WalletCreationPanel } from '../components/WalletCreationPanel'
import DocumentTitle from '../components/DocumentTitle'
import Navigation from '../components/Navigation'

export default function CreateWallet() {
  return (
    <>
      <DocumentTitle />
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto mb-4">
            <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44]">
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Link>
          </div>
          <WalletCreationPanel />
        </div>
      </div>
    </>
  )
}
