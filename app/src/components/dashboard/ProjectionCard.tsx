// Forward-looking portfolio projection card. Combines holdings + cash +
// staked positions, applies a blended growth model (crypto historical
// drift, staking APY, optional DCA monthly contributions) to project the
// account value at 1y / 5y / 10y horizons. Numbers update reactively as
// holdings/staking/DCA change.

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { portfolioStore, type PortfolioHolding } from '../../lib/portfolioStore'
import { stakingStore, STAKING_EVENT } from '../../lib/stakingStore'
import { dcaStore, DCA_EVENT, type DcaSchedule } from '../../lib/dcaStore'
import { useCurrency } from '../../lib/currencyContext'

// Conservative long-run drift assumptions. Intentionally below the
// historical average so projections never feel like a guarantee. Risky
// assets get more drift; cash earns roughly inflation.
const ASSET_DRIFT: Record<string, number> = {
  BTC: 0.18, ETH: 0.16, SOL: 0.14, BNB: 0.10, MATIC: 0.10, AVAX: 0.10, ADA: 0.08, DOT: 0.08,
  USDC: 0.04, USDT: 0.04, USD: 0.03, DAI: 0.04,
}
const DEFAULT_DRIFT = 0.08

function driftFor(symbol: string): number {
  return ASSET_DRIFT[symbol.toUpperCase()] ?? DEFAULT_DRIFT
}

function monthlyDcaUsd(schedules: DcaSchedule[]): number {
  return schedules
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.amountUsd * (30 / Math.max(1, s.intervalDays)), 0)
}

function projectAt(years: number, holdings: PortfolioHolding[], walletUsd: number, monthlyDca: number): number {
  // Holdings: each grows at its own asset drift (continuous compounding).
  const positions = holdings.reduce((s, h) => s + h.value * Math.exp(driftFor(h.symbol) * years), 0)
  // Cash: 4% short-term yield (mirrors USDC default).
  const cash = walletUsd * Math.exp(0.04 * years)
  // Staking: per-position APY.
  const staking = stakingStore.projectStakedUsd(years)
  // DCA: future value of monthly annuity at blended 8%.
  const r = 0.08 / 12
  const n = Math.round(years * 12)
  const dcaFv = monthlyDca > 0
    ? (r === 0 ? monthlyDca * n : monthlyDca * ((Math.pow(1 + r, n) - 1) / r))
    : 0
  return positions + cash + staking + dcaFv
}

export default function ProjectionCard() {
  const { format: fmtMoney } = useCurrency()
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(portfolioStore.getHoldings())
  const [walletUsd, setWalletUsd] = useState<number>(portfolioStore.getWalletValueUsd())
  const [schedules, setSchedules] = useState<DcaSchedule[]>(dcaStore.list())
  const [, setTick] = useState(0)

  useEffect(() => {
    const refresh = () => {
      setHoldings(portfolioStore.getHoldings())
      setWalletUsd(portfolioStore.getWalletValueUsd())
      setSchedules(dcaStore.list())
      setTick((x) => x + 1)
    }
    window.addEventListener('verdexis:portfolio', refresh)
    window.addEventListener(STAKING_EVENT, refresh)
    window.addEventListener(DCA_EVENT, refresh)
    return () => {
      window.removeEventListener('verdexis:portfolio', refresh)
      window.removeEventListener(STAKING_EVENT, refresh)
      window.removeEventListener(DCA_EVENT, refresh)
    }
  }, [])

  const monthlyDca = useMemo(() => monthlyDcaUsd(schedules), [schedules])
  const today = useMemo(
    () => holdings.reduce((s, h) => s + h.value, 0) + walletUsd + stakingStore.totalsUsd().staked,
    [holdings, walletUsd]
  )
  const proj1 = useMemo(() => projectAt(1, holdings, walletUsd, monthlyDca), [holdings, walletUsd, monthlyDca])
  const proj5 = useMemo(() => projectAt(5, holdings, walletUsd, monthlyDca), [holdings, walletUsd, monthlyDca])
  const proj10 = useMemo(() => projectAt(10, holdings, walletUsd, monthlyDca), [holdings, walletUsd, monthlyDca])

  if (today <= 0) {
    return (
      <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#0C8B44]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#E5E5E5]">Projected growth</h3>
            <p className="text-[11px] text-[#737373]">Add holdings or stake cash to see a 10-year projection.</p>
          </div>
        </div>
        <Link to="/staking" className="inline-flex items-center gap-1 text-[11px] text-[#0C8B44] hover:underline">
          Earn yield on idle cash <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#0C8B44]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#E5E5E5]">Projected growth</h3>
            <p className="text-[11px] text-[#737373]">
              Today {fmtMoney(today)}{monthlyDca > 0 ? ` · DCA ${fmtMoney(monthlyDca)}/mo` : ''}
            </p>
          </div>
        </div>
        <Link to="/staking" className="text-[11px] text-[#0C8B44] hover:underline inline-flex items-center gap-1">
          Boost <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ProjCell label="1y"  base={today} value={proj1}  fmt={fmtMoney} />
        <ProjCell label="5y"  base={today} value={proj5}  fmt={fmtMoney} />
        <ProjCell label="10y" base={today} value={proj10} fmt={fmtMoney} />
      </div>
      <p className="text-[10px] text-[#737373] mt-3">
        Illustrative. Uses long-run drift assumptions for each asset, current staking APY, and your
        active recurring buys. Not a forecast of future returns.
      </p>
    </div>
  )
}

function ProjCell({ label, base, value, fmt }: { label: string; base: number; value: number; fmt: (n: number) => string }) {
  const gain = value - base
  const gainPct = base > 0 ? (gain / base) * 100 : 0
  return (
    <div className="rounded-xl bg-[#1a1a1a]/50 p-3">
      <p className="text-[10px] uppercase text-[#737373] tracking-wider">{label}</p>
      <p className="text-base font-light text-[#E5E5E5] mt-1 tabular-nums">{fmt(value)}</p>
      <p className="text-[10px] text-[#4CAF50] mt-0.5">+{gainPct.toFixed(1)}%</p>
    </div>
  )
}
