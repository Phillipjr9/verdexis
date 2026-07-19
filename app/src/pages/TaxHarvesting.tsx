import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Scissors, Download, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'
import { taxApi } from '../lib/advancedFeaturesApi'

interface Position {
  id: string
  symbol: string
  quantity: number
  costBasis: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPct: number
  heldDays: number
  washSaleRisk: boolean
  harvested: boolean
}

interface TaxOpportunity {
  symbol: string
  quantity: number
  costBasis: number
  currentPrice: number
  marketValue?: number
  unrealizedLoss?: number
  unrealizedPnl?: number
  unrealizedPct?: number
  holdingDays?: number
  heldDays?: number
  washSaleRisk?: boolean
}

const TAX_RATE = 0.28

export default function TaxHarvesting() { return <RequireAuth><TaxHarvestingInner /></RequireAuth> }

function TaxHarvestingInner() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    taxApi.getTaxLossOpportunities()
      .then((data: { opportunities?: TaxOpportunity[] } | undefined) => {
        const opps = data?.opportunities ?? []
        setPositions(opps.map((o: TaxOpportunity, i: number) => ({
          id: String(i),
          symbol: o.symbol,
          quantity: o.quantity,
          costBasis: o.costBasis,
          currentPrice: o.currentPrice,
          marketValue: o.marketValue ?? o.quantity * o.currentPrice,
          unrealizedPnl: o.unrealizedLoss ?? o.unrealizedPnl ?? 0,
          unrealizedPct: o.unrealizedPct ?? 0,
          heldDays: o.holdingDays ?? o.heldDays ?? 0,
          washSaleRisk: o.washSaleRisk ?? false,
          harvested: false,
        })))
      })
      .catch(() => toast.error('Failed to load tax opportunities'))
      .finally(() => setLoading(false))
  }, [])

  const eligiblePositions = positions.filter(p => !p.harvested)
  const selectedPositions = eligiblePositions.filter(p => selected.has(p.id))

  const totalHarvestable = eligiblePositions.reduce((s, p) => s + Math.abs(p.unrealizedPnl), 0)
  const selectedLoss = selectedPositions.reduce((s, p) => s + Math.abs(p.unrealizedPnl), 0)
  const estimatedSavings = selectedLoss * TAX_RATE

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const harvest = async () => {
    if (selected.size === 0) { toast.error('Select positions to harvest'); return }
    const washedRisk = selectedPositions.some(p => p.washSaleRisk)
    try {
      await Promise.all(
        selectedPositions.map(p => taxApi.executeTaxLossHarvest(p.symbol, p.quantity))
      )
      setPositions(prev => prev.map(p => selected.has(p.id) ? { ...p, harvested: true } : p))
      setSelected(new Set())
      toast.success(`Tax-loss harvest completed — estimated savings $${estimatedSavings.toFixed(2)}${washedRisk ? ' (⚠ wash-sale risk on some positions)' : ''}`)
    } catch {
      toast.error('Harvest failed. Please try again.')
    }
  }

  const exportCsv = () => {
    const rows = [['Symbol', 'Quantity', 'Cost Basis', 'Current Price', 'Unrealized P&L', 'Held Days', 'Harvested']]
    positions.forEach(p => rows.push([p.symbol, String(p.quantity), String(p.costBasis), String(p.currentPrice), String(p.unrealizedPnl), String(p.heldDays), String(p.harvested)]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'tax-harvest-report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Tax-Loss Harvesting</h1>
              <p className="text-xs text-[#737373]">Identify unrealized losses to offset gains and reduce your tax liability.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-[#0C8B44] animate-spin" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                  <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Total Harvestable Loss</p>
                  <p className="text-xl font-light text-red-400">-${totalHarvestable.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                  <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Selected Loss</p>
                  <p className="text-xl font-light text-[#E5E5E5]">-${selectedLoss.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                  <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Est. Tax Savings (28%)</p>
                  <p className="text-xl font-light text-[#0C8B44]">${estimatedSavings.toFixed(2)}</p>
                </div>
              </div>

              {/* Wash sale notice */}
              <div className="flex items-start gap-2 rounded-xl bg-yellow-400/10 border border-yellow-400/20 px-4 py-3 mb-6">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">Wash-sale rule: If you sell a crypto at a loss and repurchase the same or substantially identical asset within 30 days, the loss may be disallowed. Positions flagged with ⚠ have been purchased recently.</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[#737373]">{selected.size} of {eligiblePositions.length} positions selected</p>
                <div className="flex gap-2">
                  <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#ffffff10] text-xs text-[#737373] hover:text-[#E5E5E5] rounded-lg transition-colors">
                    <Download className="w-3 h-3" />Export CSV
                  </button>
                  <button onClick={harvest} disabled={selected.size === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] disabled:opacity-50 transition-colors">
                    <Scissors className="w-3 h-3" />Harvest Selected
                  </button>
                </div>
              </div>

              {/* Positions table */}
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#ffffff08]">
                      <th className="text-left py-3 px-4 text-[10px] uppercase tracking-[0.05em] text-[#737373] w-8" />
                      {['Asset', 'Quantity', 'Cost Basis', 'Current', 'Unrealized P&L', 'Held', 'Action'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-[10px] uppercase tracking-[0.05em] text-[#737373]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eligiblePositions.map((p) => (
                      <tr key={p.id} className={`border-b border-[#ffffff05] hover:bg-[#0a0f11]/50 transition-colors ${selected.has(p.id) ? 'bg-[#0C8B44]/05' : ''}`}>
                        <td className="py-3 px-4">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-[#0C8B44] w-3.5 h-3.5" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-[#E5E5E5]">{p.symbol}</span>
                            {p.washSaleRisk && <span className="text-yellow-400 text-[10px]" title="Wash-sale risk">⚠</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#E5E5E5]">{p.quantity.toLocaleString()}</td>
                        <td className="py-3 px-3 text-xs text-[#737373]">${p.costBasis.toFixed(3)}</td>
                        <td className="py-3 px-3 text-xs text-[#E5E5E5]">${p.currentPrice.toFixed(3)}</td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="text-xs text-red-400">-${Math.abs(p.unrealizedPnl).toLocaleString()}</p>
                            <p className="text-[10px] text-[#737373]">{p.unrealizedPct.toFixed(1)}%</p>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#737373]">{p.heldDays}d</td>
                        <td className="py-3 px-3">
                          <button onClick={() => { setSelected(new Set([p.id])); harvest() }} className="text-[10px] px-2 py-1 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded transition-colors">
                            Harvest
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Harvested */}
              {positions.some(p => p.harvested) && (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5">
                  <h3 className="text-xs font-medium text-[#E5E5E5] mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#0C8B44]" />Harvested Positions</h3>
                  <div className="space-y-2">
                    {positions.filter(p => p.harvested).map(p => (
                      <div key={p.id} className="flex justify-between text-xs text-[#737373] py-1 border-b border-[#ffffff05]">
                        <span>{p.symbol}</span>
                        <span className="text-[#0C8B44]">Saved ~${(Math.abs(p.unrealizedPnl) * TAX_RATE).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
