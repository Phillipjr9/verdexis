import { WalletCreationPanel } from '../components/WalletCreationPanel'
import DocumentTitle from '../components/DocumentTitle'

export default function CreateWallet() {
  return (
    <>
      <DocumentTitle />
      <div className="min-h-screen bg-[#0a0a0a] pt-20 pb-12">
        <WalletCreationPanel />
      </div>
    </>
  )
}
