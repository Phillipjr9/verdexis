import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { toast, Toaster } from 'sonner'
import { Copy, QrCode, AlertCircle, ChevronLeft, Check, ExternalLink, Clock, Bell, BellOff, Shield, TrendingUp, AlertTriangle } from 'lucide-react'
import { api, getToken } from '../lib/api'
import QRCode from 'qrcode'

interface DepositAddress {
  asset: string
  address: string
  network: string
  minDeposit: number
  confirmations: number
  note?: string
  alternateNetworks?: Array<{ network: string; address?: string; minDeposit: number }>
}

// Step-by-step deposit flow
type DepositStep = 'select_network' | 'verify_address' | 'send_crypto' | 'submit_txhash' | 'pending'

const CRYPTO_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', minDeposit: 0.0001, confirmations: 3, icon: '₿', limits: { daily: 10, monthly: 100 } },
  { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum (ERC-20)', minDeposit: 0.001, confirmations: 12, icon: 'Ξ', limits: { daily: 50, monthly: 500 }, alternateNetworks: [{ network: 'Arbitrum', minDeposit: 0.001 }, { network: 'Optimism', minDeposit: 0.001 }] },
  { symbol: 'SOL', name: 'Solana', network: 'Solana', minDeposit: 0.01, confirmations: 1, icon: '◎', limits: { daily: 1000, monthly: 10000 } },
  { symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC-20)', minDeposit: 1, confirmations: 12, icon: '₮', limits: { daily: 50000, monthly: 500000 }, alternateNetworks: [{ network: 'Tron (TRC-20)', minDeposit: 1 }, { network: 'BSC (BEP-20)', minDeposit: 1 }] },
  { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', minDeposit: 1, confirmations: 12, icon: '$', limits: { daily: 50000, monthly: 500000 }, alternateNetworks: [{ network: 'Polygon', minDeposit: 1 }, { network: 'Arbitrum', minDeposit: 1 }] },
]

export default function CryptoDepositSafe() {
  const navigate = useNavigate()
  const [selectedAsset, setSelectedAsset] = useState(CRYPTO_ASSETS[0])
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [step, setStep] = useState<DepositStep>('select_network')
  const [addressVerified, setAddressVerified] = useState(false)
  const [submittingTx, setSubmittingTx] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      navigate('/dashboard')
      return
    }
    loadDepositAddress()
  }, [selectedAsset, selectedNetwork])

  const loadDepositAddress = async () => {
    setLoading(true)
    try {
      const res = await api.getMyDepositAddresses()
      const network = selectedNetwork || selectedAsset.network
      
      if (res.addresses?.cryptos?.[selectedAsset.symbol]) {
        const addr = res.addresses.cryptos[selectedAsset.symbol]
        setDepositAddress({
          asset: selectedAsset.symbol,
          address: addr.address,
          network: addr.network || network,
          minDeposit: selectedAsset.minDeposit,
          confirmations: selectedAsset.confirmations,
          note: addr.notes,
          alternateNetworks: selectedAsset.alternateNetworks,
        })
        setStep('select_network')
      } else {
        setDepositAddress(null)
      }
    } catch (err) {
      console.error('Failed to load deposit address:', err)
      setDepositAddress(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (depositAddress?.address) {
      QRCode.toDataURL(depositAddress.address, { width: 256, margin: 2 })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(''))
    }
  }, [depositAddress])

  const verifyAddress = () => {
    if (!depositAddress) return
    
    const warningText = 
      `⚠️ CRITICAL VERIFICATION\n\n` +
      `Please confirm these details before proceeding:\n\n` +
      `Asset: ${selectedAsset.symbol}\n` +
      `Network: ${selectedNetwork || selectedAsset.network}\n` +
      `Address: ${depositAddress.address}\n` +
      `Min Deposit: ${depositAddress.minDeposit} ${selectedAsset.symbol}\n\n` +
      `WARNING:\n` +
      `• Sending wrong asset = PERMANENT LOSS\n` +
      `• Sending on wrong network = PERMANENT LOSS\n` +
      `• No recovery possible if sent to wrong address\n\n` +
      `Type "VERIFY" to confirm and proceed:`

    const response = prompt(warningText)
    if (response === 'VERIFY') {
      setAddressVerified(true)
      setStep('send_crypto')
      toast.success('✓ Address verified. Ready to send crypto.')
    } else if (response !== null) {
      toast.error('Verification cancelled. Please type "VERIFY" exactly.')
    }
  }

  const handleSubmitTxHash = async () => {
    if (!depositAddress || !addressVerified) {
      toast.error('Please verify address first')
      return
    }

    setSubmittingTx(true)
    try {
      const txHashInput = prompt(
        'Enter your transaction hash (0x...):\n\n' +
        'Find this in your wallet after sending the crypto.\n' +
        'It should be 0x followed by 64 hex characters.'
      )
      
      if (!txHashInput) {
        setSubmittingTx(false)
        return
      }

      // Validate tx hash format
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHashInput)) {
        toast.error('Invalid tx hash format. Must be 0x + 64 hex characters')
        setSubmittingTx(false)
        return
      }

      // Ask for amount to verify
      const amountStr = prompt(
        `How much ${selectedAsset.symbol} did you send?\n\n` +
        `(Enter number only, e.g. 1.5 for 1.5 ${selectedAsset.symbol})`
      )
      
      if (!amountStr) {
        setSubmittingTx(false)
        return
      }

      const amount = parseFloat(amountStr)
      if (isNaN(amount) || amount <= 0) {
        toast.error('Invalid amount')
        setSubmittingTx(false)
        return
      }

      const network = selectedNetwork || selectedAsset.network
      
      // Submit to backend
      const result = await api.recordPendingDeposit({
        txHash: txHashInput,
        chainId: network,
        toAddress: depositAddress.address,
        fromAddress: '', // Will be auto-detected
        asset: selectedAsset.symbol,
        amount: amount,
      })

      setStep('pending')
      setAddressVerified(false)
      toast.success(
        `✓ Deposit submitted!\n\n` +
        `Admin will verify and credit your account within 24 hours.\n` +
        `Tx: ${txHashInput.slice(0, 10)}...`
      )
    } catch (err) {
      toast.error('Failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setSubmittingTx(false)
    }
  }

  if (!depositAddress) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-24 pb-16 px-6">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => navigate('/wallet')} className="flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44] mb-6">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="glass-card p-8 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-[#FF9800] mx-auto" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">No Deposit Address Configured</h2>
              <p className="text-sm text-[#737373]">Contact support to set up your deposit address</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" richColors />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/wallet')} className="flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44] mb-8">
            <ChevronLeft className="w-4 h-4" /> Back to Wallet
          </button>

          {/* Step Indicator */}
          <div className="mb-8">
            <h1 className="text-3xl font-light text-[#E5E5E5] mb-6">Deposit {selectedAsset.symbol}</h1>
            <div className="flex gap-2">
              {(['select_network', 'verify_address', 'send_crypto', 'submit_txhash', 'pending'] as const).map((s, i) => (
                <div key={s} className={`flex-1 h-1 rounded-full ${['select_network', 'verify_address', 'send_crypto', 'submit_txhash', 'pending'].indexOf(step) >= i ? 'bg-[#0C8B44]' : 'bg-[#ffffff10]'}`} />
              ))}
            </div>
          </div>

          {/* Step 1: Select Network */}
          {step === 'select_network' && (
            <div className="glass-card p-6 space-y-6">
              <div>
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Select Network</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedNetwork('')}
                    className={`w-full p-4 rounded-lg text-left transition-colors ${!selectedNetwork ? 'bg-[#0C8B44]/15 border border-[#0C8B44]/30' : 'bg-[#0a0e10] border border-[#ffffff08]'}`}
                  >
                    <p className="font-medium text-[#E5E5E5]">{selectedAsset.network}</p>
                    <p className="text-xs text-[#737373]">Min: {selectedAsset.minDeposit} {selectedAsset.symbol}</p>
                  </button>
                  {depositAddress.alternateNetworks?.map((net) => (
                    <button
                      key={net.network}
                      onClick={() => setSelectedNetwork(net.network)}
                      className={`w-full p-4 rounded-lg text-left transition-colors ${selectedNetwork === net.network ? 'bg-[#0C8B44]/15 border border-[#0C8B44]/30' : 'bg-[#0a0e10] border border-[#ffffff08]'}`}
                    >
                      <p className="font-medium text-[#E5E5E5]">{net.network}</p>
                      <p className="text-xs text-[#737373]">Min: {net.minDeposit} {selectedAsset.symbol}</p>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setStep('verify_address')}
                className="w-full px-4 py-3 bg-[#0C8B44] text-white rounded-lg font-medium hover:bg-[#0a7539] transition-colors"
              >
                Continue to Verify Address
              </button>
            </div>
          )}

          {/* Step 2: Verify Address */}
          {step === 'verify_address' && (
            <div className="glass-card p-6 space-y-6">
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-[#E5E5E5]">Verify Deposit Address</h2>
                
                {/* QR Code */}
                <div className="flex justify-center p-4 bg-[#0a0e10] rounded-lg">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR" className="w-48 h-48 rounded-lg bg-white p-2" />
                  ) : (
                    <div className="w-48 h-48 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                      <QrCode className="w-12 h-12 text-[#737373]" />
                    </div>
                  )}
                </div>

                {/* Address Display */}
                <div className="space-y-2">
                  <label className="text-xs text-[#737373] uppercase">Deposit Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={depositAddress.address}
                      readOnly
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-[#0a0e10] rounded-lg border border-[#ffffff10]">
                    <p className="text-[#737373]">Asset</p>
                    <p className="text-[#E5E5E5] font-medium">{selectedAsset.symbol}</p>
                  </div>
                  <div className="p-3 bg-[#0a0e10] rounded-lg border border-[#ffffff10]">
                    <p className="text-[#737373]">Network</p>
                    <p className="text-[#E5E5E5] font-medium">{selectedNetwork || selectedAsset.network}</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-4 bg-[#FF9800]/10 border border-[#FF9800]/30 rounded-lg flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#FF9800] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#E5E5E5] space-y-1">
                    <p className="font-medium">Critical Warning</p>
                    <p className="text-[#A0A0A0]">Sending wrong asset or using wrong network = PERMANENT LOSS. Verify address matches above before sending.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('select_network')}
                  className="flex-1 px-4 py-3 bg-[#1a1a1a] text-[#E5E5E5] rounded-lg font-medium hover:bg-[#252525] transition-colors border border-[#ffffff10]"
                >
                  Back
                </button>
                <button
                  onClick={verifyAddress}
                  className="flex-1 px-4 py-3 bg-[#0C8B44] text-white rounded-lg font-medium hover:bg-[#0a7539] transition-colors"
                >
                  Verify & Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Send Crypto */}
          {step === 'send_crypto' && addressVerified && (
            <div className="glass-card p-6 space-y-6">
              <div className="p-4 bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg flex gap-3">
                <Check className="w-5 h-5 text-[#0C8B44] shrink-0 mt-0.5" />
                <div className="text-xs text-[#E5E5E5]">
                  <p className="font-medium">Address Verified ✓</p>
                  <p className="text-[#A0A0A0]">Now send {selectedAsset.symbol} from your wallet to the address above.</p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-[#E5E5E5]">
                <p className="font-medium">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-2 text-[#A0A0A0]">
                  <li>Open your wallet (MetaMask, Trust Wallet, etc.)</li>
                  <li>Select {selectedNetwork || selectedAsset.network} network</li>
                  <li>Send {selectedAsset.symbol} to: {depositAddress.address.slice(0, 10)}...</li>
                  <li>Wait for transaction confirmation</li>
                  <li>Come back and submit transaction hash</li>
                </ol>
              </div>

              <button
                onClick={() => setStep('submit_txhash')}
                className="w-full px-4 py-3 bg-[#0C8B44] text-white rounded-lg font-medium hover:bg-[#0a7539] transition-colors"
              >
                I've Sent the Crypto - Submit Tx Hash
              </button>
            </div>
          )}

          {/* Step 4: Submit Tx Hash */}
          {step === 'submit_txhash' && addressVerified && (
            <div className="glass-card p-6 space-y-6">
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-[#E5E5E5]">Submit Transaction Hash</h2>
                <p className="text-xs text-[#737373]">Find your transaction hash in your wallet explorer or on Etherscan/Polygonscan, etc.</p>
              </div>

              <button
                onClick={handleSubmitTxHash}
                disabled={submittingTx}
                className="w-full px-4 py-4 bg-[#0C8B44] text-white rounded-lg font-medium hover:bg-[#0a7539] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submittingTx ? 'Submitting...' : '✓ Submit Transaction Hash'}
              </button>

              <button
                onClick={() => setStep('send_crypto')}
                className="w-full px-4 py-3 bg-[#1a1a1a] text-[#E5E5E5] rounded-lg border border-[#ffffff10] hover:bg-[#252525] transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 5: Pending */}
          {step === 'pending' && (
            <div className="glass-card p-6 space-y-6">
              <div className="p-4 bg-[#2196F3]/10 border border-[#2196F3]/30 rounded-lg flex gap-3">
                <Clock className="w-5 h-5 text-[#2196F3] shrink-0 mt-0.5 animate-spin" />
                <div className="text-sm text-[#E5E5E5]">
                  <p className="font-medium">Deposit Pending Admin Review</p>
                  <p className="text-xs text-[#A0A0A0] mt-1">Your transaction has been submitted. An admin will verify it on-chain within 24 hours and credit your account.</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep('select_network')
                  setAddressVerified(false)
                }}
                className="w-full px-4 py-3 bg-[#0C8B44] text-white rounded-lg font-medium hover:bg-[#0a7539] transition-colors"
              >
                Make Another Deposit
              </button>

              <button
                onClick={() => navigate('/wallet')}
                className="w-full px-4 py-3 bg-[#1a1a1a] text-[#E5E5E5] rounded-lg border border-[#ffffff10] hover:bg-[#252525] transition-colors"
              >
                Back to Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
