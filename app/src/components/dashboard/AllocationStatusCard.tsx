import { useMemo } from 'react'
import { PieChart, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PortfolioHolding } from '../../lib/portfolioStore'

interface Props {
  holdings: PortfolioHolding[]
  totalValue: number
}

export default function AllocationStatusCard({ holdings, totalValue }: Props) {
  const allocation = useMemo(() => {
    if (totalValue <= 0) return null

    // Current allocation
    const current = new Map<string, number>()
    for (const h of holdings) {
      if (h.id === 'usd') continue
      const pct = (h.value / totalValue) * 100
      current.set(h.symbol || h.id, pct)
    }

    // Target allocation (example: 60/20/20 for top 3)
    const sorted = [...holdings]
      .filter(h => h.id !== 'usd' && h.value > 0)
      .sort((a, b) => b.value - a.value)

    const target = new Map<string, number>()
    if (sorted.length >= 3) {
      target.set(sorted[0].symbol || sorted[0].id, 60)
      target.set(sorted[1].symbol || sorted[1].id, 20)
      target.set(sorted[2].symbol || sorted[2].id, 20)
    } else if (sorted.length === 2) {
      target.set(sorted[0].symbol || sorted[0].id, 60)
      target.set(sorted[1].symbol || sorted[1].id, 40)
    } else if (sorted.length === 1) {
      target.set(sorted[0].symbol || sorted[0].id, 100)
    }

    // Calculate drift
    let maxDrift = 0
    const drifts: Array<{ symbol: string; current: number; target: number; drift: number }> = []

    for (const [symbol, targetPct] of target) {
      const currentPct = current.get(symbol) || 0
      const drift = Math.abs(currentPct - targetPct)
      drifts.push({ symbol, current: currentPct, target: targetPct, drift })
      maxDrift = Math.max(maxDrift, drift)
    }

    drifts.sort((a, b) => b.drift - a.drift)

    // Rebalancing needed?
    const needsRebalance = maxDrift > 5

    return {
      current,
      target,
      drifts,
      maxDrift,
      needsRebalance,
      holdingsCount: sorted.length,
    }
  }, [holdings, totalValue])

  if (!allocation || allocation.holdingsCount === 0) {
    return (
      <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
        <div className="flex items-center gap-2 mb-2">
          <PieChart className="w-4 h-4 text-[#2196F3]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Allocation Status</h3>
        </div>
        <p className="text-xs text-[#737373]">Add holdings to see allocation status.</p>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#2196F3]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Allocation Status</h3>
        </div>
        {allocation.needsRebalance && (
          <Link
            to="/trading"
            className="px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-[#FF9800]/20 text-[#FF9800] hover:bg-[#FF9800]/30 transition-colors"
          >
            Rebalance
          </Link>
        )}
      </div>

      {/* Drift Status */}
      <div className="mb-4 pb-4 border-b border-[#ffffff08]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase text-[#737373]">Max Drift</span>
          <span className={`text-sm font-medium ${allocation.maxDrift > 5 ? 'text-[#FF9800]' : 'text-[#4CAF50]'}`}>
            {allocation.maxDrift.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, allocation.maxDrift * 5)}%`,
              background: allocation.maxDrift > 5 ? '#FF9800' : '#4CAF50',
            }}
          />
        </div>
        {allocation.needsRebalance && (
          <p className="text-[10px] text-[#FF9800] mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Rebalancing recommended
          </p>
        )}
      </div>

      {/* Allocation Comparison */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-3">Current vs Target</p>
        {allocation.drifts.slice(0, 5).map((item, i) => (
          <div key={`${item.symbol}-${i}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#E5E5E5]">{item.symbol}</span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[#A0A0A0]">{item.current.toFixed(1)}%</span>
                <span className="text-[#737373]">→</span>
                <span className="text-[#0C8B44]">{item.target.toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex gap-1 h-1.5">
              <div
                className="bg-[#2196F3] rounded-full"
                style={{ width: `${Math.max(5, item.current)}%` }}
                title={`Current: ${item.current.toFixed(1)}%`}
              />
              <div
                className="bg-[#0C8B44]/30 rounded-full flex-1"
                style={{ width: `${Math.max(5, item.target)}%` }}
                title={`Target: ${item.target.toFixed(1)}%`}
              />
            </div>
            {item.drift > 5 && (
              <p className="text-[10px] text-[#FF9800] mt-1">Drift: {item.drift.toFixed(1)}%</p>\n            )}\n          </div>\n        ))}\n      </div>\n\n      {/* Recommendation */}\n      <div className=\"mt-4 pt-4 border-t border-[#ffffff08]\">\n        <p className=\"text-[10px] text-[#A0A0A0] leading-relaxed\">\n          {allocation.needsRebalance\n            ? '⚠ Your allocation has drifted from target. Rebalance to maintain your desired risk profile.'\n            : '✓ Your allocation is well-balanced. No rebalancing needed.'}\n        </p>\n      </div>\n    </div>\n  )\n}\n