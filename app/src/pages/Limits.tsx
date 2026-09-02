import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { api } from '../lib/api'
import { ArrowLeft, ShieldCheck, Banknote, ArrowDownRight } from 'lucide-react'

type TierLimits = {
  tier: string
  kycStatus: string
  dailyWithdrawLimit: number
  monthlyWithdrawLimit: number
  dailyTransferLimit: number
  monthlyTransferLimit: number
  maxTradeSize: number
}

export default function Limits() {
  return <RequireAuth><LimitsInner /></RequireAuth>
}

function LimitsInner() {
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<TierLimits | null>(null)
  const [depositLimits, setDepositLimits] = useState<any[]>([])
  const [withdrawalLimits, setWithdrawalLimits] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const summary = await api.get<{
          tier: TierLimits
          depositLimits: any[]
          withdrawalLimits: any[]
        }>('/api/limits')
        setTier(summary.tier)
        setDepositLimits(summary.depositLimits || [])
        setWithdrawalLimits(summary.withdrawalLimits || [])
      } catch {
        try {
          const [depositResult, withdrawalResult, me] = await Promise.all([
            api.get<{ limits: any[] }>('/api/limits/deposit'),
            api.get<{ limits: any[] }>('/api/limits/withdrawal'),
            api.me(),
          ])
          setDepositLimits(depositResult.limits || [])
          setWithdrawalLimits(withdrawalResult.limits || [])
          const u = me.user as { kycTier?: string; kycStatus?: string }
          setTier({
            tier: u.kycTier || 'UNVERIFIED',
            kycStatus: u.kycStatus || 'none',
            dailyWithdrawLimit: 0,
            monthlyWithdrawLimit: 0,
            dailyTransferLimit: 0,
            monthlyTransferLimit: 0,
            maxTradeSize: 0,
          })
        } catch {
          toast.error('Failed to load your limits')
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const money = (n?: number | null) =>
    typeof n === 'number' ? `$${n.toLocaleString()}` : '—'

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8 pt-24">
        <Link to="/settings" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to settings
        </Link>
        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-[#0C8B44]" />Account limits
          </h1>
          <p className="text-sm text-[#737373]">Limits follow your verification tier.</p>
        </div>
        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
          <p className="text-xs uppercase tracking-wider text-[#737373]">Current tier</p>
          <p className="text-xl text-[#E5E5E5] mt-1">{tier?.tier || 'UNVERIFIED'}</p>
          <p className="text-xs text-[#737373] capitalize mt-1">Verification status: {tier?.kycStatus || 'none'}</p>
          {tier && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-[#090d0f] p-3"><p className="text-[11px] text-[#737373]">Daily withdraw</p><p className="text-sm text-[#E5E5E5]">{money(tier.dailyWithdrawLimit)}</p></div>
              <div className="rounded-lg bg-[#090d0f] p-3"><p className="text-[11px] text-[#737373]">Monthly withdraw</p><p className="text-sm text-[#E5E5E5]">{money(tier.monthlyWithdrawLimit)}</p></div>
              <div className="rounded-lg bg-[#090d0f] p-3"><p className="text-[11px] text-[#737373]">Daily transfer</p><p className="text-sm text-[#E5E5E5]">{money(tier.dailyTransferLimit)}</p></div>
              <div className="rounded-lg bg-[#090d0f] p-3"><p className="text-[11px] text-[#737373]">Monthly transfer</p><p className="text-sm text-[#E5E5E5]">{money(tier.monthlyTransferLimit)}</p></div>
            </div>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <div className="flex items-center gap-3 mb-4"><Banknote className="w-5 h-5 text-[#0C8B44]" /><h2 className="text-lg text-[#E5E5E5]">Deposit overrides</h2></div>
            {loading ? <p className="text-sm text-[#737373]">Loading deposit limits...</p> : depositLimits.length === 0 ? <p className="text-sm text-[#737373]">Using default tier deposit rules.</p> : depositLimits.map((limit) => (
              <div key={limit.id} className="rounded-xl bg-[#090d0f] p-4 border border-[#ffffff08] mb-3">
                <p className="text-sm text-[#A0A0A0]">Asset: {limit.asset || 'All'}</p>
                <p className="text-xl text-[#E5E5E5]">Daily: {money(limit.dailyLimit)} / Monthly: {money(limit.monthlyLimit)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <div className="flex items-center gap-3 mb-4"><ArrowDownRight className="w-5 h-5 text-[#0C8B44]" /><h2 className="text-lg text-[#E5E5E5]">Withdrawal overrides</h2></div>
            {loading ? <p className="text-sm text-[#737373]">Loading withdrawal limits...</p> : withdrawalLimits.length === 0 ? <p className="text-sm text-[#737373]">Using default tier withdrawal rules.</p> : withdrawalLimits.map((limit) => (
              <div key={limit.id} className="rounded-xl bg-[#090d0f] p-4 border border-[#ffffff08] mb-3">
                <p className="text-sm text-[#A0A0A0]">Asset: {limit.asset || 'All'}</p>
                <p className="text-xl text-[#E5E5E5]">Daily: {money(limit.dailyLimit)} / Monthly: {money(limit.monthlyLimit)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
