import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { toast, Toaster } from 'sonner'
import { Copy, QrCode, AlertCircle, ChevronLeft, Check, ExternalLink, Clock, Bell, BellOff, Shield, TrendingUp } from 'lucide-react'
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

interface PendingDeposit {
  id: string
  asset: string
  amount: number
  address: string
  txHash: string
  confirmations: number
  requiredConfirmations: number
  status: 'pending' | 'confirmed' | 'credited'
  timestamp: Date
}

const CRYPTO_ASSETS = [
  { 
    symbol: 'BTC', 
    name: 'Bitcoin', 
    network: 'Bitcoin', 
    minDeposit: 0.0001, 
    confirmations: 3, 
    icon: '₿',
    limits: { daily: 10, monthly: 100 },
  },
  { 
    symbol: 'ETH', 
    name: 'Ethereum', 
    network: 'Ethereum (ERC-20)', 
    minDeposit: 0.001, 
    confirmations: 12, 
    icon: 'Ξ',
    limits: { daily: 50, monthly: 500 },
    alternateNetworks: [
      { network: 'Arbitrum', minDeposit: 0.001 },
      { network: 'Optimism', minDeposit: 0.001 },
    ],
  },
  { 
    symbol: 'SOL', 
    name: 'Solana', 
    network: 'Solana', 
    minDeposit: 0.01, 
    confirmations: 1, 
    icon: '◎',
    limits: { daily: 1000, monthly: 10000 },
  },
  { 
    symbol: 'USDT', 
    name: 'Tether', 
    network: 'Ethereum (ERC-20)', 
    minDeposit: 1, 
    confirmations: 12, 
    icon: '₮',
    limits: { daily: 50000, monthly: 500000 },
    alternateNetworks: [
      { network: 'Tron (TRC-20)', minDeposit: 1 },
      { network: 'BSC (BEP-20)', minDeposit: 1 },
    ],
  },
  { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    network: 'Ethereum (ERC-20)', 
    minDeposit: 1, 
    confirmations: 12, 
    icon: '$',
    limits: { daily: 50000, monthly: 500000 },
    alternateNetworks: [
      { network: 'Polygon', minDeposit: 1 },
      { network: 'Arbitrum', minDeposit: 1 },
    ],
  },
]

export default function CryptoDeposit() {
  const navigate = useNavigate()
  const [selectedAsset, setSelectedAsset] = useState(CRYPTO_ASSETS[0])
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [verificationTier, setVerificationTier] = useState<'unverified' | 'basic' | 'advanced'>('basic')

  useEffect(() => {
    if (!getToken()) {
      navigate('/dashboard')
      return
    }
    loadDepositAddress()
    loadPendingDeposits()
    loadUserPreferences()
  }, [selectedAsset, selectedNetwork])

  const loadDepositAddress = async () => {
    setLoading(true)
    try {
      const res = await api.getMyDepositAddresses()
      const network = selectedNetwork || selectedAsset.network
      
      if (res.addresses && res.addresses.cryptos && res.addresses.cryptos[selectedAsset.symbol]) {
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

  const loadPendingDeposits = async () => {
    try {
      // Load actual pending deposits from backend
      // For now, show empty until backend implements this endpoint
      setPendingDeposits([])
    } catch (err) {
      console.error('Failed to load pending deposits:', err)
    }
  }

  const loadUserPreferences = async () => {
    try {
      const prefs = JSON.parse(localStorage.getItem('verdexis_prefs') || '{}')
      setEmailNotifications(prefs.emailAlerts !== false)
      setVerificationTier('basic')
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  useEffect(() => {
    if (depositAddress?.address) {
      QRCode.toDataURL(depositAddress.address, { width: 256, margin: 2 })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(''))
    }
  }, [depositAddress])



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

  const toggleNotifications = async () => {
    const newValue = !emailNotifications
    setEmailNotifications(newValue)
    try {
      const prefs = JSON.parse(localStorage.getItem('verdexis_prefs') || '{}')
      prefs.emailAlerts = newValue
      localStorage.setItem('verdexis_prefs', JSON.stringify(prefs))
      if (getToken()) {
        await api.patchProfile({ prefs })
      }
      toast.success(newValue ? 'Email notifications enabled' : 'Email notifications disabled')
    } catch (err) {
      console.error('Failed to update notifications:', err)
    }
  }

  const getDepositLimits = () => {
    const tierLimits = {
      unverified: { daily: 500, monthly: 2000 },
      basic: { daily: 10000, monthly: 50000 },
      advanced: { daily: 100000, monthly: 1000000 },
    }
    return tierLimits[verificationTier]
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const limits = getDepositLimits()

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">
                  Deposit Crypto
                </h1>
                <p className="text-sm text-[#737373] mt-1">
                  Send crypto to your Verdexis wallet
                </p>
              </div>
              <button
                onClick={toggleNotifications}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#ffffff08] rounded-lg hover:border-[#0C8B44]/30 transition-colors"
                title={emailNotifications ? 'Disable email notifications' : 'Enable email notifications'}
              >
                {emailNotifications ? <Bell className="w-4 h-4 text-[#0C8B44]" /> : <BellOff className="w-4 h-4 text-[#737373]" />}
                <span className="text-xs text-[#A0A0A0]">Notifications</span>
              </button>
            </div>
          </div>

          {/* Verification Tier & Limits */}
          <div className="glass-card p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className={`w-5 h-5 ${verificationTier === 'advanced' ? 'text-[#0C8B44]' : verificationTier === 'basic' ? 'text-[#2196F3]' : 'text-[#737373]'}`} />
              <div>
                <p className="text-sm font-medium text-[#E5E5E5] capitalize">{verificationTier} Verification</p>
                <p className="text-xs text-[#737373]">Daily: ${limits.daily.toLocaleString()} • Monthly: ${limits.monthly.toLocaleString()}</p>
              </div>
            </div>
            {verificationTier !== 'advanced' && (
              <Link to="/kyc" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Upgrade
              </Link>
            )}
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
                      onClick={() => { setSelectedAsset(asset); setSelectedNetwork('') }}
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
              {/* Pending Deposits */}
              {pendingDeposits.length > 0 && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#FF9800]" />
                      Pending Deposits ({pendingDeposits.length})
                    </h3>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors"
                    >
                      {showHistory ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showHistory && (
                    <div className="space-y-3">
                      {pendingDeposits.map((deposit) => (
                        <div key={deposit.id} className="p-4 rounded-lg bg-[#0a0e10] border border-[#ffffff08]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#E5E5E5]">
                                {deposit.amount} {deposit.asset}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                deposit.status === 'confirmed' ? 'bg-[#4CAF50]/20 text-[#4CAF50]' :
                                deposit.status === 'credited' ? 'bg-[#0C8B44]/20 text-[#0C8B44]' :
                                'bg-[#FF9800]/20 text-[#FF9800]'
                              }`}>
                                {deposit.status === 'pending' ? `${deposit.confirmations}/${deposit.requiredConfirmations}` : deposit.status}
                              </span>
                            </div>
                            <span className="text-xs text-[#737373]">{formatTimeAgo(deposit.timestamp)}</span>
                          </div>
                          <p className="text-xs text-[#737373] font-mono truncate">TX: {deposit.txHash}</p>
                          <div className="mt-2 w-full bg-[#1a1a1a] rounded-full h-1.5">
                            <div 
                              className="bg-[#0C8B44] h-1.5 rounded-full transition-all" 
                              style={{ width: `${(deposit.confirmations / deposit.requiredConfirmations) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="glass-card p-8 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !depositAddress ? (
                <div className="glass-card p-8">
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-[#FF9800]" />
                    <div>
                      <h3 className="text-lg font-medium text-[#E5E5E5] mb-2">No Deposit Address Assigned</h3>
                      <p className="text-sm text-[#737373] max-w-md">
                        Your deposit address for {selectedAsset.symbol} has not been configured yet.
                        Please contact support to set up your personalized deposit address.
                      </p>
                    </div>
                    <button
                      onClick={() => window.open('https://wa.me/17196798790', '_blank')}
                      className="px-6 py-3 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors"
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              ) : depositAddress ? (
                <>
                  {/* Network Selection */}
                  {depositAddress.alternateNetworks && depositAddress.alternateNetworks.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="text-sm font-medium text-[#E5E5E5] mb-3">Select Network</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSelectedNetwork('')}
                          className={`p-3 rounded-lg text-left transition-colors ${
                            !selectedNetwork ? 'bg-[#0C8B44]/15 border border-[#0C8B44]/30' : 'bg-[#0a0e10] border border-[#ffffff08]'
                          }`}
                        >
                          <p className="text-sm text-[#E5E5E5]">{selectedAsset.network}</p>
                          <p className="text-xs text-[#737373]">Min: {selectedAsset.minDeposit}</p>
                        </button>
                        {depositAddress.alternateNetworks.map((net) => (
                          <button
                            key={net.network}
                            onClick={() => setSelectedNetwork(net.network)}
                            className={`p-3 rounded-lg text-left transition-colors ${
                              selectedNetwork === net.network ? 'bg-[#0C8B44]/15 border border-[#0C8B44]/30' : 'bg-[#0a0e10] border border-[#ffffff08]'
                            }`}
                          >
                            <p className="text-sm text-[#E5E5E5]">{net.network}</p>
                            <p className="text-xs text-[#737373]">Min: {net.minDeposit}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                          <li>This address is unique to your account - do not share it</li>
                          {depositAddress.note && <li className="text-[#0C8B44]">{depositAddress.note}</li>}
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
