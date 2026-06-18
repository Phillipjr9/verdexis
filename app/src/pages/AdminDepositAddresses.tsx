import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { toast, Toaster } from 'sonner'
import { Save, QrCode, Trash2, Plus, Download } from 'lucide-react'
import { api } from '../lib/api'
import QRCode from 'qrcode'

interface CryptoAddress {
  currency: string
  network: string
  address: string
  memo?: string
  notes?: string
}

interface DepositAddresses {
  cryptos: Record<string, CryptoAddress>
  wire?: {
    beneficiaryName: string
    bankName: string
    routingNumber?: string
    swiftCode?: string
    accountNumber: string
    reference?: string
    notes?: string
  }
  notes?: string
}

const CRYPTO_OPTIONS = [
  { symbol: 'BTC', name: 'Bitcoin', networks: ['Bitcoin'] },
  { symbol: 'ETH', name: 'Ethereum', networks: ['Ethereum', 'Arbitrum', 'Optimism'] },
  { symbol: 'SOL', name: 'Solana', networks: ['Solana'] },
  { symbol: 'USDT', name: 'Tether', networks: ['Ethereum (ERC-20)', 'Tron (TRC-20)', 'BSC (BEP-20)'] },
  { symbol: 'USDC', name: 'USD Coin', networks: ['Ethereum', 'Polygon', 'Arbitrum'] },
]

export default function AdminDepositAddresses() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const userId = searchParams.get('userId')
  const userEmail = searchParams.get('email')

  const [addresses, setAddresses] = useState<DepositAddresses>({ cryptos: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!userId) {
      navigate('/admin')
      return
    }
    loadAddresses()
  }, [userId])

  const loadAddresses = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await api.getUserDepositAddresses(userId)
      if (res.addresses) {
        setAddresses(res.addresses)
        // Generate QR codes for existing addresses
        if (res.addresses.cryptos) {
          for (const [symbol, addr] of Object.entries(res.addresses.cryptos)) {
            generateQR(symbol, addr.address)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load addresses:', err)
      toast.error('Failed to load deposit addresses')
    } finally {
      setLoading(false)
    }
  }

  const generateQR = async (symbol: string, address: string) => {
    try {
      const qrUrl = await QRCode.toDataURL(address, { width: 256, margin: 2 })
      setQrCodes(prev => ({ ...prev, [symbol]: qrUrl }))
    } catch (err) {
      console.error('Failed to generate QR:', err)
    }
  }

  const addCrypto = (symbol: string) => {
    const crypto = CRYPTO_OPTIONS.find(c => c.symbol === symbol)
    if (!crypto) return
    
    setAddresses(prev => ({
      ...prev,
      cryptos: {
        ...prev.cryptos,
        [symbol]: {
          currency: symbol,
          network: crypto.networks[0],
          address: '',
          memo: '',
          notes: '',
        },
      },
    }))
  }

  const updateCrypto = (symbol: string, field: keyof CryptoAddress, value: string) => {
    setAddresses(prev => ({
      ...prev,
      cryptos: {
        ...prev.cryptos,
        [symbol]: {
          ...prev.cryptos[symbol],
          [field]: value,
        },
      },
    }))

    // Auto-generate QR when address changes
    if (field === 'address' && value) {
      generateQR(symbol, value)
    }
  }

  const removeCrypto = (symbol: string) => {
    setAddresses(prev => {
      const { [symbol]: _, ...rest } = prev.cryptos
      return { ...prev, cryptos: rest }
    })
    setQrCodes(prev => {
      const { [symbol]: _, ...rest } = prev
      return rest
    })
  }

  const downloadQR = (symbol: string) => {
    const qrUrl = qrCodes[symbol]
    if (!qrUrl) return
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `${symbol}-deposit-address.png`
    a.click()
    toast.success(`${symbol} QR code downloaded`)
  }

  const saveAddresses = async () => {
    if (!userId) return
    setSaving(true)
    try {
      await api.updateUserDepositAddresses(userId, addresses)
      toast.success('Deposit addresses saved successfully')
    } catch (err) {
      console.error('Failed to save addresses:', err)
      toast.error('Failed to save deposit addresses')
    } finally {
      setSaving(false)
    }
  }

  const availableCryptos = CRYPTO_OPTIONS.filter(c => !addresses.cryptos[c.symbol])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/admin')}
              className="text-sm text-[#737373] hover:text-[#0C8B44] transition-colors mb-4"
            >
              ← Back to Admin
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-light tracking-[-0.03em] text-[#E5E5E5]">
                  Manage Deposit Addresses
                </h1>
                <p className="text-sm text-[#737373] mt-1">
                  {userEmail || `User ID: ${userId}`}
                </p>
              </div>
              <button
                onClick={saveAddresses}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>

          {/* Crypto Addresses */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-light text-[#E5E5E5]">Cryptocurrency Addresses</h2>
              {availableCryptos.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#0C8B44]/20 border border-[#0C8B44] text-[#0C8B44] rounded-lg hover:bg-[#0C8B44]/30 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add Crypto
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-[#ffffff15] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {availableCryptos.map(crypto => (
                      <button
                        key={crypto.symbol}
                        onClick={() => addCrypto(crypto.symbol)}
                        className="w-full px-4 py-2 text-left text-sm text-[#E5E5E5] hover:bg-[#0C8B44]/20 first:rounded-t-lg last:rounded-b-lg transition-colors"
                      >
                        {crypto.symbol} - {crypto.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {Object.keys(addresses.cryptos).length === 0 ? (
              <div className="text-center py-12 text-[#737373]">
                <p>No cryptocurrency addresses configured</p>
                <p className="text-sm mt-2">Click "Add Crypto" to add deposit addresses</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(addresses.cryptos).map(([symbol, addr]) => {
                  const crypto = CRYPTO_OPTIONS.find(c => c.symbol === symbol)
                  return (
                    <div key={symbol} className="p-6 bg-[#0a0e10] border border-[#ffffff08] rounded-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-[#E5E5E5]">{symbol}</h3>
                          <p className="text-sm text-[#737373]">{crypto?.name}</p>
                        </div>
                        <button
                          onClick={() => removeCrypto(symbol)}
                          className="p-2 text-[#FF5252] hover:bg-[#FF5252]/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                          <div>
                            <label className="block text-sm text-[#A0A0A0] mb-2">Network</label>
                            <select
                              value={addr.network}
                              onChange={(e) => updateCrypto(symbol, 'network', e.target.value)}
                              className="w-full bg-[#070C0E] border border-[#ffffff15] rounded-lg px-4 py-2 text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                            >
                              {crypto?.networks.map(net => (
                                <option key={net} value={net}>{net}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-[#A0A0A0] mb-2">Address *</label>
                            <input
                              type="text"
                              value={addr.address}
                              onChange={(e) => updateCrypto(symbol, 'address', e.target.value)}
                              placeholder={`Enter ${symbol} address`}
                              className="w-full bg-[#070C0E] border border-[#ffffff15] rounded-lg px-4 py-2 text-[#E5E5E5] font-mono text-sm focus:outline-none focus:border-[#0C8B44]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-[#A0A0A0] mb-2">Memo/Tag (optional)</label>
                            <input
                              type="text"
                              value={addr.memo || ''}
                              onChange={(e) => updateCrypto(symbol, 'memo', e.target.value)}
                              placeholder="If required by network"
                              className="w-full bg-[#070C0E] border border-[#ffffff15] rounded-lg px-4 py-2 text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-[#A0A0A0] mb-2">Admin Notes (optional)</label>
                            <textarea
                              value={addr.notes || ''}
                              onChange={(e) => updateCrypto(symbol, 'notes', e.target.value)}
                              placeholder="Internal notes for admin reference"
                              rows={2}
                              className="w-full bg-[#070C0E] border border-[#ffffff15] rounded-lg px-4 py-2 text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                          {qrCodes[symbol] ? (
                            <div className="space-y-3">
                              <img
                                src={qrCodes[symbol]}
                                alt={`${symbol} QR Code`}
                                className="w-48 h-48 rounded-lg bg-white p-2"
                              />
                              <button
                                onClick={() => downloadQR(symbol)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0C8B44]/20 border border-[#0C8B44] text-[#0C8B44] rounded-lg hover:bg-[#0C8B44]/30 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Download QR
                              </button>
                            </div>
                          ) : (
                            <div className="w-48 h-48 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                              <QrCode className="w-12 h-12 text-[#737373]" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* General Notes */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-light text-[#E5E5E5] mb-4">General Notes</h2>
            <textarea
              value={addresses.notes || ''}
              onChange={(e) => setAddresses(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes visible to the user"
              rows={3}
              className="w-full bg-[#0a0e10] border border-[#ffffff15] rounded-lg px-4 py-3 text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
