import { useState } from 'react'
import WithdrawalPrompt from './WithdrawalPrompt'
import OTPModal from './OTPModal'
import { toast } from 'sonner'
import { showWithdrawalPending, showWithdrawalResult } from '../lib/txNotifier'
import { api, getToken } from '../lib/api'

export default function WithdrawalFlow({ defaultAddress }: { defaultAddress?: string }) {
  const [promptOpen, setPromptOpen] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<{ amount: string; address: string; network?: string; note?: string } | null>(null)
  const handleRequest = async (payload: { amount: string; address: string; network?: string; note?: string }) => {
    setPendingPayload(payload)
    try {
      const res = await fetch('/api/otp/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'transaction', method: 'email' }) })
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
    try {
      const id = showWithdrawalPending({ amount: String(pendingPayload.amount), address: pendingPayload.address, network: pendingPayload.network })
      if (getToken()) {
        const json = await api.withdrawCrypto({
          amount: Number(pendingPayload.amount),
          asset: 'USDC',
          destinationAddress: pendingPayload.address,
          chain: pendingPayload.network?.toLowerCase(),
        })
        showWithdrawalResult(id, true, json.transfer?.txHash || undefined)
      } else {
        const res = await fetch('/api/withdrawals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(pendingPayload.amount),
            asset: 'USDC',
            destinationAddress: pendingPayload.address,
            chain: pendingPayload.network?.toLowerCase(),
            memo: pendingPayload.note,
            withdrawalMethod: 'crypto',
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          showWithdrawalResult(id, false, undefined, json?.error || 'Failed')
          toast.error(json?.error || 'Withdrawal failed')
          return
        }
        showWithdrawalResult(id, true, json?.txHash || json?.withdrawalId || undefined)
      }
      toast.success('Withdrawal submitted')
    } catch (err) {
      toast.error(err instanceof Error ? (err as { error?: string }).error || err.message : 'Withdrawal failed')
    } finally {
      setPendingPayload(null)
      setOtpOpen(false)
    }
  }

  return (
    <>
      <button onClick={() => setPromptOpen(true)} className="px-4 py-2 bg-[#0C8B44] text-white rounded">Withdraw</button>
      <WithdrawalPrompt open={promptOpen} onClose={() => setPromptOpen(false)} onConfirm={handleRequest} defaultAddress={defaultAddress} />
      <OTPModal open={otpOpen} onClose={() => setOtpOpen(false)} onVerify={onVerified} purpose="transaction" />
    </>
  )
}
