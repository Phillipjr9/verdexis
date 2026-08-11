import { useState } from 'react'
import Modal from './Modal'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'

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

  const valid = !!address && !!amount && Number(amount) > 0

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

        <div className="flex gap-2 mt-2">
          <Button onClick={handleConfirm} disabled={!valid} className="flex-1">Request Withdrawal</Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}
