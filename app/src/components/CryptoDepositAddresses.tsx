import { useEffect, useState } from 'react'
import { Copy, Trash2, Plus, QrCode } from 'lucide-react'
import { toast } from 'sonner'

interface DepositAddress {
  address: string
  currency: string
  chainId?: string
  network?: string
  qrCodeUrl?: string
}

interface WalletLink {
  id: string
  address: string
  chainId?: string
  provider?: string
  label?: string
  isPrimary: boolean
  linkedAt: string
}

export function CryptoDepositAddresses() {
  const [selectedCurrency, setSelectedCurrency] = useState<string>('btc')
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null)
  const [walletLinks, setWalletLinks] = useState<WalletLink[]>([])
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [supportedCurrencies, setSupportedCurrencies] = useState<any[]>([])

  useEffect(() => {
    fetchSupportedCurrencies()
    fetchWalletLinks()
  }, [])

  const fetchSupportedCurrencies = async () => {
    try {
      const res = await fetch('/api/deposit-addresses/supported')
      const data = await res.json()
      setSupportedCurrencies(data.currencies)
    } catch (err) {
      console.error('Failed to fetch supported currencies:', err)
    }
  }

  const fetchWalletLinks = async () => {
    try {
      const res = await fetch('/api/deposit-addresses')
      if (!res.ok) throw new Error('Failed to fetch wallet links')
      const data = await res.json()
      setWalletLinks(data.addresses)
    } catch (err) {
      console.error('Failed to fetch wallet links:', err)
    }
  }

  const generateAddress = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deposit-addresses/generate?currency=${selectedCurrency}`)
      if (!res.ok) throw new Error('Failed to generate address')
      const data = await res.json()
      setDepositAddress(data)
      setShowQR(true)
      toast.success('Deposit address generated!')
    } catch (err) {
      toast.error((err as Error).message || 'Failed to generate address')
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = () => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address)
      toast.success('Address copied to clipboard!')
    }
  }

  const deleteWallet = async (id: string) => {
    if (!confirm('Delete this wallet address?')) return
    try {
      const res = await fetch(`/api/deposit-addresses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete wallet')
      setWalletLinks(walletLinks.filter((w) => w.id !== id))
      toast.success('Wallet deleted!')
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete wallet')
    }
  }

  return (
    <div className="space-y-6">
      {/* Generate Address Section */}
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <h2 className="text-xl font-semibold text-white mb-4">Generate Deposit Address</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#A0A0A0] mb-2">Select Currency</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full bg-[#070C0E] border border-[#1a2329] rounded-lg px-4 py-2 text-white"
            >
              {supportedCurrencies.map((currency) => (
                <option key={currency.symbol} value={currency.symbol}>
                  {currency.name} ({currency.symbol.toUpperCase()}) - {currency.network}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generateAddress}
            disabled={loading}
            className="w-full bg-[#0C8B44] hover:bg-[#0a6b35] disabled:opacity-50 text-white py-2 rounded-lg font-medium transition"
          >
            {loading ? 'Generating...' : 'Generate Address'}
          </button>
        </div>
      </div>

      {/* Display Generated Address */}
      {depositAddress && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
          <h3 className="text-lg font-semibold text-white mb-4">Your {depositAddress.currency.toUpperCase()} Address</h3>
          
          <div className="space-y-4">
            {/* Network Info */}
            <div className="bg-[#070C0E] rounded p-3 text-sm text-[#A0A0A0]">
              <p><strong>Network:</strong> {depositAddress.network}</p>
              {depositAddress.chainId && <p><strong>Chain ID:</strong> {depositAddress.chainId}</p>}
            </div>

            {/* Address */}
            <div className="bg-[#070C0E] rounded p-4 flex items-center justify-between gap-2">
              <code className="text-[#0C8B44] font-mono text-sm break-all">{depositAddress.address}</code>
              <button
                onClick={copyAddress}
                className="text-[#A0A0A0] hover:text-white transition p-2"
                title="Copy address"
              >
                <Copy size={18} />
              </button>
            </div>

            {/* QR Code Toggle */}
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 text-[#0C8B44] hover:text-[#0a6b35] text-sm font-medium"
            >
              <QrCode size={16} />
              {showQR ? 'Hide' : 'Show'} QR Code
            </button>

            {/* QR Code */}
            {showQR && depositAddress.qrCodeUrl && (
              <div className="flex justify-center bg-white p-4 rounded">
                <img
                  src={depositAddress.qrCodeUrl}
                  alt="QR Code"
                  className="w-40 h-40"
                />
              </div>
            )}

            {/* Warning */}
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-3 text-sm text-yellow-200">
              ⚠️ Only send {depositAddress.currency.toUpperCase()} to this address on the {depositAddress.network}. Sending other assets may result in loss of funds.
            </div>
          </div>
        </div>
      )}

      {/* Linked Wallets */}
      {walletLinks.length > 0 && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
          <h3 className="text-lg font-semibold text-white mb-4">Linked Wallets</h3>
          
          <div className="space-y-3">
            {walletLinks.map((wallet) => (
              <div
                key={wallet.id}
                className="bg-[#070C0E] rounded p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-[#0C8B44] font-mono text-sm">{wallet.address}</code>
                    {wallet.isPrimary && (
                      <span className="text-xs bg-[#0C8B44] text-black px-2 py-1 rounded">Primary</span>
                    )}
                  </div>
                  {wallet.label && <p className="text-xs text-[#A0A0A0] mt-1">{wallet.label}</p>}
                  {wallet.provider && <p className="text-xs text-[#737373]">{wallet.provider}</p>}
                </div>
                <button
                  onClick={() => deleteWallet(wallet.id)}
                  className="text-red-500 hover:text-red-400 transition p-2"
                  title="Delete wallet"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {walletLinks.length === 0 && !depositAddress && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329] text-center">
          <Plus size={32} className="mx-auto text-[#737373] mb-2" />
          <p className="text-[#A0A0A0]">No deposit addresses yet. Generate one to start receiving crypto.</p>
        </div>
      )}
    </div>
  )
}
