import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { api, getToken } from '../lib/api'

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
    <div className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/70 p-6">
      <h3 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#F57C00]" />
        Pending deposits
      </h3>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d.id} className="rounded-xl border border-[#ffffff10] bg-[#070C0E] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-[#E5E5E5]">
                {d.amount} {d.asset}
              </p>
              <span className={`text-[10px] uppercase tracking-wider ${d.status === 'credited' || d.status === 'confirmed' ? 'text-[#0C8B44]' : 'text-[#F57C00]'}`}>
                {d.status}
              </span>
            </div>
            <p className="text-[11px] text-[#737373] font-mono truncate mt-1">{d.txHash}</p>
            <p className="text-[10px] text-[#737373] mt-1">{new Date(d.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
