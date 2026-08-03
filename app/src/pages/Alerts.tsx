import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { ArrowLeft, Bell, Trash2, Plus, TrendingUp, TrendingDown } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { api, getToken } from '../lib/api'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { formatPrice } from '@/lib/utils'

interface Alert {
  id: string
  symbol: string
  name: string
  direction: 'above' | 'below'
  target: number
  active: boolean
  triggered: boolean
  createdAt: string
  alertType?: 'price' | 'technical' | 'percentage' | 'portfolio'
  technicalIndicator?: string
  percentageChange?: number
  timeWindow?: number
  portfolioTarget?: number
}

export default function Alerts() {
  return <RequireAuth><AlertsInner /></RequireAuth>
}

function AlertsInner() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [coins, setCoins] = useState<CryptoQuote[]>([])
  const [alertType, setAlertType] = useState<'price' | 'technical' | 'percentage' | 'portfolio'>('price')
  const [symbol, setSymbol] = useState('BTC')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [target, setTarget] = useState('')
  const [technicalIndicator, setTechnicalIndicator] = useState('RSI')
  const [percentageChange, setPercentageChange] = useState('')
  const [timeWindow, setTimeWindow] = useState('24')
  const [portfolioTarget, setPortfolioTarget] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!getToken()) { setAlerts([]); setLoading(false); return }
    try {
      const r = await api.listAlerts()
      setAlerts(r.alerts)
    } catch { /* offline */ }
    setLoading(false)
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void load()
      void marketData.getCryptoList().then((c) => setCoins(c.slice(0, 30))).catch(() => {})
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const coin = coins.find((c) => (c.symbol || '').toUpperCase() === (symbol || '').toUpperCase())
    const payload: any = {
      symbol: symbol.toUpperCase(),
      name: coin?.name || symbol,
      alertType,
    }

    // Build alert based on type
    switch (alertType) {
      case 'price':
        const priceTarget = parseFloat(target)
        if (!priceTarget || priceTarget <= 0) {
          toast.error('Enter a valid target price')
          return
        }
        payload.direction = direction
        payload.target = priceTarget
        break

      case 'technical':
        const techTarget = parseFloat(target)
        if (!techTarget || techTarget <= 0) {
          toast.error('Enter a valid RSI value')
          return
        }
        payload.direction = direction
        payload.target = techTarget
        payload.technicalIndicator = technicalIndicator
        break

      case 'percentage':
        const pctChange = parseFloat(percentageChange)
        if (!pctChange) {
          toast.error('Enter a valid percentage')
          return
        }
        payload.direction = pctChange < 0 ? 'below' : 'above'
        payload.target = 0
        payload.percentageChange = Math.abs(pctChange)
        payload.timeWindow = parseInt(timeWindow) || 24
        break

      case 'portfolio':
        const portTarget = parseFloat(portfolioTarget)
        if (!portTarget || portTarget <= 0) {
          toast.error('Enter a valid portfolio value')
          return
        }
        payload.direction = direction
        payload.target = 0
        payload.portfolioTarget = portTarget
        break
    }

    try {
      await api.addAlert(payload)
      toast.success('Alert created')
      setTarget('')
      setPercentageChange('')
      setPortfolioTarget('')
      await load()
    } catch {
      toast.error('Could not create alert (is the API offline?)')
    }
  }

  const remove = async (id: string) => {
    try { await api.removeAlert(id); toast.success('Alert removed'); await load() }
    catch { toast.error('Could not remove') }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" richColors />
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Price Alerts</h1>
              <p className="text-xs text-[#737373]">Get notified when an asset crosses your target price.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-4 sm:p-5 mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#737373]">Alert workflow</p>
                <h2 className="text-base font-medium text-[#E5E5E5] mt-1">Set a few useful alerts and let the system watch for you</h2>
                <p className="text-sm text-[#A0A0A0] mt-1">The best setups are simple: one price alert, one percentage move, and one portfolio threshold.</p>
              </div>
              <div className="rounded-full border border-[#0C8B44]/20 bg-[#0C8B44]/10 px-3 py-1 text-sm font-medium text-[#0C8B44]">
                {alerts.filter((alert) => alert.active && !alert.triggered).length} active
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                { title: 'Price watch', description: 'Track a coin that you already follow' },
                { title: 'Momentum trigger', description: 'React quickly to sudden percentage moves' },
                { title: 'Portfolio guardrail', description: 'Keep exposure aligned with your plan' },
              ].map((step) => (
                <div key={step.title} className="rounded-xl border border-[#ffffff05] bg-[#1a1a1a]/50 p-3">
                  <p className="text-sm font-medium text-[#E5E5E5]">{step.title}</p>
                  <p className="text-xs text-[#737373] mt-1">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 h-fit">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0C8B44]" />New alert
              </h2>
              
              {/* Alert Type Tabs */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setAlertType('price')}
                  className={`py-2 text-xs rounded-lg border transition-colors ${
                    alertType === 'price'
                      ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]'
                      : 'border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'
                  }`}
                >
                  Price
                </button>
                <button
                  type="button"
                  onClick={() => setAlertType('technical')}
                  className={`py-2 text-xs rounded-lg border transition-colors ${
                    alertType === 'technical'
                      ? 'bg-[#2196F3]/15 border-[#2196F3]/40 text-[#2196F3]'
                      : 'border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'
                  }`}
                >
                  Technical
                </button>
                <button
                  type="button"
                  onClick={() => setAlertType('percentage')}
                  className={`py-2 text-xs rounded-lg border transition-colors ${
                    alertType === 'percentage'
                      ? 'bg-[#FF9800]/15 border-[#FF9800]/40 text-[#FF9800]'
                      : 'border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'
                  }`}
                >
                  Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setAlertType('portfolio')}
                  className={`py-2 text-xs rounded-lg border transition-colors ${
                    alertType === 'portfolio'
                      ? 'bg-[#9C27B0]/15 border-[#9C27B0]/40 text-[#9C27B0]'
                      : 'border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'
                  }`}
                >
                  Portfolio
                </button>
              </div>

              <form onSubmit={create} className="space-y-4">
                {/* Price Alert */}
                {alertType === 'price' && (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Symbol</label>
                      <select aria-label="Alert symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                        {coins.map((c) => (
                          <option key={c.id} value={c.symbol.toUpperCase()}>{c.name} ({c.symbol.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Direction</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDirection('above')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'above' ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                          <TrendingUp className="w-3 h-3 inline mr-1" />Above
                        </button>
                        <button type="button" onClick={() => setDirection('below')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'below' ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                          <TrendingDown className="w-3 h-3 inline mr-1" />Below
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Target price (USD)</label>
                      <input type="number" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required placeholder="e.g. 75000" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                    </div>
                  </>
                )}

                {/* Technical Alert */}
                {alertType === 'technical' && (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Symbol</label>
                      <select aria-label="Alert symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                        {coins.map((c) => (
                          <option key={c.id} value={c.symbol.toUpperCase()}>{c.name} ({c.symbol.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Indicator</label>
                      <select value={technicalIndicator} onChange={(e) => setTechnicalIndicator(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                        <option value="RSI">RSI (Relative Strength Index)</option>
                        <option value="MACD">MACD (Coming Soon)</option>
                        <option value="MA">Moving Average (Coming Soon)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Direction</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDirection('above')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'above' ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                          <TrendingUp className="w-3 h-3 inline mr-1" />Above
                        </button>
                        <button type="button" onClick={() => setDirection('below')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'below' ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                          <TrendingDown className="w-3 h-3 inline mr-1" />Below
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">RSI Value</label>
                      <input type="number" step="1" min="0" max="100" value={target} onChange={(e) => setTarget(e.target.value)} required placeholder="e.g. 30 (oversold) or 70 (overbought)" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                      <p className="text-[10px] text-[#737373] mt-1">Typical: RSI &lt; 30 (oversold), RSI &gt; 70 (overbought)</p>
                    </div>
                  </>
                )}

                {/* Percentage Alert */}
                {alertType === 'percentage' && (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Symbol</label>
                      <select aria-label="Alert symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                        {coins.map((c) => (
                          <option key={c.id} value={c.symbol.toUpperCase()}>{c.name} ({c.symbol.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Percentage Change (%)</label>
                      <input type="number" step="any" value={percentageChange} onChange={(e) => setPercentageChange(e.target.value)} required placeholder="e.g. -10 for 10% drop or +20 for 20% gain" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                      <p className="text-[10px] text-[#737373] mt-1">Use negative for drops (e.g. -10%), positive for gains (e.g. +15%)</p>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Time Window (hours)</label>
                      <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                        <option value="1">1 hour</option>
                        <option value="4">4 hours</option>
                        <option value="24">24 hours</option>
                        <option value="168">7 days</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Portfolio Alert */}
                {alertType === 'portfolio' && (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Direction</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDirection('above')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'above' ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                          <TrendingUp className="w-3 h-3 inline mr-1" />Above
                        </button>
                        <button type="button" onClick={() => setDirection('below')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'below' ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                          <TrendingDown className="w-3 h-3 inline mr-1" />Below
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Portfolio Value (USD)</label>
                      <input type="number" step="any" min="0" value={portfolioTarget} onChange={(e) => setPortfolioTarget(e.target.value)} required placeholder="e.g. 100000" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                      <p className="text-[10px] text-[#737373] mt-1">Alert when your total net worth crosses this threshold</p>
                    </div>
                  </>
                )}

                <button type="submit" className="w-full py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">Create alert</button>
              </form>
            </div>

            <div className="lg:col-span-2">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Your alerts ({alerts.length})</h2>
              {loading ? (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-12 text-center text-xs text-[#737373]">Loading…</div>
              ) : alerts.length === 0 ? (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-12 text-center">
                  <Bell className="w-8 h-8 mx-auto text-[#444] mb-3" />
                  <p className="text-sm text-[#A0A0A0] mb-1">No alerts yet</p>
                  <p className="text-xs text-[#737373]">Create your first alert on the left.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => {
                    const typeColor = {
                      price: '#0C8B44',
                      technical: '#2196F3',
                      percentage: '#FF9800',
                      portfolio: '#9C27B0',
                    }[a.alertType || 'price']

                    const typeLabel = {
                      price: 'Price',
                      technical: 'Technical',
                      percentage: 'Percentage',
                      portfolio: 'Portfolio',
                    }[a.alertType || 'price']

                    let description = ''
                    if (a.alertType === 'price') {
                      description = `When price goes ${a.direction} ${formatPrice(a.target)}`
                    } else if (a.alertType === 'technical') {
                      description = `When ${a.technicalIndicator || 'RSI'} goes ${a.direction} ${a.target}`
                    } else if (a.alertType === 'percentage') {
                      description = `When price ${a.percentageChange && a.percentageChange < 0 ? 'drops' : 'rises'} ${Math.abs(a.percentageChange || 0)}% in ${a.timeWindow || 24}h`
                    } else if (a.alertType === 'portfolio') {
                      description = `When portfolio goes ${a.direction} ${formatPrice(a.portfolioTarget || 0)}`
                    }

                    return (
                      <div key={a.id} className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${typeColor}15`, color: typeColor }}>
                            {a.direction === 'above' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm text-[#E5E5E5]">{a.name} <span className="text-[#737373]">({(a.symbol || '').toUpperCase()})</span></p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: `${typeColor}15`, color: typeColor }}>
                                {typeLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#A0A0A0]">{description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.triggered ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : a.active ? 'bg-[#0C8B44]/10 text-[#0C8B44]' : 'bg-[#444]/20 text-[#737373]'}`}>
                            {a.triggered ? 'Triggered' : a.active ? 'Active' : 'Inactive'}
                          </span>
                          <button onClick={() => remove(a.id)} aria-label="Delete" className="text-[#555] hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
