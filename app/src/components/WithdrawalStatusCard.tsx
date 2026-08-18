import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api, getToken } from '../lib/api'
import { ProgressTrail, WITHDRAW_STEPS, stepFromStatus } from './progress/ProgressTrail'

type Withdrawal = {
  id: string
  amount: number
  asset: string
  status: string
  txHash?: string | null
  rejectedReason?: string | null
  createdAt: string
  destination?: string | null
}

export function WithdrawalStatusCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!getToken()) return
    setLoading(true)
    try {
      const [reqRes, walletRes] = await Promise.allSettled([
        api.get<{ withdrawals: Array<{
          id: string
          amount: number
          asset: string
          status: string
          txHash?: string | null
          rejectedReason?: string | null
          createdAt: string
          walletLink?: { address?: string | null }
        }> }>('/api/withdrawals'),
        api.getWallet(),
      ])

      const fromRequests: Withdrawal[] = reqRes.status === 'fulfilled'
        ? (reqRes.value.withdrawals || []).map((w) => ({
            id: w.id,
            amount: w.amount,
            asset: w.asset,
            status: w.status,
            txHash: w.txHash,
            rejectedReason: w.rejectedReason,
            createdAt: w.createdAt,
            destination: w.walletLink?.address || null,
          }))
        : []

      const fromWallet: Withdrawal[] = walletRes.status === 'fulfilled'
        ? ((walletRes.value.transactions || []) as Array<{
            id: string
            kind: string
            amount: number
            currency: string
            status: string
            reference?: string | null
            createdAt: string
          }>)
            .filter((tx) => tx.kind === 'withdraw')
            .map((tx) => ({
              id: `tx-${tx.id}`,
              amount: Math.abs(tx.amount),
              asset: tx.currency,
              status: tx.status,
              txHash: tx.reference || null,
              createdAt: tx.createdAt,
            }))
        : []

      const seen = new Set(fromRequests.map((w) => `${w.amount}-${w.asset}-${w.createdAt.slice(0, 16)}`))
      const merged = [
        ...fromRequests,
        ...fromWallet.filter((w) => !seen.has(`${w.amount}-${w.asset}-${w.createdAt.slice(0, 16)}`)),
      ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

      setItems(merged.slice(0, 20))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (!getToken()) return null

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#E5E5E5]">Withdrawal status</h3>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-[11px] text-[#737373] hover:text-[#E5E5E5]">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {items.length === 0 && !loading && (
        <p className="text-xs text-[#737373]">No withdrawals yet. After you request one, its status will show here.</p>
      )}
      {items.map((item) => {
        const trail = stepFromStatus(item.status, 'withdraw')
        return (
          <div key={item.id} className="space-y-2">
            <ProgressTrail
              title={`${item.amount} ${item.asset} withdrawal`}
              phase={item.rejectedReason ? `Rejected: ${item.rejectedReason}` : trail.phase}
              steps={WITHDRAW_STEPS}
              current={trail.current}
              done={trail.done}
              reference={`Ref ${(item.txHash || item.id).slice(0, 12)} · ${new Date(item.createdAt).toLocaleString()}`}
            />
            {item.destination && <p className="text-[11px] text-[#737373] font-mono truncate px-1">To {item.destination}</p>}
          </div>
        )
      })}
    </div>
  )
}
