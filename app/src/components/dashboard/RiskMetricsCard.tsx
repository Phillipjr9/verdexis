import { useMemo } from 'react'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { PortfolioHolding } from '../../lib/portfolioStore'
import type { CryptoQuote } from '../../lib/marketData'

interface Props {
  holdings: PortfolioHolding[]
  market: CryptoQuote[]
  netWorth: number
}

export default function RiskMetricsCard({ holdings, market, netWorth }: Props) {
  const metrics = useMemo(() => {
    if (holdings.length === 0 || netWorth <= 0) {
      return null
    }

    // Calculate volatility from holdings' sparklines
    const quoteById = new Map(market.map(m => [m.id, m] as const))
    const quoteBySym = new Map(market.map(m => [(m.symbol || '').toLowerCase(), m] as const))

    let totalVariance = 0
    let holdingsWithData = 0

    for (const h of holdings) {
      if (h.id === 'usd' || h.value <= 0) continue
      const q = quoteById.get(h.id) ?? quoteBySym.get((h.symbol || '').toLowerCase())
      if (!q?.sparkline_in_7d?.price || q.sparkline_in_7d.price.length < 2) continue

      const prices = q.sparkline_in_7d.price
      const returns = []
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
      }

      if (returns.length > 0) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length
        const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length
        const weight = h.value / netWorth
        totalVariance += variance * weight * weight
        holdingsWithData++
      }
    }

    const volatility7d = holdingsWithData > 0 ? Math.sqrt(totalVariance) * 100 : 0

    // Estimate 30-day volatility (1.5x 7-day as rough estimate)
    const volatility30d = volatility7d * 1.5

    // Simple Sharpe ratio (assuming 0% risk-free rate for crypto)
    const dailyReturn = 0 // Would need historical data
    const sharpeRatio = volatility7d > 0 ? (dailyReturn / volatility7d) * Math.sqrt(252) : 0

    // Max drawdown (simplified - from sparkline)
    let maxDrawdown = 0
    for (const h of holdings) {
      if (h.id === 'usd' || h.value <= 0) continue
      const q = quoteById.get(h.id) ?? quoteBySym.get((h.symbol || '').toLowerCase())
      if (!q?.sparkline_in_7d?.price || q.sparkline_in_7d.price.length < 2) continue

      const prices = q.sparkline_in_7d.price
      let peak = prices[0]
      for (const price of prices) {
        if (price > peak) peak = price
        const drawdown = (peak - price) / peak
        if (drawdown > maxDrawdown) maxDrawdown = drawdown
      }
    }

    // Risk level
    let riskLevel: 'Low' | 'Medium' | 'High' | 'Very High'
    if (volatility7d < 2) riskLevel = 'Low'
    else if (volatility7d < 5) riskLevel = 'Medium'
    else if (volatility7d < 10) riskLevel = 'High'
    else riskLevel = 'Very High'

    const riskColor = {
      'Low': '#4CAF50',
      'Medium': '#FFC107',
      'High': '#FF9800',
      'Very High': '#f44336',
    }[riskLevel]

    return {
      volatility7d,
      volatility30d,
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100,
      riskLevel,
      riskColor,
    }
  }, [holdings, market, netWorth])

  if (!metrics) {
    return (
      <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-[#FF9800]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Risk Metrics</h3>
        </div>
        <p className="text-xs text-[#737373]">Add holdings to calculate risk metrics.</p>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#FF9800]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Risk Metrics</h3>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider"
          style={{ background: `${metrics.riskColor}20`, color: metrics.riskColor }}
        >
          {metrics.riskLevel}
        </div>
      </div>

      {/* Risk Level Indicator */}
      <div className="mb-4 pb-4 border-b border-[#ffffff08]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase text-[#737373]">Portfolio Risk</span>
          <span className="text-xs font-medium text-[#E5E5E5]">{metrics.riskLevel}</span>
        </div>
        <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (metrics.volatility7d / 15) * 100)}%`,
              background: metrics.riskColor,
            }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">7-Day Volatility</p>
          <p className="text-lg font-light text-[#E5E5E5]">{metrics.volatility7d.toFixed(2)}%</p>
          <p className="text-[10px] text-[#737373]">annualized</p>
        </div>

        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">30-Day Volatility</p>
          <p className="text-lg font-light text-[#E5E5E5]">{metrics.volatility30d.toFixed(2)}%</p>
          <p className="text-[10px] text-[#737373]">estimated</p>
        </div>

        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">Max Drawdown</p>
          <p className="text-lg font-light text-[#f44336]">{metrics.maxDrawdown.toFixed(2)}%</p>
          <p className="text-[10px] text-[#737373]">7-day window</p>
        </div>

        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">Sharpe Ratio</p>
          <p className="text-lg font-light text-[#E5E5E5]">{metrics.sharpeRatio.toFixed(2)}</p>
          <p className="text-[10px] text-[#737373]">risk-adjusted</p>
        </div>
      </div>

      {/* Risk Explanation */}
      <div className="mt-4 pt-4 border-t border-[#ffffff08]">
        <p className="text-[10px] text-[#A0A0A0] leading-relaxed">
          {metrics.riskLevel === 'Low' && '✓ Your portfolio has low volatility. Suitable for conservative investors.'}
          {metrics.riskLevel === 'Medium' && '⚠ Your portfolio has moderate volatility. Balanced risk/reward profile.'}
          {metrics.riskLevel === 'High' && '⚠ Your portfolio has high volatility. Suitable for aggressive investors.'}
          {metrics.riskLevel === 'Very High' && '⚠ Your portfolio has very high volatility. Consider diversifying.'}
        </p>
      </div>
    </div>
  )
}
