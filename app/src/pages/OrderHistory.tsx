import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowLeft, Download, Filter, TrendingUp, TrendingDown } from 'lucide-react'
import { Toaster, toast } from 'sonner'

interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  total: number
  timestamp: Date
  status: 'filled' | 'cancelled' | 'partial'
  fee: number
}

export default function OrderHistory() {
  const [trades] = useState<Trade[]>([
    {
      id: '1',
      symbol: 'BTC',
      side: 'buy',
      quantity: 0.5,
      price: 42500,
      total: 21250,
      timestamp: new Date(Date.now() - 86400000),
      status: 'filled',
      fee: 21.25,
    },
    {
      id: '2',
      symbol: 'ETH',
      side: 'sell',
      quantity: 2,
      price: 2250,
      total: 4500,
      timestamp: new Date(Date.now() - 172800000),
      status: 'filled',
      fee: 4.5,
    },
  ])

  const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'filled' | 'cancelled' | 'partial'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')

  const filteredTrades = useMemo(() => {
    let result = trades

    if (filterSide !== 'all') {
      result = result.filter(t => t.side === filterSide)
    }

    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus)
    }

    if (sortBy === 'date') {
      result = result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } else {
      result = result.sort((a, b) => b.total - a.total)
    }

    return result
  }, [trades, filterSide, filterStatus, sortBy])

  const stats = useMemo(() => {
    const filled = trades.filter(t => t.status === 'filled')
    const buys = filled.filter(t => t.side === 'buy')
    const sells = filled.filter(t => t.side === 'sell')
    const totalVolume = filled.reduce((sum, t) => sum + t.total, 0)
    const totalFees = filled.reduce((sum, t) => sum + t.fee, 0)

    return {
      totalTrades: filled.length,
      totalBuys: buys.length,
      totalSells: sells.length,
      totalVolume,
      totalFees,
    }
  }, [trades])

  const handleExport = () => {
    const csv = [
      ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'Total', 'Fee', 'Status'],
      ...trades.map(t => [
        new Date(t.timestamp).toISOString(),
        t.symbol,
        t.side,
        t.quantity,
        t.price,
        t.total,
        t.fee,
        t.status,
      ]),
    ]
      .map(row => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `order-history-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Order history exported')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <Toaster position="top-right" theme="dark" richColors />

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/trading" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to trading
        </Link>

        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Order History</h1>
              <p className="text-xs text-[#737373]">View all your trades and transactions</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Trades', value: stats.totalTrades },
            { label: 'Buys', value: stats.totalBuys },
            { label: 'Sells', value: stats.totalSells },
            { label: 'Total Volume', value: `$${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
            { label: 'Total Fees', value: `$${stats.totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">{stat.label}</p>
              <p className="text-xl font-light text-[#E5E5E5]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#0C8B44]" />
            <h2 className="text-sm font-medium text-[#E5E5E5]">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Side</label>
              <select
                value={filterSide}
                onChange={(e) => setFilterSide(e.target.value as 'all' | 'buy' | 'sell')}
                className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              >
                <option value="all">All</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'filled' | 'cancelled' | 'partial')}
                className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              >
                <option value="all">All</option>
                <option value="filled">Filled</option>
                <option value="partial">Partial</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              >
                <option value="date">Date (Newest)</option>
                <option value="amount">Amount (Highest)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Trades Table */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          {filteredTrades.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingUp className="w-12 h-12 text-[#737373] mx-auto mb-3 opacity-50" />
              <p className="text-sm text-[#A0A0A0]">No trades match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#ffffff08]">
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#737373] uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#737373] uppercase tracking-wider">Symbol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#737373] uppercase tracking-wider">Side</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#737373] uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#737373] uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#737373] uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#737373] uppercase tracking-wider">Fee</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-[#737373] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ffffff05]">
                  {filteredTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-[#ffffff05] transition-colors">
                      <td className="px-6 py-3 text-sm text-[#A0A0A0]">
                        {new Date(trade.timestamp).toLocaleDateString()} {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-[#E5E5E5]">{trade.symbol}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`flex items-center gap-1 w-fit ${trade.side === 'buy' ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                          {trade.side === 'buy' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {trade.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-[#A0A0A0]">{trade.quantity}</td>
                      <td className="px-6 py-3 text-sm text-right text-[#A0A0A0]">${trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium text-[#E5E5E5]">${trade.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-sm text-right text-[#A0A0A0]">${trade.fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
                            trade.status === 'filled'
                              ? 'bg-[#0C8B44]/20 text-[#0C8B44]'
                              : trade.status === 'partial'
                              ? 'bg-[#F57C00]/20 text-[#F57C00]'
                              : 'bg-[#f44336]/20 text-[#f44336]'
                          }`}
                        >
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
