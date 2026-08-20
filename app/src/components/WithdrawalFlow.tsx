import { useState } from 'react'
import WithdrawalPrompt, { type WithdrawalPromptPayload } from './WithdrawalPrompt'
import OTPModal from './OTPModal'
import { toast } from 'sonner'
import { showWithdrawalPending, showWithdrawalResult } from '../lib/txNotifier'
import { getToken } from '../lib/api'
import { requestWithdrawal } from '../lib/withdrawalApi'
import { WithdrawalStatusCard } from './WithdrawalStatusCard'
import {
  ReadOnlyWithdrawalSection,
  type WithdrawalMethod,
} from './ReadOnlyWithdrawalSection'

export default function WithdrawalFlow({ defaultAddress }: { defaultAddress?: string }) {
  const [promptOpen, setPromptOpen] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [method, setMethod] = useState<WithdrawalMethod>('crypto')
  const [destinationSummary, setDestinationSummary] = useState<string | undefined>()
  const [pendingPayload, setPendingPayload] = useState<WithdrawalPromptPayload | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRequest = async (payload: WithdrawalPromptPayload) => {
    setPendingPayload(payload)
    try {
      const res = await fetch('/api/otp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'transaction', method: 'email' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to send OTP')
      setPromptOpen(false)
      setOtpOpen(true)
      toast.success('Verification code sent to your email')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request verification')
    }
  }

  const onVerified = async () => {
    if (!pendingPayload) return
    const methodLabel =
      pendingPayload.method === 'cashier_check'
        ? "cashier's check"
        : pendingPayload.method === 'wire_check'
          ? 'wire check'
          : pendingPayload.method

    try {
      const id = showWithdrawalPending({
        amount: String(pendingPayload.amount),
        address:
          pendingPayload.method === 'crypto'
            ? pendingPayload.address
            : methodLabel,
        network: pendingPayload.network,
      })

      if (!getToken()) {
        showWithdrawalResult(id, false, undefined, 'Please sign in')
        toast.error('Please sign in to withdraw')
        return
      }

      const json = await requestWithdrawal({
        amount: Number(pendingPayload.amount),
        asset: 'USDC',
        withdrawalMethod: pendingPayload.method,
        destinationAddress:
          pendingPayload.method === 'crypto' ? pendingPayload.address : undefined,
        chain: pendingPayload.network?.toLowerCase(),
        memo: pendingPayload.note,
      })

      showWithdrawalResult(
        id,
        true,
        json.transfer?.txHash || (json as { withdrawal?: { id?: string } }).withdrawal?.id || undefined,
      )
      toast.success(
        pendingPayload.method === 'cashier_check' || pendingPayload.method === 'wire_check'
          ? 'Withdrawal requested. A check will be mailed after approval.'
          : 'Withdrawal submitted',
      )
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: string }).error)
          : err instanceof Error
            ? err.message
            : 'Withdrawal failed'
      toast.error(msg)
    } finally {
      setPendingPayload(null)
      setOtpOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <ReadOnlyWithdrawalSection
        onMethodChange={(m) => {
          setMethod(m)
          // Summary is filled by the section UI; leave undefined for crypto
          if (m === 'crypto') setDestinationSummary(undefined)
        }}
      />

      <button
        type="button"
        onClick={() => setPromptOpen(true)}
        className="px-4 py-2 bg-[#0C8B44] text-white rounded"
      >
        Withdraw
      </button>

      <WithdrawalStatusCard refreshKey={refreshKey} />

      <WithdrawalPrompt
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        onConfirm={handleRequest}
        defaultAddress={defaultAddress}
        method={method}
        destinationSummary={destinationSummary}
      />

      <OTPModal
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onVerify={onVerified}
        purpose="transaction"
      />
    </div>
  )
}
