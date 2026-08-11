import Modal from './Modal'
import { Button } from './ui/button'
import { Label } from './ui/label'

export default function WithdrawalPending({
  id,
  payload,
  onClose,
}: {
  id: string
  payload: { amount: string; address: string; network?: string; note?: string }
  onClose: (id: string) => void
}) {
  return (
    <Modal open={true} onClose={() => onClose(id)} title="Withdrawal Pending">
      <div className="space-y-3">
        <div>
          <Label className="text-sm text-[#A0A0A0]">Amount</Label>
          <div className="font-mono text-[#E5E5E5]">{payload.amount}</div>
        </div>

        <div>
          <Label className="text-sm text-[#A0A0A0]">To Address</Label>
          <div className="font-mono break-all text-[#E5E5E5]">{payload.address}</div>
        </div>

        <div>
          <Label className="text-sm text-[#A0A0A0]">Network</Label>
          <div className="text-sm text-[#E5E5E5]">{payload.network ?? 'Ethereum'}</div>
        </div>

        <div className="flex gap-2 mt-3">
          <Button onClick={() => onClose(id)} className="flex-1">Close</Button>
        </div>
      </div>
    </Modal>
  )
}
