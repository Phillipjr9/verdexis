import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, ShieldAlert, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { analyticsApi } from '../lib/advancedFeaturesApi'

interface PerformanceMetrics {
  sharpeRatio: number
  maxDrawdown: number
  annualizedReturn: number
  totalReturnPercent: number
  sortinoRatio: number
  winRate: number
}

interface RiskMetrics {
  volatility: number
  valueAtRisk95: number
  conditionalValueAtRisk95: number
  expectedShortfall: number
}

interface AttributionItem {
  symbol: string
  contribution: number
  percent: number
}

interface AttributionAnalysis {
  topContributors: AttributionItem[]
  topDetractors: AttributionItem[]
  sectorAllocation: Record<string, number>
  geographicAllocation: Record<string, number>
}

function formatNumber(value: number | undefined, digits = 2) {
  if (value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function AnalyticsPageContent() {
  const [days, setDays] = useState(365)
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [risk, setRisk] = useState<RiskMetrics | null>(null)
  const [attribution, setAttribution] = useState<AttributionAnalysis | null>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [perfRes, riskRes, attributionRes, recommendationsRes] = await Promise.all([
          analyticsApi.getPerformanceMetrics(days),
          analyticsApi.getRiskMetrics(days),
          analyticsApi.getAttribution(),
          analyticsApi.getRecommendations(),
        ])

        if (cancelled) return

        setPerformance(perfRes?.metrics ?? null)
        setRisk(riskRes?.risk ?? null)
        setAttribution(attributionRes?.attribution ?? null)
        setRecommendations(recommendationsRes?.recommendations ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load analytics right now.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [days])

  const allocationEntries = useMemo(() => {
    const sectors = attribution?.sectorAllocation ?? {}
    return Object.entries(sectors).sort((a, b) => b[1] - a[1])
  }, [attribution])

  const geographyEntries = useMemo(() => {
    const geos = attribution?.geographicAllocation ?? {}
    return Object.entries(geos).sort((a, b) => b[1] - a[1])
  }, [attribution])

  const statCards = [
    { label: 'Sharpe ratio', value: performance?.sharpeRatio ? formatNumber(performance.sharpeRatio) : '—', accent: 'text-[#0C8B44]' },
    { label: 'Max drawdown', value: performance?.maxDrawdown ? `${formatNumber(performance.maxDrawdown)}%` : '—', accent: 'text-red-400' },
    { label: 'Annualized return', value: performance?.annualizedReturn ? `${formatNumber(performance.annualizedReturn)}%` : '—', accent: 'text-[#E5E5E5]' },
    { label: 'VaR 95%', value: risk?.valueAtRisk95 ? `${formatNumber(risk.valueAtRisk95)}%` : '—', accent: 'text-[#E5E5E5]' },
  ]

  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0C8B44]/20 bg-[#0C8B44]/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#0C8B44] mb-3">
                <BarChart3 className="w-3.5 h-3.5" />Portfolio analytics
              </div>
              <h1 className="text-3xl font-light text-[#E5E5E5]">Performance, risk, attribution, and recommendations</h1>
              <p className="mt-2 text-sm text-[#737373] max-w-2xl">Review your portfolio’s risk-adjusted returns, downside exposure, and optimization ideas in one place.</p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-2">
              {[30, 90, 365].map((period) => (
                <button
                  key={period}
                  onClick={() => setDays(period)}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${days === period ? 'bg-[#0C8B44] text-white' : 'text-[#737373] hover:text-[#E5E5E5]'}`}
                >
                  {period}d
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-10 text-center text-[#737373]">
              Loading analytics…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#737373]">{card.label}</p>
                    <p className={`mt-3 text-2xl font-light ${card.accent}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-[#0C8B44]" />
                    <h2 className="text-lg font-medium text-[#E5E5E5]">Performance snapshot</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#737373]">Total return</p>
                      <p className="mt-2 text-xl font-light text-[#E5E5E5]">{performance?.totalReturnPercent ? `${formatNumber(performance.totalReturnPercent)}%` : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#737373]">Sortino ratio</p>
                      <p className="mt-2 text-xl font-light text-[#E5E5E5]">{performance?.sortinoRatio ? formatNumber(performance.sortinoRatio) : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#737373]">Win rate</p>
                      <p className="mt-2 text-xl font-light text-[#E5E5E5]">{performance?.winRate ? `${formatNumber(performance.winRate)}%` : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#737373]">Volatility</p>
                      <p className="mt-2 text-xl font-light text-[#E5E5E5]">{risk?.volatility ? `${formatNumber(risk.volatility)}%` : '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#0C8B44]" />
                    <h2 className="text-lg font-medium text-[#E5E5E5]">Recommendations</h2>
                  </div>
                  {recommendations.length > 0 ? (
                    <ul className="space-y-3">
                      {recommendations.map((recommendation, index) => (
                        <li key={`${recommendation}-${index}`} className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-3 text-sm text-[#A0A0A0]">
                          {recommendation}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 p-4 text-sm text-[#737373]">
                      No recommendations were returned for this period yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <h2 className="text-lg font-medium text-[#E5E5E5]">Top contributors</h2>
                  </div>
                  <div className="space-y-3">
                    {(attribution?.topContributors ?? []).map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 px-3 py-2 text-sm">
                        <span className="text-[#E5E5E5]">{item.symbol}</span>
                        <span className="text-[#737373]">{formatNumber(item.percent)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-4 h-4 text-yellow-400" />
                    <h2 className="text-lg font-medium text-[#E5E5E5]">Risk and allocation</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#737373] mb-2">Sector allocation</p>
                      <div className="space-y-2">
                        {allocationEntries.length > 0 ? allocationEntries.map(([sector, value]) => (
                          <div key={sector} className="flex items-center justify-between text-sm text-[#A0A0A0]">
                            <span>{sector}</span>
                            <span>{formatNumber(value)}%</span>
                          </div>
                        )) : <p className="text-sm text-[#737373]">No allocation data available.</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#737373] mb-2">Geographic mix</p>
                      <div className="space-y-2">
                        {geographyEntries.length > 0 ? geographyEntries.map(([region, value]) => (
                          <div key={region} className="flex items-center justify-between text-sm text-[#A0A0A0]">
                            <span>{region}</span>
                            <span>{formatNumber(value)}%</span>
                          </div>
                        )) : <p className="text-sm text-[#737373]">No geographic data available.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Analytics() {
  return (
    <RequireAuth>
      <AnalyticsPageContent />
    </RequireAuth>
  )
}
