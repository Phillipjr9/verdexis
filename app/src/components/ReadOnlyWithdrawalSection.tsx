/**
 * User withdrawal method selection (read-only destinations).
 * Admin configures ACH / Wire / Check; crypto is always available when enabled.
 * Users never enter bank or mailing details themselves.
 */

import { useState, useEffect } from 'react'
import { AlertCircle, Building2, Banknote, FileText, CheckCircle } from 'lucide-react'
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
  accountMask?: string
  routingMask?: string
  swiftCode?: string
  reference?: string
}

interface AdminConfiguredCheck {
  payeeName: string
  mailingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country?: string
  }
  notes?: string
}

export type WithdrawalMethod = 'crypto' | 'ach' | 'wire' | 'cashier_check' | 'wire_check'

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
  check: {
    enabled: boolean
    types: Array<'cashier_check' | 'wire_check'>
    details?: AdminConfiguredCheck
  }
}

export function ReadOnlyWithdrawalSection({
  onMethodChange,
}: {
  onMethodChange?: (method: WithdrawalMethod) => void
} = {}) {
  const [options, setOptions] = useState<WithdrawalOptions | null>(null)
  const [config, setConfig] = useState<{
    enabled: boolean
    networks: { chain: string; enabled: boolean }[]
    message: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod>('crypto')

  useEffect(() => {
    loadWithdrawalOptions()
  }, [])

  async function loadWithdrawalOptions() {
    try {
      const [response, withdrawalConfig] = await Promise.all([
        api.getWithdrawalOptions(),
        api.getWithdrawalConfig(),
      ])

      setOptions(response as WithdrawalOptions)
      setConfig(withdrawalConfig)

      const opts = response as WithdrawalOptions
      let initial: WithdrawalMethod = 'crypto'
      if (opts.crypto?.enabled) initial = 'crypto'
      else if (opts.ach?.enabled) initial = 'ach'
      else if (opts.wire?.enabled) initial = 'wire'
      else if (opts.check?.enabled && opts.check.types?.includes('cashier_check')) initial = 'cashier_check'
      else if (opts.check?.enabled && opts.check.types?.includes('wire_check')) initial = 'wire_check'

      setSelectedMethod(initial)
      onMethodChange?.(initial)
    } catch {
      toast.error('Failed to load withdrawal options')
    } finally {
      setLoading(false)
    }
  }

  function selectMethod(method: WithdrawalMethod) {
    setSelectedMethod(method)
    onMethodChange?.(method)
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
            <p className="text-sm font-medium text-[#E5E5E5]">No withdrawal methods available yet</p>
            <p className="text-xs text-[#A0A0A0] mt-1">Contact support if you need to withdraw.</p>
          </div>
        </div>
      </div>
    )
  }

  const hasCheck =
    options.check?.enabled &&
    Array.isArray(options.check.types) &&
    options.check.types.length > 0
  const hasAnyMethod =
    options.crypto.enabled || options.ach.enabled || options.wire.enabled || hasCheck

  if (!hasAnyMethod) {
    return (
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">Withdrawal not yet configured</p>
            <p className="text-xs text-[#A0A0A0] mt-1">
              Your account manager needs to configure withdrawal destinations. Please reach out to
              support to set this up.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const checkDetails = options.check?.details
  const mailingCityState =
    checkDetails?.mailingAddress?.city && checkDetails?.mailingAddress?.state
      ? `${checkDetails.mailingAddress.city}, ${checkDetails.mailingAddress.state}`
      : null

  return (
    <div className="space-y-4">
      <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
        <h3 className="text-sm font-medium text-[#E5E5E5] mb-1">Withdraw</h3>
        <p className="text-xs text-[#A0A0A0] mb-4">Choose how you’d like to receive your funds.</p>

        <div className="grid grid-cols-1 gap-3">
          {options.crypto.enabled && (
            <MethodCard
              selected={selectedMethod === 'crypto'}
              onClick={() => selectMethod('crypto')}
              icon={<span className="text-[#0C8B44] text-lg">₿</span>}
              title="Crypto"
              subtitle="Sent to your linked wallet on the selected network. Usually processed within minutes after approval."
            />
          )}

          {options.ach.enabled && options.ach.account && (
            <MethodCard
              selected={selectedMethod === 'ach'}
              onClick={() => selectMethod('ach')}
              icon={<Banknote className="w-5 h-5 text-[#0C8B44]" />}
              title="ACH Transfer"
              subtitle={`Deposited to the bank account on file. ${options.ach.account.institution} ····${options.ach.account.accountMask}. 1–3 business days after approval.`}
              badge={options.ach.account.verified ? 'Verified' : 'Pending verification'}
              badgeTone={options.ach.account.verified ? 'ok' : 'warn'}
            />
          )}

          {options.wire.enabled && options.wire.details && (
            <MethodCard
              selected={selectedMethod === 'wire'}
              onClick={() => selectMethod('wire')}
              icon={<Building2 className="w-5 h-5 text-[#0C8B44]" />}
              title="Wire Transfer"
              subtitle={`Sent to the bank details on file. ${options.wire.details.bankName} · ${options.wire.details.beneficiaryName}. Same-day or next business day after approval.`}
            />
          )}

          {hasCheck && options.check.types.includes('cashier_check') && (
            <MethodCard
              selected={selectedMethod === 'cashier_check'}
              onClick={() => selectMethod('cashier_check')}
              icon={<FileText className="w-5 h-5 text-[#0C8B44]" />}
              title="Cashier’s Check"
              subtitle="A bank-issued check mailed to the address on file. 5–10 business days after we mail it. No processing fee."
            />
          )}

          {hasCheck && options.check.types.includes('wire_check') && (
            <MethodCard
              selected={selectedMethod === 'wire_check'}
              onClick={() => selectMethod('wire_check')}
              icon={<FileText className="w-5 h-5 text-[#0C8B44]" />}
              title="Wire Check"
              subtitle="An official check mailed to the address on file. 5–10 business days after we mail it. No processing fee."
            />
          )}
        </div>

        <div
          className={`mt-4 p-3 rounded-lg border ${
            config?.enabled
              ? 'bg-[#0C8B44]/10 border-[#0C8B44]/30'
              : 'bg-[#F57C00]/10 border-[#F57C00]/30'
          }`}
        >
          <p
            className={`text-xs flex items-start gap-2 ${
              config?.enabled ? 'text-[#0C8B44]' : 'text-[#F57C00]'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {config?.message ??
                'Withdrawal methods are configured by your account manager. Contact support if you need to add or change destinations.'}
            </span>
          </p>
        </div>
      </div>

      {/* Destination summary (read-only) */}
      {(selectedMethod === 'cashier_check' || selectedMethod === 'wire_check') && checkDetails && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
          <h4 className="text-sm font-medium text-[#E5E5E5] mb-3">Mailing address on file</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#737373]">Payee</span>
              <span className="text-[#E5E5E5]">{checkDetails.payeeName}</span>
            </div>
            {mailingCityState && (
              <div className="flex justify-between">
                <span className="text-[#737373]">Mailing to</span>
                <span className="text-[#E5E5E5]">{mailingCityState}</span>
              </div>
            )}
            <p className="text-[10px] text-[#737373] pt-2 border-t border-[#ffffff10]">
              Full address is kept private and used only for mailing. Once approved, a check will be
              mailed. Delivery usually takes 5–10 business days after mailing.
            </p>
          </div>
        </div>
      )}

      {selectedMethod === 'ach' && options.ach.account && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
          <h4 className="text-sm font-medium text-[#E5E5E5] mb-3">Bank on file</h4>
          <p className="text-xs text-[#E5E5E5]">
            {options.ach.account.institution} · ····{options.ach.account.accountMask}
          </p>
        </div>
      )}

      {selectedMethod === 'wire' && options.wire.details && (
        <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
          <h4 className="text-sm font-medium text-[#E5E5E5] mb-3">Wire transfer details</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#737373]">Beneficiary</span>
              <span className="text-[#E5E5E5]">{options.wire.details.beneficiaryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#737373]">Bank</span>
              <span className="text-[#E5E5E5]">{options.wire.details.bankName}</span>
            </div>
            {options.wire.details.accountMask && (
              <div className="flex justify-between">
                <span className="text-[#737373]">Account</span>
                <span className="text-[#E5E5E5] font-mono">{options.wire.details.accountMask}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MethodCard({
  selected,
  onClick,
  icon,
  title,
  subtitle,
  badge,
  badgeTone,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  badge?: string
  badgeTone?: 'ok' | 'warn'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        selected
          ? 'border-[#0C8B44] bg-[#0C8B44]/10'
          : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">{title}</p>
            <p className="text-xs text-[#A0A0A0] mt-0.5 leading-relaxed">{subtitle}</p>
            {badge && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] mt-1.5 ${
                  badgeTone === 'ok' ? 'text-[#4CAF50]' : 'text-[#F57C00]'
                }`}
              >
                {badgeTone === 'ok' && <CheckCircle className="w-3 h-3" />}
                {badge}
              </span>
            )}
          </div>
        </div>
        {selected && <CheckCircle className="w-5 h-5 text-[#0C8B44] shrink-0" />}
      </div>
    </button>
  )
}
