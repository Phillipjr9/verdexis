import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Play, BarChart3, Target } from 'lucide-react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { portfolioStore } from '../lib/portfolioStore'
import { marketData } from '../lib/marketData'
import { runMonteCarloSimulation, runScenarioAnalysis, generateHistogramBuckets } from '../lib/monteCarlo'
import { useCurrency } from '../lib/currencyContext'
import { toast } from 'sonner'

export default function StressTesting() {
  const { format: fmtMoney } = useCurrency()
  const [holdings, setHoldings] = useState(portfolioStore.getHoldings())
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({})
  const [daysAhead, setDaysAhead] = useState(30)
  const [numSimulations, setNumSimulations] = useState(10000)
  const [customScenario, setCustomScenario] = useState({ BTC: -30, ETH: -20, SOL: -15 })

  useEffect(() => {
    const refresh = () => setHoldings(portfolioStore.getHoldings())
    window.addEventListener('verdexis:portfolio', refresh)
    return () => window.removeEventListener('verdexis:portfolio', refresh)
  }, [])

  useEffect(() => {
    // Fetch historical prices for all holdings
    const fetchHistory = async () => {
      const history: Record<string, number[]> = {}
      
      for (const h of holdings) {
        try {
          const quotes = await marketData.getCryptoList()
          const quote = quotes.find(q => q.id === h.id || q.symbol.toLowerCase() === h.symbol.toLowerCase())
          if (quote?.sparkline_in_7d?.price) {
            history[h.symbol] = quote.sparkline_in_7d.price
          }
        } catch (err) {
          console.error(`Failed to fetch history for ${h.symbol}:`, err)
        }
      }
      
      setPriceHistory(history)
    }

    if (holdings.length > 0) {
      fetchHistory()
    }
  }, [holdings])

  const runSimulation = async () => {
    if (holdings.length === 0) {
      toast.error('No holdings to stress test')
      return
    }

    if (Object.keys(priceHistory).length === 0) {
      toast.error('Loading price history...')
      return
    }

    setLoading(true)
    try {
      // Run Monte Carlo simulation
      const result = runMonteCarloSimulation(
        holdings.map(h => ({
          symbol: h.symbol,
          quantity: h.quantity,
          currentPrice: h.currentPrice,
          value: h.value,
        })),
        priceHistory,
        daysAhead,
        numSimulations
      )
      
      setResults(result)
      toast.success(`Ran ${numSimulations.toLocaleString()} simulations`)
    } catch (error) {
      console.error('Monte Carlo simulation error:', error)
      toast.error('Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  const runCustomScenario = () => {
    if (holdings.length === 0) {
      toast.error('No holdings to test')
      return
    }

    const scenarioMap: Record<string, number> = {}
    holdings.forEach(h => {
      const change = customScenario[h.symbol as keyof typeof customScenario] || 0
      scenarioMap[h.symbol] = change / 100 // Convert percentage to decimal
    })

    const result = runScenarioAnalysis(
      holdings.map(h => ({
        symbol: h.symbol,
        quantity: h.quantity,
        currentPrice: h.currentPrice,
        value: h.value,
      })),
      scenarioMap
    )

    toast.success(`Scenario result: ${fmtMoney(result)}`)
  }

  const currentValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const histogram = results ? generateHistogramBuckets(results.distribution, 40) : []

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-[#f44336]/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#f44336]" />
              </div>
              <div>
                <h1 className="text-3xl font-light text-[#E5E5E5]">Portfolio Stress Testing</h1>
                <p className="text-sm text-[#737373]">Monte Carlo simulation & scenario analysis</p>
              </div>
            </div>
          </div>

          {/* Current Portfolio Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-4">
              <p className="text-xs text-[#737373] mb-1">Current Value</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{fmtMoney(currentValue)}</p>
            </div>
            <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-4">
              <p className="text-xs text-[#737373] mb-1">Holdings</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{holdings.length} assets</p>
            </div>
            <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-4">
              <p className="text-xs text-[#737373] mb-1">Simulation Status</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{results ? 'Complete' : 'Ready'}</p>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium text-[#E5E5E5] mb-4">Monte Carlo Simulation</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-[#737373] mb-2 block">Days Ahead</label>
                <input
                  type="number"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(parseInt(e.target.value) || 30)}
                  className="w-full bg-[#1a1a1a] border border-[#ffffff10] rounded-lg px-4 py-2 text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                  min="7"
                  max="365"
                />
              </div>
              <div>
                <label className="text-sm text-[#737373] mb-2 block">Simulations</label>
                <select
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(parseInt(e.target.value))}
                  className="w-full bg-[#1a1a1a] border border-[#ffffff10] rounded-lg px-4 py-2 text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                >
                  <option value="1000">1,000 (Fast)</option>
                  <option value="5000">5,000 (Balanced)</option>
                  <option value="10000">10,000 (Accurate)</option>
                  <option value="50000">50,000 (Precise)</option>
                </select>
              </div>
            </div>

            <button
              onClick={runSimulation}
              disabled={loading || holdings.length === 0}
              className="w-full bg-[#0C8B44] text-white py-3 rounded-lg font-medium hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running {numSimulations.toLocaleString()} Simulations...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Stress Test
                </>
              )}
            </button>

            <p className="text-xs text-[#737373] mt-2 text-center">
              Simulates {numSimulations.toLocaleString()} possible futures for your portfolio over {daysAhead} days
            </p>
          </div>

          {/* Results */}
          {results && (
            <>
              {/* Outcome Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0f1619] border border-[#f44336]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-[#f44336]" />
                    <p className="text-sm text-[#737373]">Worst Case (5th %ile)</p>
                  </div>
                  <p className="text-2xl font-light text-[#f44336]">{fmtMoney(results.percentiles.p5)}</p>
                  <p className="text-xs text-[#f44336] mt-1">
                    {((results.percentiles.p5 - currentValue) / currentValue * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="bg-[#0f1619] border border-[#0C8B44]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-[#0C8B44]" />
                    <p className="text-sm text-[#737373]">Most Likely (50th %ile)</p>
                  </div>
                  <p className="text-2xl font-light text-[#E5E5E5]">{fmtMoney(results.mostLikely)}</p>
                  <p className="text-xs text-[#737373] mt-1">
                    {((results.mostLikely - currentValue) / currentValue * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="bg-[#0f1619] border border-[#4CAF50]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-[#4CAF50]" />
                    <p className="text-sm text-[#737373]">Best Case (95th %ile)</p>
                  </div>
                  <p className="text-2xl font-light text-[#4CAF50]">{fmtMoney(results.percentiles.p95)}</p>
                  <p className="text-xs text-[#4CAF50] mt-1">
                    {((results.percentiles.p95 - currentValue) / currentValue * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Distribution Histogram */}
              <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[#0C8B44]" />
                  <h3 className="text-lg font-medium text-[#E5E5E5]">Outcome Distribution</h3>
                </div>
                
                <div className="flex items-end gap-1 h-48">
                  {histogram.map((bucket, i) => {
                    const height = (bucket.count / Math.max(...histogram.map(b => b.count))) * 100
                    const isNegative = bucket.max < currentValue
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all hover:opacity-70"
                        style={{
                          height: `${height}%`,
                          backgroundColor: isNegative ? '#f44336' : '#0C8B44',
                          opacity: 0.7,
                        }}
                        title={`${fmtMoney(bucket.min)} - ${fmtMoney(bucket.max)}: ${bucket.count} outcomes`}
                      />
                    )
                  })}
                </div>

                <div className="flex justify-between text-xs text-[#737373] mt-2">
                  <span>{fmtMoney(results.worstCase)}</span>
                  <span>Current: {fmtMoney(currentValue)}</span>
                  <span>{fmtMoney(results.bestCase)}</span>
                </div>
              </div>

              {/* Percentiles Table */}
              <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-6 mb-6">
                <h3 className="text-lg font-medium text-[#E5E5E5] mb-4">Confidence Intervals</h3>
                <div className="space-y-2">
                  {[
                    { label: '5th Percentile', value: results.percentiles.p5, desc: '95% chance portfolio will be above this' },
                    { label: '25th Percentile', value: results.percentiles.p25, desc: '75% chance portfolio will be above this' },
                    { label: '50th Percentile (Median)', value: results.percentiles.p50, desc: 'Most likely outcome' },
                    { label: '75th Percentile', value: results.percentiles.p75, desc: '25% chance portfolio will be above this' },
                    { label: '95th Percentile', value: results.percentiles.p95, desc: '5% chance portfolio will be above this' },
                  ].map((row) => {
                    const change = ((row.value - currentValue) / currentValue) * 100
                    const isPositive = change >= 0
                    return (
                      <div key={row.label} className="flex items-center justify-between py-3 border-b border-[#ffffff05] last:border-0">
                        <div>
                          <p className="text-sm text-[#E5E5E5]">{row.label}</p>
                          <p className="text-xs text-[#737373]">{row.desc}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[#E5E5E5]">{fmtMoney(row.value)}</p>
                          <p className={`text-xs ${isPositive ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                            {isPositive ? '+' : ''}{change.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Custom Scenario Analysis */}
          <div className="bg-[#0f1619] border border-[#ffffff08] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-[#FF9800]" />
              <h3 className="text-lg font-medium text-[#E5E5E5]">Custom Scenario</h3>
            </div>
            <p className="text-sm text-[#737373] mb-4">Test specific price movements</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {['BTC', 'ETH', 'SOL'].map(symbol => (
                <div key={symbol}>
                  <label className="text-sm text-[#737373] mb-2 block">{symbol} Change (%)</label>
                  <input
                    type="number"
                    value={customScenario[symbol as keyof typeof customScenario]}
                    onChange={(e) => setCustomScenario({ ...customScenario, [symbol]: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#1a1a1a] border border-[#ffffff10] rounded-lg px-4 py-2 text-[#E5E5E5] focus:outline-none focus:border-[#FF9800]"
                    step="5"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={runCustomScenario}
              disabled={holdings.length === 0}
              className="w-full bg-[#FF9800] text-white py-3 rounded-lg font-medium hover:bg-[#F57C00] transition-colors disabled:opacity-50"
            >
              Calculate Scenario Impact
            </button>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 p-4 bg-[#f44336]/10 border border-[#f44336]/30 rounded-lg">
            <p className="text-xs text-[#A0A0A0]">
              <strong className="text-[#f44336]">Disclaimer:</strong> Monte Carlo simulations are probabilistic models and do not predict future performance. 
              Past volatility does not guarantee future volatility. Use for educational purposes only. Crypto markets can move beyond historical ranges.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
