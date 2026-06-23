import { useState, useEffect } from 'react'
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

interface Web3DepositSettings {
  '0x1'?: {
    address: string
    label?: string
    notes?: string
  }
  '0xaa36a7'?: {
    address: string
    label?: string
    notes?: string
  }
  '0x89'?: {
    address: string
    label?: string
    notes?: string
  }
  '0xa4b1'?: {
    address: string
    label?: string
    notes?: string
  }
}

const CHAINS = [
  { id: '0x1', name: 'Ethereum Mainnet' },
  { id: '0xaa36a7', name: 'Sepolia Testnet' },
  { id: '0x89', name: 'Polygon' },
  { id: '0xa4b1', name: 'Arbitrum' },
]

export function AdminWeb3DepositSettings() {
  const [settings, setSettings] = useState<Web3DepositSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Load current settings
  useEffect(() => {
    ;(async () => {
      try {
        const instructions = await api.getDepositInstructions()
        const web3Settings = (instructions.instructions as { web3?: Web3DepositSettings })?.web3 || {}
        setSettings(web3Settings)
      } catch (err) {
        console.error('Failed to load deposit instructions:', err)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleAddressChange = (chainId: string, field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [chainId]: {
        ...(prev[chainId as keyof Web3DepositSettings] || {}),
        [field]: value,
      },
    }))
    setSuccess(false)
  }

  const handleSave = async () => {
    // Validate addresses
    for (const [chainId, config] of Object.entries(settings)) {
      if (config?.address) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(config.address)) {
          toast.error(`Invalid address on ${CHAINS.find((c) => c.id === chainId)?.name}`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const allInstructions = await api.getDepositInstructions()
      const updated = {
        ...(allInstructions.instructions || {}),
        web3: settings,
      }
      await api.putDepositInstructions(updated)
      setSuccess(true)
      toast.success('Web3 deposit addresses updated')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save:', err)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-[#737373]">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-xl border border-[#ffffff10]">
        <h3 className="text-lg font-semibold text-[#E5E5E5] mb-2">Web3 Deposit Addresses</h3>
        <p className="text-sm text-[#737373] mb-6">
          Configure blockchain addresses where users can send crypto directly. Users will see these addresses in the
          Web3 transfer form and can deposit without intermediaries.
        </p>

        <div className="space-y-6">
          {CHAINS.map((chain) => {
            const config = settings[chain.id as keyof Web3DepositSettings]
            return (
              <div key={chain.id} className="border-b border-[#ffffff10] pb-6 last:border-0 last:pb-0">
                <h4 className="font-medium text-[#E5E5E5] mb-3">{chain.name}</h4>

                {/* Address */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={config?.address || ''}
                    onChange={(e) => handleAddressChange(chain.id, 'address', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#E5E5E5] placeholder-[#737373] font-mono text-sm focus:border-[#0C8B44] outline-none transition-colors"
                  />
                  {config?.address && !/^0x[a-fA-F0-9]{40}$/.test(config.address) && (
                    <p className="text-[10px] text-[#ff9800] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Invalid Ethereum address
                    </p>
                  )}
                </div>

                {/* Label */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Label (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Main Treasury"
                    value={config?.label || ''}
                    onChange={(e) => handleAddressChange(chain.id, 'label', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#E5E5E5] placeholder-[#737373] focus:border-[#0C8B44] outline-none transition-colors"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Notes (optional)</label>
                  <textarea
                    placeholder="e.g., Used for user deposits. Multi-sig protected."
                    value={config?.notes || ''}
                    onChange={(e) => handleAddressChange(chain.id, 'notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#E5E5E5] placeholder-[#737373] focus:border-[#0C8B44] outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0C8B44] hover:bg-[#0a7035] text-white font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Addresses
              </>
            )}
          </button>

          {success && (
            <div className="flex items-center gap-2 text-[#4caf50] text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Saved successfully
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="glass-card p-4 rounded-xl border border-[#0C8B44]/30 bg-[#0C8B44]/5">
        <h4 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          How it works
        </h4>
        <ul className="text-xs text-[#737373] space-y-1">
          <li>• Users connect MetaMask or other Web3 wallets</li>
          <li>• They see your configured deposit address for their chain</li>
          <li>• They send crypto directly to your address via blockchain</li>
          <li>• System records pending deposits for admin review</li>
          <li>• Admin credits user account after verifying on-chain transaction</li>
        </ul>
      </div>
    </div>
  )
}
