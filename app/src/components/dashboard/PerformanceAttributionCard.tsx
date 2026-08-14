import { useMemo } from 'react'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PortfolioHolding, Trade } from '../../lib/portfolioStore'

interface Props {
  holdings: PortfolioHolding[]
  trades: Trade[]
  fmtMoney: (n: number, opts?: { sign?: boolean }) => string
}

export default function PerformanceAttributionCard({ holdings, trades, fmtMoney }: Props) {
  const stats = useMemo(() => {
    // Top gainers and losers
    const sorted = [...holdings]
      .filter(h => h.id !== 'usd' && h.value > 0)
      .sort((a, b) => b.pnl - a.pnl)

    const gainers = sorted.slice(0, 3)
    const losers = sorted.slice(-3).reverse()

    // Win rate from trades
    const sells = trades.filter(t => t.side === 'sell')
    const wins = sells.filter(t => {
      const buys = trades.filter(b => b.side === 'buy' && b.symbol === t.symbol)
      if (buys.length === 0) return false
      const avgBuy = buys.reduce((s, b) => s + b.total, 0) / buys.reduce((s, b) => s + b.quantity, 0)
      return t.price > avgBuy
    })
    const winRate = sells.length > 0 ? (wins.length / sells.length) * 100 : 0

    // Total P&L
    const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0)
    const totalValue = holdings.reduce((s, h) => s + h.value, 0)
    const totalPnlPercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0

    return { gainers, losers, winRate, totalPnl, totalPnlPercent, tradesCount: trades.length }
  }, [holdings, trades])

  if (holdings.filter(h => h.id !== 'usd').length === 0) {
    return (
      <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-[#FF9800]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Performance Attribution</h3>
        </div>
        <p className="text-xs text-[#737373]">Add holdings to see performance breakdown.</p>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#FF9800]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Performance Attribution</h3>
        </div>
        <Link to="/trading" className="text-[10px] text-[#0C8B44] hover:text-[#00E676]">
          View all
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-[#ffffff08]">
        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">Total P&L</p>
          <p className={`text-lg font-light ${stats.totalPnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
            {fmtMoney(stats.totalPnl, { sign: true })}
          </p>
          <p className={`text-[10px] ${stats.totalPnlPercent >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
            {stats.totalPnlPercent >= 0 ? '+' : ''}{stats.totalPnlPercent.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">Win Rate</p>
          <p className="text-lg font-light text-[#E5E5E5]">{stats.winRate.toFixed(0)}%</p>
          <p className="text-[10px] text-[#737373]">{stats.tradesCount} trades</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-[#737373] mb-1">Holdings</p>
          <p className="text-lg font-light text-[#E5E5E5]">{holdings.filter(h => h.id !== 'usd').length}</p>
          <p className="text-[10px] text-[#737373]">assets</p>
        </div>
      </div>

      {/* Top Gainers */}
      {stats.gainers.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-[#4CAF50] mb-2">Top Gainers</p>
          <div className="space-y-1.5">
            {stats.gainers.map((h, i) => (
              <div key={`${h.id}-${i}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="w-3 h-3 text-[#4CAF50] shrink-0" />
                  <span className="text-[#E5E5E5] truncate">{h.symbol}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[#4CAF50] font-medium">{fmtMoney(h.pnl, { sign: true })}</p>
                  <p className="text-[#737373]">{h.pnlPercent.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Losers */}
      {stats.losers.length > 0 && stats.losers[0].pnl < 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#f44336] mb-2">Top Losers</p>
          <div className="space-y-1.5">
            {stats.losers.map((h, i) => (
              <div key={`${h.id}-${i}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingDown className="w-3 h-3 text-[#f44336] shrink-0" />
                  <span className="text-[#E5E5E5] truncate">{h.symbol}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[#f44336] font-medium">{fmtMoney(h.pnl, { sign: true })}</p>
                  <p className="text-[#737373]">{h.pnlPercent.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
