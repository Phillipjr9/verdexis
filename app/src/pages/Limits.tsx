import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { api } from '../lib/api'
import { ArrowLeft, ShieldCheck, Banknote, ArrowDownRight } from 'lucide-react'

export default function Limits() {
  return <RequireAuth><LimitsInner /></RequireAuth>
}

function LimitsInner() {
  const [loading, setLoading] = useState(true)
  const [depositLimits, setDepositLimits] = useState<any[]>([])
  const [withdrawalLimits, setWithdrawalLimits] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [depositResult, withdrawalResult] = await Promise.all([
          api.get('/limits/deposit'),
          api.get('/limits/withdraw'),
        ])
        setDepositLimits(depositResult.limits || [])
        setWithdrawalLimits(withdrawalResult.limits || [])
      } catch (error) {
        toast.error('Failed to load your limits')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/wallet" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to wallet
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-[#0C8B44]" />Deposit & Withdrawal Limits
          </h1>
          <p className="text-sm text-[#737373]">View your current deposit and withdrawal limits along with reset timings.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Banknote className="w-5 h-5 text-[#0C8B44]" />
              <h2 className="text-lg text-[#E5E5E5]">Deposit Limits</h2>
            </div>
            {loading ? (
              <p className="text-sm text-[#737373]">Loading deposit limits...</p>
            ) : depositLimits.length === 0 ? (
              <p className="text-sm text-[#737373]">No active deposit limits configured.</p>
            ) : (
              <div className="space-y-4">
                {depositLimits.map((limit) => (
                  <div key={limit.id} className="rounded-xl bg-[#090d0f] p-4 border border-[#ffffff08]">
                    <p className="text-sm text-[#A0A0A0]">Asset: {limit.asset || 'All'}</p>
                    <p className="text-xl text-[#E5E5E5]">Daily: ${limit.dailyLimit ?? '—'} / Monthly: ${limit.monthlyLimit ?? '—'}</p>
                    <p className="text-xs text-[#737373]">Used today: ${limit.dailyUsed ?? 0} · Used this month: ${limit.monthlyUsed ?? 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <div className="flex items-center gap-3 mb-4">
              <ArrowDownRight className="w-5 h-5 text-[#0C8B44]" />
              <h2 className="text-lg text-[#E5E5E5]">Withdrawal Limits</h2>
            </div>
            {loading ? (
              <p className="text-sm text-[#737373]">Loading withdrawal limits...</p>
            ) : withdrawalLimits.length === 0 ? (
              <p className="text-sm text-[#737373]">No active withdrawal limits configured.</p>
            ) : (
              <div className="space-y-4">
                {withdrawalLimits.map((limit) => (
                  <div key={limit.id} className="rounded-xl bg-[#090d0f] p-4 border border-[#ffffff08]">
                    <p className="text-sm text-[#A0A0A0]">Asset: {limit.asset || 'All'}</p>
                    <p className="text-xl text-[#E5E5E5]">Daily: ${limit.dailyLimit ?? '—'} / Monthly: ${limit.monthlyLimit ?? '—'}</p>
                    <p className="text-xs text-[#737373]">Used today: ${limit.dailyUsed ?? 0} · Used this month: ${limit.monthlyUsed ?? 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
