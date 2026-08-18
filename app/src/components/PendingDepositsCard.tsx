import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { api, getToken } from '../lib/api'
import { DEPOSIT_STEPS, ProgressTrail, stepFromStatus } from './progress/ProgressTrail'

type Pending = {
  id: string
  txHash: string
  asset: string
  amount: number
  status: string
  createdAt: string
}

export function PendingDepositsCard() {
  const [items, setItems] = useState<Pending[]>([])

  useEffect(() => {
    if (!getToken()) return
    void api.listPendingDeposits()
      .then((res) => setItems(res.pendingDeposits || []))
      .catch(() => setItems([]))
  }, [])

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#F57C00]" />
        Deposit progress
      </h3>
      {items.map((d) => {
        const trail = stepFromStatus(d.status, 'deposit')
        return (
          <ProgressTrail
            key={d.id}
            title={`${d.amount} ${d.asset} deposit`}
            phase={trail.phase}
            steps={DEPOSIT_STEPS}
            current={trail.current}
            done={trail.done}
            reference={`Ref ${d.txHash?.slice(0, 12) || d.id.slice(0, 8)} · ${new Date(d.createdAt).toLocaleString()}`}
          />
        )
      })}
    </div>
  )
}
