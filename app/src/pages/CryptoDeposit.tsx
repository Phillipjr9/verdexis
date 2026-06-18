import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { toast, Toaster } from 'sonner'
import { Copy, QrCode, AlertCircle, ChevronLeft, Check, ExternalLink } from 'lucide-react'
import { api, getToken } from '../lib/api'
import QRCode from 'qrcode'

interface DepositAddress {
  asset: string
  address: string
  network: string
  minDeposit: number
  confirmations: number
  note?: string
}

const CRYPTO_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', minDeposit: 0.0001, confirmations: 3, icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum', minDeposit: 0.001, confirmations: 12, icon: 'Ξ' },
  { symbol: 'SOL', name: 'Solana', network: 'Solana', minDeposit: 0.01, confirmations: 1, icon: '◎' },
  { symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC-20)', minDeposit: 1, confirmations: 12, icon: '₮' },
  { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', minDeposit: 1, confirmations: 12, icon: '$' },
]

export default function CryptoDeposit() {
  const navigate = useNavigate()
  const [selectedAsset, setSelectedAsset] = useState(CRYPTO_ASSETS[0])
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      navigate('/dashboard')
      return
    }
    loadDepositAddress()
  }, [selectedAsset])

  const loadDepositAddress = async () => {
    setLoading(true)
    try {
      // Try to get existing deposit address from API
      const res = await api.getMyDepositAddresses()
      
      if (res.addresses && res.addresses[selectedAsset.symbol]) {
        const addr = res.addresses[selectedAsset.symbol]
        setDepositAddress({
          asset: selectedAsset.symbol,
          address: addr.address || generateMockAddress(selectedAsset.symbol),
          network: selectedAsset.network,
          minDeposit: selectedAsset.minDeposit,
          confirmations: selectedAsset.confirmations,
          note: addr.note,
        })
      } else {
        // Generate mock address for demo
        setDepositAddress({
          asset: selectedAsset.symbol,
          address: generateMockAddress(selectedAsset.symbol),
          network: selectedAsset.network,
          minDeposit: selectedAsset.minDeposit,
          confirmations: selectedAsset.confirmations,
          note: 'This is a demo address. In production, this would be your unique deposit address.',
        })
      }
    } catch (err) {
      console.error('Failed to load deposit address:', err)
      // Fallback to mock address
      setDepositAddress({
        asset: selectedAsset.symbol,
        address: generateMockAddress(selectedAsset.symbol),
        network: selectedAsset.network,
        minDeposit: selectedAsset.minDeposit,
        confirmations: selectedAsset.confirmations,
        note: 'Demo address - backend unavailable',
      })
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

  const generateMockAddress = (symbol: string): string => {
    const prefixes: Record<string, string> = {
      BTC: 'bc1q',
      ETH: '0x',
      SOL: '',
      USDT: '0x',
      USDC: '0x',
    }
    const prefix = prefixes[symbol] || '0x'
    const length = symbol === 'BTC' ? 42 : symbol === 'SOL' ? 44 : 40
    const chars = '0123456789abcdef'
    let addr = prefix
    for (let i = prefix.length; i < length; i++) {
      addr += chars[Math.floor(Math.random() * chars.length)]
    }
    return addr
  }

  const copyAddress = () => {
    if (!depositAddress) return
    navigator.clipboard.writeText(depositAddress.address)
    setCopied(true)
    toast.success('Address copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    if (!qrCodeUrl) return
    const a = document.createElement('a')
    a.href = qrCodeUrl
    a.download = `verdexis-${selectedAsset.symbol}-deposit.png`
    a.click()
    toast.success('QR code downloaded')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/wallet')}
              className="flex items-center gap-2 text-sm text-[#737373] hover:text-[#0C8B44] transition-colors mb-4"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Wallet
            </button>
            <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">
              Deposit Crypto
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              Send crypto to your Verdexis wallet
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Asset Selection */}
            <div className="lg:col-span-1">
              <div className="glass-card p-4">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Select Asset</h2>
                <div className="space-y-2">
                  {CRYPTO_ASSETS.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => setSelectedAsset(asset)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedAsset.symbol === asset.symbol
                          ? 'bg-[#0C8B44]/15 border border-[#0C8B44]/30'
                          : 'bg-[#0a0e10] border border-[#ffffff08] hover:border-[#0C8B44]/20'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                        selectedAsset.symbol === asset.symbol ? 'bg-[#0C8B44]' : 'bg-[#1a1a1a]'
                      }`}>
                        {asset.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-[#E5E5E5]">{asset.symbol}</p>
                        <p className="text-xs text-[#737373]">{asset.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Deposit Instructions */}
            <div className="lg:col-span-2 space-y-6">
              {loading ? (
                <div className="glass-card p-8 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : depositAddress ? (
                <>
                  {/* QR Code */}
                  <div className="glass-card p-6">
                    <div className="flex flex-col items-center">
                      {qrCodeUrl ? (
                        <div className="relative">
                          <img
                            src={qrCodeUrl}
                            alt="Deposit QR Code"
                            className="w-64 h-64 rounded-xl bg-white p-4"
                          />
                          <button
                            onClick={downloadQR}
                            className="absolute top-2 right-2 p-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors"
                            title="Download QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-64 h-64 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
                          <QrCode className="w-12 h-12 text-[#737373]" />
                        </div>
                      )}
                      <p className="text-xs text-[#737373] mt-4 text-center">
                        Scan this QR code with your wallet app
                      </p>
                    </div>
                  </div>

                  {/* Deposit Address */}
                  <div className="glass-card p-6">
                    <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Deposit Address</h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={depositAddress.address}
                        readOnly
                        className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 pr-12 text-[#E5E5E5] text-sm font-mono focus:outline-none focus:border-[#0C8B44]"
                      />
                      <button
                        onClick={copyAddress}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#737373] hover:text-[#0C8B44] transition-colors"
                        title="Copy address"
                      >
                        {copied ? <Check className="w-5 h-5 text-[#0C8B44]" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-[#737373]">
                      <span className="px-2 py-1 bg-[#0a0e10] rounded">Network: {depositAddress.network}</span>
                      <span className="px-2 py-1 bg-[#0a0e10] rounded">Min: {depositAddress.minDeposit} {selectedAsset.symbol}</span>
                    </div>
                  </div>

                  {/* Important Notes */}
                  <div className="glass-card p-6 border-l-4 border-[#FF9800]">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-[#FF9800] shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm text-[#E5E5E5]">
                        <p className="font-medium">Important Notes:</p>
                        <ul className="space-y-1 text-[#A0A0A0] list-disc list-inside">
                          <li>Only send <span className="text-[#E5E5E5] font-medium">{selectedAsset.symbol}</span> to this address on the <span className="text-[#E5E5E5] font-medium">{depositAddress.network}</span> network</li>
                          <li>Minimum deposit: <span className="text-[#E5E5E5] font-medium">{depositAddress.minDeposit} {selectedAsset.symbol}</span></li>
                          <li>Requires <span className="text-[#E5E5E5] font-medium">{depositAddress.confirmations} network confirmations</span> before credit</li>
                          <li>Sending any other asset or using a different network will result in permanent loss</li>
                          {depositAddress.note && <li className="text-[#FF9800]">{depositAddress.note}</li>}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Track Deposit */}
                  <div className="glass-card p-6">
                    <h3 className="text-sm font-medium text-[#E5E5E5] mb-3">Track Your Deposit</h3>
                    <p className="text-sm text-[#737373] mb-4">
                      Once you send funds, you can track the transaction on the blockchain explorer:
                    </p>
                    <button
                      onClick={() => {
                        const explorers: Record<string, string> = {
                          BTC: 'https://blockchair.com/bitcoin',
                          ETH: 'https://etherscan.io',
                          SOL: 'https://solscan.io',
                          USDT: 'https://etherscan.io',
                          USDC: 'https://etherscan.io',
                        }
                        window.open(explorers[selectedAsset.symbol] || 'https://etherscan.io', '_blank')
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#0a0e10] border border-[#ffffff15] rounded-lg text-sm text-[#A0A0A0] hover:text-[#0C8B44] hover:border-[#0C8B44]/30 transition-colors"
                    >
                      View on Explorer <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
