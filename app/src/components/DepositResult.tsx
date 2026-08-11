import Modal from './Modal'
import { Button } from './ui/button'
import { Label } from './ui/label'

export default function DepositResult({
  id,
  success,
  txHash,
  error,
  onClose,
  onViewTx,
}: {
  id: string
  success: boolean
  txHash?: string
  error?: string
  onClose: (id: string) => void
  onViewTx?: (tx: string) => void
}) {
  return (
    <Modal open={true} onClose={() => onClose(id)} title={success ? 'Deposit Confirmed' : 'Deposit Failed'}>
      <div className="space-y-3">
        {success ? (
          <>
            <div className="text-sm text-[#E5E5E5]">Your deposit was confirmed.</div>
            {txHash && (
              <div>
                <Label className="text-sm text-[#A0A0A0]">Transaction</Label>
                <div className="font-mono break-all text-[#E5E5E5]">{txHash}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-sm text-[#E5E5E5]">There was a problem processing the deposit.</div>
            {error && <div className="text-sm text-[#f44336]">{error}</div>}
          </>
        )}

        <div className="flex gap-2 mt-3">
          {success && txHash && (
            <Button onClick={() => onViewTx && onViewTx(txHash)} className="flex-1">View on Explorer</Button>
          )}
          <Button variant="ghost" onClick={() => onClose(id)} className="flex-1">Close</Button>
        </div>
      </div>
    </Modal>
  )
}
