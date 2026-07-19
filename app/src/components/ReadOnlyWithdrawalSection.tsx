/**
 * UPDATED WITHDRAWAL COMPONENT
 * 
 * Users can NO LONGER link banks themselves.
 * They can only withdraw to admin-configured destinations:
 * - ACH (if admin set it up)
 * - Wire (if admin set it up)
 * - Crypto (always available if admin configured addresses)
 */

import { useState, useEffect } from 'react'
import { AlertCircle, Building2, Banknote, Copy, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

interface AdminConfiguredBankAccount {
  bankName: string
  accountMask: string
  institution: string
  verified: boolean
}

interface AdminConfiguredWire {
  beneficiaryName: string
  bankName: string
  accountNumber: string
  routingNumber: string
  swiftCode?: string
  reference?: string
}

interface WithdrawalOptions {
  crypto: {
    enabled: boolean
    currencies: string[]
  }
  ach: {
    enabled: boolean
    account?: AdminConfiguredBankAccount
  }
  wire: {
    enabled: boolean
    details?: AdminConfiguredWire
  }
}

export function ReadOnlyWithdrawalSection() {
  const [options, setOptions] = useState<WithdrawalOptions | null>(null)
  const [config, setConfig] = useState<{ enabled: boolean; networks: { chain: string; enabled: boolean }[]; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<'crypto' | 'ach' | 'wire'>('crypto')

  useEffect(() => {
    loadWithdrawalOptions()
  }, [])

  async function loadWithdrawalOptions() {
    try {
      const [response, withdrawalConfig] = await Promise.all([
        api.getWithdrawalOptions(),
        api.getWithdrawalConfig(),
      ])

      setOptions(response)
      setConfig(withdrawalConfig)

      if (response.crypto.enabled) {
        setSelectedMethod('crypto')
      } else if (response.ach.enabled) {
        setSelectedMethod('ach')
      } else if (response.wire.enabled) {
        setSelectedMethod('wire')
      }
    } catch (error) {
      toast.error('Failed to load withdrawal options')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <p className="text-sm text-[#A0A0A0]">Loading withdrawal options...</p>
      </div>
    )
  }

  if (!options) {
    return (
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">No withdrawal methods available</p>
            <p className="text-xs text-[#A0A0A0] mt-1">
              Please contact support to set up withdrawal options for your account.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const hasAnyMethod = options.crypto.enabled || options.ach.enabled || options.wire.enabled

  if (!hasAnyMethod) {
    return (
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">Withdrawal not yet configured</p>
            <p className="text-xs text-[#A0A0A0] mt-1">
              Your account manager needs to configure withdrawal destinations. 
              Please reach out to support to set this up.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Method selector */}
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Select withdrawal method</h3>
        
        <div className="grid grid-cols-1 gap-3">
          {/* Crypto option */}
          {options.crypto.enabled && (
            <button
              onClick={() => setSelectedMethod('crypto')}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedMethod === 'crypto'
                  ? 'border-[#0C8B44] bg-[#0C8B44]/10'
                  : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center">
                    <span className="text-[#0C8B44] text-lg">₿</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E5E5E5]">Crypto withdrawal</p>
                    <p className="text-xs text-[#A0A0A0] mt-0.5">
                      Available: {options.crypto.currencies.join(', ')}
                    </p>
                  </div>
                </div>
                {selectedMethod === 'crypto' && (
                  <CheckCircle className="w-5 h-5 text-[#0C8B44]" />
                )}
              </div>
            </button>
          )}

          {/* ACH option */}
          {options.ach.enabled && options.ach.account && (
            <button
              onClick={() => setSelectedMethod('ach')}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedMethod === 'ach'
                  ? 'border-[#0C8B44] bg-[#0C8B44]/10'
                  : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-[#0C8B44]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E5E5E5]">ACH bank transfer</p>
                    <p className="text-xs text-[#A0A0A0] mt-0.5">
                      {options.ach.account.institution} ····{options.ach.account.accountMask}
                    </p>
                    {options.ach.account.verified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#4CAF50] mt-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#F57C00] mt-1">Pending verification</span>
                    )}
                  </div>
                </div>
                {selectedMethod === 'ach' && (
                  <CheckCircle className="w-5 h-5 text-[#0C8B44]" />
                )}
              </div>
            </button>
          )}

          {/* Wire option */}
          {options.wire.enabled && options.wire.details && (
            <button
              onClick={() => setSelectedMethod('wire')}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedMethod === 'wire'
                  ? 'border-[#0C8B44] bg-[#0C8B44]/10'
                  : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#0C8B44]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E5E5E5]">Wire transfer</p>
                    <p className="text-xs text-[#A0A0A0] mt-0.5">
                      {options.wire.details.bankName} · {options.wire.details.beneficiaryName}
                    </p>
                  </div>
                </div>
                {selectedMethod === 'wire' && (
                  <CheckCircle className="w-5 h-5 text-[#0C8B44]" />
                )}
              </div>
            </button>
          )}
        </div>

        {/* Info banner */}
        <div className={`mt-4 p-3 rounded-lg border ${config?.enabled ? 'bg-[#0C8B44]/10 border-[#0C8B44]/30' : 'bg-[#F57C00]/10 border-[#F57C00]/30'}`}>
          <p className={`text-xs flex items-start gap-2 ${config?.enabled ? 'text-[#0C8B44]' : 'text-[#F57C00]'}`}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {config?.message ?? 'Withdrawal methods are configured by your account manager. Contact support if you need to add or change withdrawal destinations.'}
            </span>
          </p>
          {config && (
            <div className="mt-2 flex flex-wrap gap-2">
              {config.networks.map((network) => (
                <span
                  key={network.chain}
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${network.enabled ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'bg-[#F57C00]/15 text-[#F57C00]'}`}
                >
                  {network.chain} {network.enabled ? 'active' : 'pending'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected method details */}
      {selectedMethod === 'wire' && options.wire.details && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
          <h4 className="text-sm font-medium text-[#E5E5E5] mb-4">Wire transfer details</h4>
          
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-start">
              <span className="text-[#737373]">Beneficiary</span>
              <span className="text-[#E5E5E5] text-right">{options.wire.details.beneficiaryName}</span>
            </div>
            
            <div className="flex justify-between items-start">
              <span className="text-[#737373]">Bank name</span>
              <span className="text-[#E5E5E5] text-right">{options.wire.details.bankName}</span>
            </div>
            
            <div className="flex justify-between items-start">
              <span className="text-[#737373]">Account number</span>
              <div className="flex items-center gap-2">
                <span className="text-[#E5E5E5] font-mono">
                  ····{options.wire.details.accountNumber.slice(-4)}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(options.wire.details!.accountNumber)
                    toast.success('Account number copied')
                  }}
                  className="p-1 hover:bg-[#ffffff10] rounded"
                  title="Copy account number"
                >
                  <Copy className="w-3 h-3 text-[#737373]" />
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-start">
              <span className="text-[#737373]">Routing number</span>
              <div className="flex items-center gap-2">
                <span className="text-[#E5E5E5] font-mono">{options.wire.details.routingNumber}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(options.wire.details!.routingNumber)
                    toast.success('Routing number copied')
                  }}
                  className="p-1 hover:bg-[#ffffff10] rounded"
                  title="Copy routing number"
                >
                  <Copy className="w-3 h-3 text-[#737373]" />
                </button>
              </div>
            </div>
            
            {options.wire.details.swiftCode && (
              <div className="flex justify-between items-start">
                <span className="text-[#737373]">SWIFT code</span>
                <span className="text-[#E5E5E5] font-mono">{options.wire.details.swiftCode}</span>
              </div>
            )}
            
            {options.wire.details.reference && (
              <div className="flex justify-between items-start">
                <span className="text-[#737373]">Reference</span>
                <span className="text-[#E5E5E5]">{options.wire.details.reference}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
