import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { api, getToken } from '../lib/api'
import { ProgressTrail, TRANSFER_STEPS, stepFromStatus } from './progress/ProgressTrail'

export function TransferStatusCard() {
  const [items, setItems] = useState<Array<{ id: string; amount: number; currency: string; status: string; createdAt: string; reference?: string | null }>>([])

  useEffect(() => {
    if (!getToken()) return
    void api.getWallet()
      .then((wallet) => {
        const txs = ((wallet.transactions || []) as Array<{ id: string; kind: string; amount: number; currency: string; status: string; createdAt: string; reference?: string | null }>).filter((tx) => tx.kind === 'transfer')
        setItems(txs.slice(0, 8))
      })
      .catch(() => setItems([]))
  }, [])

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4 text-[#0C8B44]" />
        Transfer progress
      </h3>
      {items.map((tx) => {
        const trail = stepFromStatus(tx.status, 'transfer')
        return (
          <ProgressTrail
            key={tx.id}
            title={`${Math.abs(tx.amount)} ${tx.currency} transfer`}
            phase={trail.phase}
            steps={TRANSFER_STEPS}
            current={trail.current}
            done={trail.done}
            reference={`Ref ${(tx.reference || tx.id).slice(0, 12)} · ${new Date(tx.createdAt).toLocaleString()}`}
          />
        )
      })}
    </div>
  )
}
