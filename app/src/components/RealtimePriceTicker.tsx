import { useRealtimePrice, useRealtimeChart } from '../hooks/useRealtimePrice'
import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * Real-Time Price Ticker Component
 * Updates every millisecond with live market data
 */
export function RealtimePriceTicker({ symbol, name }: { symbol: string; name: string }) {
  const price = useRealtimePrice(symbol)

  if (!price) {
    return (
      <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] animate-pulse">
        <div className="h-6 w-20 bg-[#2a2a2a] rounded" />
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] hover:border-[#0C8B44]/30 transition-colors">
      <p className="text-xs text-[#737373] mb-1">{name}</p>
      <p className="text-2xl font-light text-[#E5E5E5] tabular-nums">
        ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
      </p>
    </div>
  )
}

/**
 * Live Mini Chart Component
 * Displays sparkline chart with real-time price updates
 */
export function LiveMiniChart({ symbol, height = 60 }: { symbol: string; height?: number }) {
  const points = useRealtimeChart(symbol, 100)

  if (!points || points.length < 2) {
    return (
      <div style={{ height }} className="w-full bg-[#1a1a1a] rounded animate-pulse" />
    )
  }

  const prices = points.map(([p]) => p)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const isUp = prices[prices.length - 1] >= prices[0]

  // Generate SVG path for sparkline
  const pathData = prices
    .map((price, i) => {
      const x = (i / (prices.length - 1)) * 100
      const y = ((max - price) / range) * height
      return `${x},${y}`
    })
    .join(' L ')

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full h-full">
        {/* Grid lines */}
        <line x1="0" y1={height * 0.25} x2="100" y2={height * 0.25} stroke="#ffffff05" strokeWidth="0.5" />
        <line x1="0" y1={height * 0.5} x2="100" y2={height * 0.5} stroke="#ffffff05" strokeWidth="0.5" />
        <line x1="0" y1={height * 0.75} x2="100" y2={height * 0.75} stroke="#ffffff05" strokeWidth="0.5" />

        {/* Price line */}
        <polyline
          points={pathData}
          fill="none"
          stroke={isUp ? '#0C8B44' : '#f44336'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Fill under line */}
        <polygon
          points={`0,${height} L ${pathData} L 100,${height}`}
          fill={isUp ? '#0C8B44' : '#f44336'}
          opacity="0.1"
        />
      </svg>

      {/* Price label */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs">
        <span className={`font-medium ${isUp ? 'text-[#0C8B44]' : 'text-[#f44336]'}`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        </span>
        <span className="text-[#737373]">
          ${prices[prices.length - 1].toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

/**
 * Real-Time Market Grid
 * Shows multiple assets with live prices updating every millisecond
 */
export function RealtimeMarketGrid({ assets }: { assets: Array<{ id: string; symbol: string; name: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {assets.map((asset) => (
        <div key={asset.id} className="rounded-xl bg-[#1a1a1a] border border-[#ffffff05] p-3">
          <RealtimePriceTicker symbol={asset.symbol} name={asset.name} />
          <div className="mt-2 h-10">
            <LiveMiniChart symbol={asset.symbol} height={40} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Real-Time Portfolio Value Display
 * Updates every millisecond as holdings prices change
 */
export function RealtimePortfolioValue({
  holdings,
}: {
  holdings: Array<{ symbol: string; quantity: number; avgPrice: number }>
}) {
  const prices = holdings.reduce(
    (acc, h) => {
      const price = useRealtimePrice(h.symbol)
      if (price) acc[h.symbol] = price
      return acc
    },
    {} as Record<string, number>
  )

  const totalValue = holdings.reduce((sum, h) => {
    const price = prices[h.symbol] || h.avgPrice
    return sum + h.quantity * price
  }, 0)

  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  return (
    <div className="p-6 rounded-xl bg-[#1a1a1a] border border-[#ffffff10]">
      <p className="text-xs text-[#737373] mb-2">Portfolio Value</p>
      <p className="text-3xl font-light text-[#E5E5E5] tabular-nums mb-3">
        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs text-[#737373]">Total P&L</p>
          <p className={`text-lg font-medium ${totalPnl >= 0 ? 'text-[#0C8B44]' : 'text-[#f44336]'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#737373]">Return %</p>
          <p className={`text-lg font-medium ${totalPnlPercent >= 0 ? 'text-[#0C8B44]' : 'text-[#f44336]'}`}>
            {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  )
}
