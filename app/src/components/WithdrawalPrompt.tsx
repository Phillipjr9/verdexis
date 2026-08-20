import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { estimateWithdrawalFee, type WithdrawalFeeEstimate } from '../lib/withdrawalFee'
import type { WithdrawalMethod } from './ReadOnlyWithdrawalSection'

export type WithdrawalPromptPayload = {
  amount: string
  address: string
  network?: string
  note?: string
  method: WithdrawalMethod
}

export default function WithdrawalPrompt({
  open,
  onClose,
  onConfirm,
  defaultAddress,
  method = 'crypto',
  destinationSummary,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (payload: WithdrawalPromptPayload) => void
  defaultAddress?: string
  method?: WithdrawalMethod
  /** Read-only line shown under amount (bank mask, payee city, etc.) */
  destinationSummary?: string
}) {
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState(defaultAddress ?? '')
  const [note, setNote] = useState('')
  const [network, setNetwork] = useState('Ethereum')
  const [estimate, setEstimate] = useState<WithdrawalFeeEstimate | null>(null)

  const isCrypto = method === 'crypto'
  const isCheck = method === 'cashier_check' || method === 'wire_check'

  const methodLabel =
    method === 'cashier_check'
      ? "Cashier's Check"
      : method === 'wire_check'
        ? 'Wire Check'
        : method === 'ach'
          ? 'ACH Transfer'
          : method === 'wire'
            ? 'Wire Transfer'
            : 'Crypto'

  const valid =
    !!amount &&
    Number(amount) > 0 &&
    (isCrypto ? !!address.trim() : true)

  useEffect(() => {
    if (open && defaultAddress) setAddress(defaultAddress)
  }, [open, defaultAddress])

  useEffect(() => {
    const value = Number(amount)
    if (!open || !Number.isFinite(value) || value <= 0) {
      setEstimate(null)
      return
    }
    if (isCheck) {
      setEstimate({
        amount: value,
        ratePct: 0,
        tier: 'check',
        processingFee: 0,
        totalDebit: value,
        source: 'override',
      } as WithdrawalFeeEstimate)
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      void estimateWithdrawalFee(value, isCrypto ? 'crypto' : method).then((next) => {
        if (active) setEstimate(next)
      })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [amount, open, method, isCheck, isCrypto])

  const handleConfirm = () => {
    if (!valid) return
    onConfirm({
      amount,
      address: isCrypto ? address : '',
      note,
      network: isCrypto ? network : undefined,
      method,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Withdraw via ${methodLabel}`}>
      <div className="space-y-3">
        <div>
          <Label className="text-sm text-[#E5E5E5]">Amount</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>

        {isCrypto && (
          <>
            <div>
              <Label className="text-sm text-[#E5E5E5]">Destination address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." />
            </div>
            <div>
              <Label className="text-sm text-[#E5E5E5]">Network</Label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#121212] border border-[#ffffff10] text-[#E5E5E5]"
              >
                <option>Ethereum</option>
                <option>Polygon</option>
                <option>Arbitrum</option>
                <option>Optimism</option>
              </select>
            </div>
          </>
        )}

        {!isCrypto && destinationSummary && (
          <div className="rounded-xl border border-[#ffffff10] bg-[#070C0E] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Destination on file</p>
            <p className="text-xs text-[#E5E5E5]">{destinationSummary}</p>
            {isCheck && (
              <p className="text-[10px] text-[#737373] mt-2">
                Once approved, a check will be mailed. Delivery usually takes 5–10 business days after
                mailing. Full address is only visible to our team.
              </p>
            )}
          </div>
        )}

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
              <span className="text-[#A0A0A0]">
                {isCheck
                  ? 'Processing fee'
                  : `Processing fee (${estimate.ratePct}% · ${estimate.tier})`}
              </span>
              <span className="text-[#E5E5E5]">
                {isCheck ? 'No processing fee' : estimate.processingFee.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-[#ffffff10]">
              <span className="text-[#E5E5E5]">Total debit</span>
              <span className="text-[#E5E5E5]">{estimate.totalDebit.toFixed(6)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <Button onClick={handleConfirm} disabled={!valid} className="flex-1">
            Continue
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Back
          </Button>
        </div>
      </div>
    </Modal>
  )
}
