import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, XCircle, RefreshCw, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { api, getToken } from '../lib/api'

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

function normalizeStatus(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'approved' || s === 'completed' || s === 'sent') return 'sent'
  if (s === 'rejected' || s === 'failed' || s === 'declined') return 'rejected'
  return 'pending'
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
        const state = normalizeStatus(item.status)
        const steps = [
          { label: 'Submitted', done: true },
          { label: 'In review', done: true },
          { label: state === 'rejected' ? 'Rejected' : 'Sent', done: state === 'sent' || state === 'rejected' },
        ]
        if (state === 'pending') steps[2].done = false

        return (
          <div key={item.id} className="rounded-xl border border-[#ffffff10] bg-[#070C0E] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[#E5E5E5]">{item.amount} {item.asset}</p>
                <p className="text-[11px] text-[#737373] mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <span className={`text-[10px] uppercase tracking-wider ${
                state === 'sent' ? 'text-[#0C8B44]' : state === 'rejected' ? 'text-[#f44336]' : 'text-[#F57C00]'
              }`}>{state}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {steps.map((step) => (
                <div key={step.label} className="text-center">
                  <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full ${
                    step.done
                      ? state === 'rejected' && step.label === 'Rejected'
                        ? 'bg-[#f44336]/20 text-[#f44336]'
                        : 'bg-[#0C8B44]/20 text-[#0C8B44]'
                      : 'bg-[#ffffff08] text-[#737373]'
                  }`}>
                    {step.label === 'Rejected' && step.done ? <XCircle className="w-3.5 h-3.5" /> : step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[10px] text-[#A0A0A0]">{step.label}</p>
                </div>
              ))}
            </div>
            {item.destination && <p className="mt-3 text-[11px] text-[#737373] font-mono truncate">To {item.destination}</p>}
            {item.txHash && (
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#0C8B44] font-mono" onClick={() => { void navigator.clipboard.writeText(item.txHash || ''); toast.success('Transaction hash copied') }}>
                <Copy className="w-3 h-3" />
                {item.txHash.slice(0, 18)}…
              </button>
            )}
            {item.rejectedReason && <p className="mt-2 text-[11px] text-[#f44336]">{item.rejectedReason}</p>}
          </div>
        )
      })}
    </div>
  )
}
