import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { estimateWithdrawalFee, type WithdrawalFeeEstimate } from '../lib/withdrawalFee'

export default function WithdrawalPrompt({
  open,
  onClose,
  onConfirm,
  defaultAddress,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (payload: { amount: string; address: string; network?: string; note?: string }) => void
  defaultAddress?: string
}) {
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState(defaultAddress ?? '')
  const [note, setNote] = useState('')
  const [network, setNetwork] = useState('Ethereum')
  const [estimate, setEstimate] = useState<WithdrawalFeeEstimate | null>(null)

  const valid = !!address && !!amount && Number(amount) > 0

  useEffect(() => {
    const value = Number(amount)
    if (!open || !Number.isFinite(value) || value <= 0) {
      setEstimate(null)
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      void estimateWithdrawalFee(value, 'crypto').then((next) => {
        if (active) setEstimate(next)
      })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [amount, open])

  const handleConfirm = () => {
    if (!valid) return
    onConfirm({ amount, address, note, network })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Withdraw Funds">
      <div className="space-y-3">
        <div>
          <Label className="text-sm text-[#E5E5E5]">Amount</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-sm text-[#E5E5E5]">Destination Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." />
        </div>
        <div>
          <Label className="text-sm text-[#E5E5E5]">Network</Label>
          <select value={network} onChange={(e) => setNetwork(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#121212] border border-[#ffffff10] text-[#E5E5E5]">
            <option>Ethereum</option>
            <option>Polygon</option>
            <option>Arbitrum</option>
            <option>Optimism</option>
          </select>
        </div>
        <div>
          <Label className="text-sm text-[#E5E5E5]">Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or internal note" />
        </div>
        {estimate && estimate.amount > 0 && (
          <div className="rounded-xl border border-[#ffffff10] bg-[#070C0E] p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-[#737373]">Fee estimate</p>
            <div className="flex justify-between text-xs">
              <span className="text-[#A0A0A0]">You request</span>
              <span className="text-[#E5E5E5]">{estimate.amount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#A0A0A0]">Processing fee ({estimate.ratePct}% · {estimate.tier})</span>
              <span className="text-[#E5E5E5]">{estimate.processingFee.toFixed(6)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-[#ffffff10]">
              <span className="text-[#E5E5E5]">Total debit</span>
              <span className="text-[#E5E5E5]">{estimate.totalDebit.toFixed(6)}</span>
            </div>
            <p className="text-[10px] text-[#737373]">
              {estimate.source === 'override'
                ? 'Custom fee set by admin.'
                : 'Fee is based on your account tier and is added on top of the withdrawal amount.'}
            </p>
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <Button onClick={handleConfirm} disabled={!valid} className="flex-1">Request Withdrawal</Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}
