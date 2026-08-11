import Modal from './Modal'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Copy } from 'lucide-react'

export default function DepositPending({
  id,
  payload,
  onClose,
}: {
  id: string
  payload: { amount: string; address: string; network?: string; memo?: string }
  onClose: (id: string) => void
}) {
  const copy = (text: string) => { navigator.clipboard.writeText(text); }

  return (
    <Modal open={true} onClose={() => onClose(id)} title="Deposit Pending">
      <div className="space-y-3">
        <div>
          <Label className="text-sm text-[#A0A0A0]">Amount</Label>
          <div className="font-mono text-[#E5E5E5]">{payload.amount}</div>
        </div>

        <div>
          <Label className="text-sm text-[#A0A0A0]">To Address</Label>
          <div className="flex items-center gap-2">
            <code className="font-mono break-all text-[#E5E5E5]">{payload.address}</code>
            <Button variant="ghost" size="sm" onClick={() => copy(payload.address)}><Copy className="w-4 h-4" /></Button>
          </div>
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
