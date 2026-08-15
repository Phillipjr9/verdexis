import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Navigation from '../components/Navigation'
import AuthModal from '../components/AuthModal'
import Footer from '../components/Footer'
import RiskMetricsCard from '../components/RiskMetricsCard'
import { Skeleton } from '../components/Skeleton'
import TopMovers from '../components/dashboard/TopMovers'
import PortfolioHealthCard from '../components/dashboard/PortfolioHealthCard'
import MorningBriefCard from '../components/dashboard/MorningBriefCard'
import AlertsSummaryCard from '../components/dashboard/AlertsSummaryCard'
import GoalsProgressCard from '../components/dashboard/GoalsProgressCard'
import CategoryBreakdownCard from '../components/dashboard/CategoryBreakdownCard'
import StakingCard from '../components/dashboard/StakingCard'
import DcaCard from '../components/dashboard/DcaCard'
import TradingAttribution from '../components/dashboard/TradingAttribution'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import CurrencySelector from '../components/dashboard/CurrencySelector'
import ExportMenu from '../components/dashboard/ExportMenu'
import CustomizeWidgets from '../components/dashboard/CustomizeWidgets'
import AdminQuickPanel from '../components/dashboard/AdminQuickPanel'
import { AdminDashboardCharts } from '../components/dashboard/AdminDashboardCharts'
import TimeRangePicker, { type ChartRange, rangeLabel } from '../components/dashboard/TimeRangePicker'
import NetWorthChart from '../components/NetWorthChart'
import EmptyStateCta from '../components/dashboard/EmptyStateCta'
import WatchlistPanel from '../components/WatchlistPanel'
import DensityToggle from '../components/dashboard/DensityToggle'
import ConnectedAccountsCard from '../components/dashboard/ConnectedAccountsCard'
import NewsSnippetCard from '../components/dashboard/NewsSnippetCard'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { realTimePrice } from '../lib/realTimePrice'
import { aiService, type AIInsight } from '../lib/aiService'
import { api, clearStoredAuth, getToken } from '../lib/api'
import { portfolioStore, type PortfolioHolding, type Trade, type WalletBalance, type WalletTransaction } from '../lib/portfolioStore'
import { assetIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'
import { useCurrency } from '../lib/currencyContext'
import { dashboardLayout, DASHBOARD_LAYOUT_EVENT } from '../lib/dashboardLayout'
import { computePortfolioHealth } from '../lib/portfolioHealth'
import { dcaStore, nextRunMs } from '../lib/dcaStore'
import { Toaster, toast } from 'sonner'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  BrainCircuit, Zap, Sparkles, AlertTriangle, BarChart3,
  PieChart, Activity, Lock,
  ArrowRight, Gem, Layers,
  History, Repeat, Settings as SettingsIcon,
  Eye, EyeOff, WifiOff, RefreshCw, CheckCircle2, CircleDashed,
} from 'lucide-react'

const getCryptoLogo = (idOrSymbol: string, type?: string) => assetIconFor(idOrSymbol, type)

// Compact relative-time formatter for recent activity rows. Stays compact
// ("2m", "3h", "5d") for things that happened recently, but switches to an
// actual locale date once the row is more than 30 days old — a backdated
// transaction reading "338d ago" looks unprofessional next to the modern
// rows, so admins / users see e.g. "Mar 12, 2025" instead.
function relativeTimeShort(d: Date): string {
  const sec = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86_400) return `${Math.round(sec / 3600)}h ago`
  if (sec < 86_400 * 30) return `${Math.round(sec / 86_400)}d ago`
  // Older than ~a month — show the actual date instead of a noisy
  // relative count. Includes the year only if it's not the current year.
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}

function getSparklinePath(prices: number[], width: number, height: number): string {
  // Need at least 2 points to draw a line. With 1 point, `width / 0` = Infinity
  // and the resulting SVG path is full of NaN coordinates.
  if (!prices || prices.length < 2) return ''
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const step = width / (prices.length - 1)
  return prices
    .map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * (height - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// Tiny child that subscribes to liveTicker for one coin so its price text
// and the tail of its sparkline visibly tick every ~2 seconds, instead of
// being frozen between the parent's 30s CoinGecko refreshes.
function LiveMarketCard({
  crypto,
  fmtMoney,
}: {
  crypto: CryptoQuote
  fmtMoney: (n: number) => string
}) {
  const baseSpark = crypto.sparkline_in_7d?.price.slice(-20) ?? []
  const [livePrice, setLivePrice] = useState<number>(() => liveTicker.getPrice(crypto.id) ?? crypto.current_price)
  useEffect(() => {
    const unsub = liveTicker.subscribe(crypto.id, (p) => setLivePrice(p))
    return unsub
  }, [crypto.id])
  // Append the live price to the sparkline tail so the curve crawls forward
  // as new ticks arrive, instead of staying snapshot-still.
  const sparklinePrices = useMemo(() => {
    if (baseSpark.length === 0) return baseSpark
    const last = baseSpark[baseSpark.length - 1]
    if (Math.abs(livePrice - last) / Math.max(last, 1e-9) < 1e-6) return baseSpark
    return [...baseSpark.slice(1), livePrice]
  }, [baseSpark, livePrice])
  const isUp = crypto.price_change_percentage_24h >= 0
  return (
    <Link to={`/asset/${crypto.id}`} className="p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all min-w-0 overflow-hidden block">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {getCryptoLogo(crypto.id) ? (
            <img
              src={getCryptoLogo(crypto.id)!}
              alt={crypto.name}
              className="w-5 h-5 rounded-full object-cover shrink-0"
              onError={cryptoIconErrorFallback((crypto.symbol || crypto.id || '?').toUpperCase()[0] || '?', crypto.id)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44] shrink-0">{(crypto.symbol || crypto.id || '?').toUpperCase()[0]}</div>
          )}
          <span className="text-xs font-medium text-[#E5E5E5] truncate">{(crypto.symbol || crypto.id || '').toUpperCase()}</span>
        </div>
        {isUp ? <TrendingUp className="w-3 h-3 text-[#4CAF50] shrink-0" /> : <TrendingDown className="w-3 h-3 text-[#f44336] shrink-0" />}
      </div>
      <p className="text-base font-light text-[#E5E5E5] truncate tabular-nums">{fmtMoney(livePrice)}</p>
      <p className={`text-[11px] mt-0.5 truncate ${isUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
        {isUp ? '+' : ''}{(crypto.price_change_percentage_24h ?? 0).toFixed(2)}%
      </p>
      {sparklinePrices.length > 0 && (
        <div className="mt-2 h-7">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
            <path
              d={getSparklinePath(sparklinePrices, 100, 30)}
              fill="none"
              stroke={isUp ? '#4CAF50' : '#f44336'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
          </svg>
        </div>
      )}
    </Link>
  )
}

export default function Dashboard() {
  const { format: fmtMoney } = useCurrency()
  const location = useLocation()
  const [cryptoData, setCryptoData] = useState<CryptoQuote[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [wallet, setWallet] = useState<WalletBalance[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [chartRange, setChartRange] = useState<ChartRange>('1W')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getToken())
  const [showBenchmark, setShowBenchmark] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showNetWorth, setShowNetWorth] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('verdexis_show_networth') !== '0'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('verdexis_show_networth', showNetWorth ? '1' : '0')
  }, [showNetWorth])
  // Mask digits while preserving currency symbol, separators, and length
  // so the masked value visually conveys the same magnitude as the real one
  // (e.g. "$12,345.67" -> "$**,***.**").
  const maskMoney = (s: string) => s.replace(/\d/g, '*')
  const formatCryptoAmount = (amount: number) => amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
    useGrouping: true,
  })
  const [hiddenWidgets, setHiddenWidgets] = useState(() => dashboardLayout.hidden())
  useEffect(() => {
    const syncAuthState = () => setIsAuthenticated(!!getToken())
    syncAuthState()
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('verdexis:profile', syncAuthState)
    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('verdexis:profile', syncAuthState)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    api.me()
      .then(() => {
        if (!active) return
      })
      .catch(() => {
        if (!active) return
        clearStoredAuth()
        setIsAuthenticated(false)
        setApiError('Your session expired. Please sign in again.')
      })

    return () => { active = false }
  }, [isAuthenticated])

  const userName = (() => {
    try {
      const auth = localStorage.getItem('verdexis_auth')
      if (auth) return (JSON.parse(auth).name as string) || 'there'
    } catch { /* ignore */ }
    return 'there'
  })()
  const roleLabel = (() => {
    try {
      const auth = localStorage.getItem('verdexis_auth')
      if (auth) return (JSON.parse(auth).role === 'admin' ? 'Admin' : 'User') as 'Admin' | 'User'
    } catch { /* ignore */ }
    return undefined
  })()
  const isAdminRole = roleLabel === 'Admin'
  const verified = (() => {
    try {
      const auth = localStorage.getItem('verdexis_auth')
      if (auth) return JSON.parse(auth).kycStatus === 'approved'
    } catch { /* ignore */ }
    return false
  })()

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [crypto, aiInsights] = await Promise.all([
        marketData.getCryptoList(),
        aiService.getPortfolioInsights(),
      ])
      setCryptoData(crypto)
      setInsights(aiInsights)
      setApiError(null)

      if (crypto && crypto.length) {
        const quotes: Record<string, number> = {}
        for (const c of crypto) {
          quotes[c.id] = c.current_price
          if (c.symbol) quotes[c.symbol.toLowerCase()] = c.current_price
        }
        portfolioStore.markToMarket(quotes)
      }

      if (isAuthenticated) {
        try {
          await portfolioStore.hydrate(true)
        } catch {
          // Surface cached values if the API is briefly unavailable; the session
          // validation effect will clear invalid tokens separately.
        }
      }

      setHoldings([...portfolioStore.getHoldings()])
      setTrades(portfolioStore.getTrades().slice(0, 5))
      setWallet([...portfolioStore.getWallet()])
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
      setLastUpdated(new Date())
    } catch (error) {
      const msg = 'Failed to fetch market data. Using cached data.'
      setApiError(msg)
      if (!silent) toast.error(msg)
      console.error('Dashboard fetch error:', error)
    } finally {
      if (!silent) setLoading(false)
      setIsRefreshing(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void fetchData()
    const marketInterval = setInterval(() => { void fetchData(true) }, 10000)
    const fastTick = setInterval(() => {
      setHoldings([...portfolioStore.getHoldings()])
      setWallet([...portfolioStore.getWallet()])
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
      setLastUpdated(new Date())
    }, 1000)
    const refresh = () => {
      setHoldings([...portfolioStore.getHoldings()])
      setTrades(portfolioStore.getTrades().slice(0, 5))
      setWallet([...portfolioStore.getWallet()])
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
    }
    window.addEventListener('verdexis:portfolio', refresh)
    return () => {
      clearInterval(marketInterval)
      clearInterval(fastTick)
      window.removeEventListener('verdexis:portfolio', refresh)
    }
  }, [fetchData])

  useEffect(() => {
    const unsubscribe = realTimePrice.onPortfolioValueChange(() => {
      setHoldings([...portfolioStore.getHoldings()])
      setTrades(portfolioStore.getTrades().slice(0, 5))
      setWallet([...portfolioStore.getWallet()])
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
      setLastUpdated(new Date())
    })
    return unsubscribe
  }, [])

  // Live price ticker -> mark portfolio to market on every price change so
  // the displayed totals (value, P&L, allocation) update sub-second instead
  // of being frozen between the 30s CoinGecko refreshes. We feed the price
  // back into markToMarket under BOTH the holding id (lowercase symbol) and
  // the canonical coingecko id so wallet-value cache + holdings stay in sync.
  const holdingKey = holdings.map((h) => `${h.id}|${h.symbol}`).join(',')
  useEffect(() => {
    if (!holdingKey) return
    const entries = holdingKey.split(',').map((p) => {
      const [id, symbol] = p.split('|')
      return { id, symbol }
    })
    const unsubs = entries.map(({ id, symbol }) => liveTicker.subscribe(symbol || id, (price) => {
      const quotes: Record<string, number> = {}
      if (id) quotes[id] = price
      if (symbol) {
        quotes[symbol] = price
        quotes[symbol.toLowerCase()] = price
        quotes[symbol.toUpperCase()] = price
      }
      portfolioStore.markToMarket(quotes)
    }))
    return () => unsubs.forEach((u) => u())
  }, [holdingKey])

  // Also subscribe to every non-USD wallet currency so the wallet value (and
  // therefore Total Net Worth) tracks the market in real time, not just when
  // a holding for the same asset happens to exist.
  const walletKey = wallet.map((w) => w.currency).filter((c) => c && c !== 'USD' && c !== 'USDC' && c !== 'USDT').join(',')
  useEffect(() => {
    if (!walletKey) return
    const currencies = walletKey.split(',')
    const unsubs = currencies.map((cur) => liveTicker.subscribe(cur, (price) => {
      portfolioStore.markToMarket({ [cur.toLowerCase()]: price, [cur.toUpperCase()]: price })
    }))
    return () => unsubs.forEach((u) => u())
  }, [walletKey])

  // Watch dashboard layout changes (widget show/hide)
  useEffect(() => {
    const refresh = () => setHiddenWidgets(dashboardLayout.hidden())
    window.addEventListener(DASHBOARD_LAYOUT_EVENT, refresh)
    return () => window.removeEventListener(DASHBOARD_LAYOUT_EVENT, refresh)
  }, [])

  // DCA scheduler — checks once a minute; when an active schedule is
  // overdue, simulates the buy at the current market price (using cached
  // cryptoData) so it shows up in trades + holdings just like a real one.
  useEffect(() => {
    if (!isAuthenticated) return
    const tick = () => {
      const now = Date.now()
      for (const s of dcaStore.list()) {
        if (!s.active) continue
        if (now < nextRunMs(s)) continue
        const quote = cryptoData.find((c) => c.id === s.assetId || c.symbol.toUpperCase() === s.asset)
        if (!quote || quote.current_price <= 0) continue
        const qty = s.amountUsd / quote.current_price
        // Deterministic key: same schedule + same scheduled run-slot will
        // ALWAYS produce the same idempotency key, so even if the tab
        // reloads or the timer double-fires we never DCA twice for one slot.
        const slot = nextRunMs(s)
        const dcaKey = `dca-${s.id}-${slot}`.replace(/[^A-Za-z0-9_\-:.]/g, '-').slice(0, 128)
        portfolioStore.executeTrade(s.asset, s.name, 'buy', quote.current_price, qty, 'dca', dcaKey.length >= 8 ? dcaKey : `dca-${slot}-${s.id.padStart(8, '0')}`)
        dcaStore.markRun(s.id)
        toast.success(`Auto-bought ${qty.toFixed(6)} ${s.asset} ($${s.amountUsd})`)
      }
    }
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [cryptoData, isAuthenticated])

  // Portfolio calculations.
  // `positionsValue` = market value of holdings only — used for chart scaling
  // and category-allocation breakdowns (where cash would skew the percentages).
  // `walletValueUsd` = wallet cash + crypto wallet balances valued at the same
  // live quotes the holdings use.
  // `totalValue` (a.k.a. Net Worth) = positions + wallet, so the dashboard's
  // headline number matches the Wallet page's Total Balance + Holdings value.
  const positionsValue = holdings.reduce((sum, h) => sum + h.value, 0)
  // Recompute every render: the wallet event listener already triggers re-renders.
  // void wallet/transactions deps to keep React happy without storing the helper output in state.
  void wallet; void transactions
  const walletValueUsd = portfolioStore.getWalletValueUsd()
  const totalValue = positionsValue + walletValueUsd
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0)
  const dayChangePercent = positionsValue > 0 ? (totalPnl / positionsValue) * 100 : 0
  const bestPerformer = holdings.length > 0
    ? holdings.reduce((best, h) => (h.pnlPercent > best.pnlPercent ? h : best), holdings[0])
    : null

  // Real net-worth history reconstructed from each holding's hourly
  // sparkline (CoinGecko sparkline_in_7d, ~168 hourly points) weighted by
  // the user's actual current quantity. The chart-range picker windows the
  // resulting series to 1D / 1W / 1M / 1Y / ALL — for ranges longer than
  // the available 7-day window, the early portion is approximated using
  // the holding's avg-buy price as a stable anchor.
  const quoteById: Record<string, CryptoQuote> = {}
  for (const c of cryptoData) {
    quoteById[c.id] = c
    if (c.symbol) quoteById[c.symbol.toLowerCase()] = c
  }
  const rangeBuckets: Record<ChartRange, number> = { '1D': 24, '1W': 168, '1M': 168, '1Y': 365, 'ALL': 365 }
  const HISTORY_POINTS = rangeBuckets[chartRange]
  // Reconstruct net worth over time from the user's actual transaction
  // history (deposits / withdrawals). Without this the chart treats the
  // user as having held their CURRENT balance for the entire window, so
  // "ALL" would falsely show $X back when the account didn't even exist.
  const allTxs: WalletTransaction[] = portfolioStore.getTransactions()
  const STABLE_C = new Set(['USD', 'USDC', 'USDT'])
  // Treat anything that visibly says "fee" / "withdraw" / "charge" /
  // "deduction" as an outflow even if the type wasn't explicitly set
  // to 'withdraw' (admin entries, reimbursements, etc.). This way the
  // chart line actually dips when fees are paid instead of looking
  // like a smooth always-up cumulative-deposit curve.
  // IMPORTANT: Include both completed AND pending transactions so deposits
  // show up on the chart immediately (pending will be credited once approved).
  const OUTFLOW_RE = /\b(fee|fees|withdraw|charge|deduction|debit|gas|network)\b/i
  const txUsdValue = (t: WalletTransaction): number => {
    const cur = (t.currency || '').toUpperCase()
    let usd: number
    if (STABLE_C.has(cur)) {
      usd = t.amount
    } else {
      const q = quoteById[cur.toLowerCase()] || quoteById[cur]
      const px = portfolioStore.getQuote(cur) ?? q?.current_price ?? 0
      usd = t.amount * px
    }
    const isOutflow = t.type === 'withdraw' || OUTFLOW_RE.test(t.description || '')
    const sign = isOutflow ? -1 : 1
    return sign * usd
  }
  const inceptionMs = allTxs.length > 0
    ? Math.min(...allTxs.map((t) => new Date(t.timestamp).getTime()))
    : Date.now() - 7 * 24 * 3_600_000
  const nowMs = Date.now()
  const chartStartMs: number = (() => {
    switch (chartRange) {
      case '1D':  return nowMs - 24 * 3_600_000
      case '1W':  return nowMs - 7 * 24 * 3_600_000
      case '1M':  return nowMs - 30 * 24 * 3_600_000
      case '1Y':  return nowMs - 365 * 24 * 3_600_000
      case 'ALL': return Math.max(inceptionMs, nowMs - 5 * 365 * 24 * 3_600_000)
    }
  })()
  const portfolioHistory: number[] = (() => {
    // For longer ranges (1M / 1Y / ALL), drive the curve from the actual
    // cumulative deposit history so the chart starts at $0 at inception
    // and ramps up as deposits accrue, then anchor the right edge to the
    // live total so the tail always matches the headline number.
    if (chartRange === '1M' || chartRange === '1Y' || chartRange === 'ALL') {
      const N = HISTORY_POINTS
      const series2 = new Array(N).fill(0)
      const sorted = [...allTxs]
        .filter((t) => !(t.type === 'deposit' && t.status === 'pending'))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const span = Math.max(1, nowMs - chartStartMs)
      for (let i = 0; i < N; i++) {
        const tBucket = chartStartMs + (span * (i / Math.max(1, N - 1)))
        let cum = 0
        for (const tx of sorted) {
          if (new Date(tx.timestamp).getTime() <= tBucket) cum += txUsdValue(tx)
          else break
        }
        // Allow negative dips (fees / withdrawals) to render honestly.
        series2[i] = cum
      }
      const last = series2[N - 1]
      // Anchor the right edge to the live total via an ADDITIVE tail
      // blend (delta ramped 0 -> 1 across the window) instead of a
      // multiplicative rescale. Multiplicative rescaling would hide
      // every fee dip by stretching the whole series proportionally;
      // additive blend preserves the shape of historical fees while
      // still landing exactly on the headline number.
      if (totalValue > 0 || last !== 0) {
        const delta = totalValue - last
        for (let i = 0; i < N; i++) {
          const t = i / Math.max(1, N - 1)
          series2[i] += delta * t
        }
      }
      // Final clamp so we never display a negative net worth.
      for (let i = 0; i < N; i++) series2[i] = Math.max(0, series2[i])
      // If the curve ended up perfectly flat at 0 but we have a balance
      // (no transaction history — e.g. legacy users), ramp linearly so
      // the chart isn't a dead horizontal line at the bottom.
      if (series2.every((v) => v === 0) && totalValue > 0) {
        for (let i = 0; i < N; i++) series2[i] = totalValue * (i / Math.max(1, N - 1))
      }
      return series2
    }
    const series = new Array(HISTORY_POINTS).fill(0)
    let haveSparkline = false
    for (const h of holdings) {
      const q = quoteById[h.id] || quoteById[h.symbol?.toLowerCase?.() || '']
      const sp = q?.sparkline_in_7d?.price
      if (sp && sp.length >= 2) {
        haveSparkline = true
        // 1D uses last ~24 points; 1W uses the full sparkline (~168 hourly).
        // (1M / 1Y / ALL are handled above via deposit history and never
        // reach this branch.)
        const window = chartRange === '1D' ? sp.slice(-24) : sp
        for (let i = 0; i < HISTORY_POINTS; i++) {
          const idx = Math.min(window.length - 1, Math.round((i / (HISTORY_POINTS - 1)) * (window.length - 1)))
          series[i] += h.quantity * window[idx]
        }
      } else {
        // Flat contribution (cash, stablecoin, or sparkline not yet loaded).
        const flat = h.value || h.quantity * h.currentPrice
        for (let i = 0; i < HISTORY_POINTS; i++) series[i] += flat
      }
    }
    // Fall-through for cash-only or fully-empty portfolios — show a flat
    // baseline at current net worth instead of a blank canvas.
    if (!haveSparkline && positionsValue === 0 && walletValueUsd > 0) {
      for (let i = 0; i < HISTORY_POINTS; i++) series[i] = walletValueUsd
      return series
    }
    if (!haveSparkline && totalValue > 0) {
      for (let i = 0; i < HISTORY_POINTS; i++) series[i] = totalValue
      return series
    }
    if (!haveSparkline) return []
    // Anchor the most recent point so the chart scale agrees with positions.
    const last = series[series.length - 1]
    if (last > 0 && positionsValue > 0) {
      const scale = positionsValue / last
      for (let i = 0; i < series.length; i++) series[i] *= scale
    }
    // Add wallet entries: stablecoins / USD lift the curve flat, but
    // crypto wallet balances (BTC, ETH, SOL, …) follow their own
    // sparkline so the chart actually moves for users whose value lives
    // in the wallet rather than in formal "holdings".
    const STABLE = new Set(['USD', 'USDC', 'USDT'])
    let walletStableUsd = 0
    for (const w of wallet) {
      const cur = (w.currency || '').toUpperCase()
      if (!w.balance || w.balance <= 0) continue
      if (STABLE.has(cur)) {
        walletStableUsd += w.balance
        continue
      }
      const q = quoteById[cur.toLowerCase()] || quoteById[cur]
      const sp = q?.sparkline_in_7d?.price
      const livePrice = portfolioStore.getQuote(cur) ?? q?.current_price ?? 0
      if (sp && sp.length >= 2) {
        haveSparkline = true
        const window = chartRange === '1D' ? sp.slice(-24) : sp
        for (let i = 0; i < HISTORY_POINTS; i++) {
          const idx = Math.min(window.length - 1, Math.round((i / (HISTORY_POINTS - 1)) * (window.length - 1)))
          series[i] += w.balance * window[idx]
        }
      } else if (livePrice > 0) {
        const flat = w.balance * livePrice
        for (let i = 0; i < HISTORY_POINTS; i++) series[i] += flat
      }
    }
    if (walletStableUsd > 0) {
      for (let i = 0; i < series.length; i++) series[i] += walletStableUsd
    }
    // Anchor the most recent point to the live totalValue so the chart's
    // right edge ticks in lockstep with the headline number on every
    // mark-to-market update / live price tick (otherwise the tail is
    // pinned to whatever stale hourly sparkline value CoinGecko returned).
    if (totalValue > 0 && series[series.length - 1] > 0) {
      const scale = totalValue / series[series.length - 1]
      // Blend toward the live anchor so we don't yank the entire history.
      for (let i = 0; i < series.length; i++) {
        const t = i / Math.max(1, series.length - 1) // 0 -> 1 across window
        series[i] *= 1 + (scale - 1) * t
      }
    }
    // Light moving-average smoothing (window = 5) to remove hourly noise.
    const W = 5
    const smoothed = series.map((_, i) => {
      const lo = Math.max(0, i - Math.floor(W / 2))
      const hi = Math.min(series.length - 1, i + Math.floor(W / 2))
      let sum = 0
      for (let j = lo; j <= hi; j++) sum += series[j]
      return sum / (hi - lo + 1)
    })
    smoothed[0] = series[0]
    smoothed[smoothed.length - 1] = series[series.length - 1]
    return smoothed
  })()
  // Find the first non-zero value so % return is measured from the user's
  // actual inception point rather than from a leading-zero pre-deposit
  // segment (which would otherwise force the % to 0.00 for any window
  // wider than the user's own history — 1M / 1Y / ALL on new accounts).
  const firstNonZeroIdx = portfolioHistory.findIndex((v) => v > 0)
  const baseline = firstNonZeroIdx >= 0 ? portfolioHistory[firstNonZeroIdx] : 0
  const tail = portfolioHistory.length > 0 ? portfolioHistory[portfolioHistory.length - 1] : 0
  const periodChange = baseline > 0 ? tail - baseline : 0
  const periodChangePercent = baseline > 0 ? (periodChange / baseline) * 100 : 0

  const openLogin = () => { setAuthMode('login'); setAuthOpen(true) }
  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true) }
  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchData()
  }

  const mobileNavItems = [
    { label: 'Home', path: '/dashboard', icon: BarChart3 },
    { label: 'Markets', path: '/markets', icon: Activity },
    { label: 'Trade', path: '/trading', icon: ArrowUpRight },
    { label: 'Wallet', path: '/wallet', icon: Wallet },
    { label: 'AI', path: '/ai', icon: BrainCircuit },
  ]

  const hasDepositActivity = transactions.some((tx) => tx.type === 'deposit' || tx.type === 'interest' || tx.type === 'dividend') || wallet.some((w) => (w.balance || 0) > 0 && ['USD', 'USDC', 'USDT'].includes(w.currency.toUpperCase()))
  const hasTradeActivity = trades.length > 0 || holdings.some((h) => h.id !== 'usd')
  const hasAlertActivity = insights.some((insight) => insight.type === 'alert')
  const onboardingSteps = [
    { label: 'Fund your account', done: hasDepositActivity, hint: 'Deposit cash or crypto', to: '/wallet?action=deposit' },
    { label: 'Make your first trade', done: hasTradeActivity, hint: 'Open the markets and place an order', to: '/trading' },
    { label: 'Set alerts', done: hasAlertActivity, hint: 'Stay ahead of market moves', to: '/alerts' },
  ]
  const completedSteps = onboardingSteps.filter((step) => step.done).length

  const mobileQuickActions = [
    { label: 'Deposit', path: '/wallet?action=deposit', icon: ArrowDownRight, color: '#0C8B44' },
    { label: 'Trade', path: '/trading', icon: BarChart3, color: '#FF9800' },
    { label: 'Transfer', path: '/wallet?action=transfer', icon: ArrowRight, color: '#00838F' },
    { label: 'Activity', path: '/activity', icon: History, color: '#5C6BC0' },
  ]

  // DEV diagnostic: detect duplicate React keys in common mapped lists
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    const detect = (name: string, keys: Array<string | number | undefined>) => {
      const freq: Record<string, number> = {}
      for (const k of keys) {
        const s = String(k)
        freq[s] = (freq[s] || 0) + 1
      }
      const dups = Object.entries(freq).filter(([, v]) => v > 1)
      if (dups.length > 0) {
        console.error(`duplicate-keys-detected: ${name}`, dups.slice(0,5))
      }
    }

    try {
      detect('mobileQuickActions', mobileQuickActions.map((a) => a.label))
      detect('mobileNavItems', mobileNavItems.map((i) => i.path))
      detect('quickActions', (isAdminRole ? [
        'Users','Transfer','Deposits','Broadcast','Audit','Settings'
      ] : [
        'Deposit','Withdraw','Trade','Transfer','Convert','Activity'
      ]))
      detect('holdings', holdings.map((h, i) => `${h.id}-${i}`))
      detect('holdings-legend', holdings.map((h, i) => `${h.id}-${i}`))
      detect('trades', trades.map((t) => t.id))
      detect('wallet', wallet.map((w) => w.currency))
      detect('cryptoData', cryptoData.slice(0,6).map((c) => c.id))
      detect('insights', insights.slice(0,2).map((ins, i) => `dash-card-${i}`))
    } catch (e) {
      // best-effort only
    }
    // Expose a dev helper to programmatically get duplicate-key findings
    try {
      ;(window as any).__runDupDetect = () => {
        const results: Record<string, Array<[string, number]>> = {}
        const check = (name: string, keys: Array<string | number | undefined>) => {
          const freq: Record<string, number> = {}
          for (const k of keys) {
            const s = String(k)
            freq[s] = (freq[s] || 0) + 1
          }
          const dups = Object.entries(freq).filter(([, v]) => v > 1) as Array<[string, number]>
          if (dups.length > 0) results[name] = dups
        }
        try {
          check('mobileQuickActions', mobileQuickActions.map((a) => a.label))
          check('mobileNavItems', mobileNavItems.map((i) => i.path))
          check('quickActions', (isAdminRole ? [
            'Users','Transfer','Deposits','Broadcast','Audit','Settings'
          ] : [
            'Deposit','Withdraw','Trade','Transfer','Convert','Activity'
          ]))
          check('holdings', holdings.map((h, i) => `${h.id}-${i}`))
          check('holdings-legend', holdings.map((h, i) => `${h.id}-${i}`))
          check('trades', trades.map((t) => t.id))
          check('wallet', wallet.map((w) => w.currency))
          check('cryptoData', cryptoData.slice(0,6).map((c) => c.id))
          check('insights', insights.slice(0,2).map((ins, i) => `dash-card-${i}`))
        } catch (e) {
          // ignore
        }
        return results
      }
    } catch (e) {
      // noop
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E] overflow-x-hidden">
      <Toaster position="top-right" theme="dark" />
      <Navigation />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />

      <div className="pt-20 sm:pt-24 pb-36 sm:pb-20 px-3 sm:px-6 lg:px-8">
        <div className="max-w-[1280px] mx-auto w-full">
          {/* API Error Banner */}
          {apiError && (
            <div className="mb-4 p-4 rounded-xl bg-[#f44336]/10 border border-[#f44336]/30 flex items-start gap-3" role="alert" aria-live="polite">
              <WifiOff className="w-5 h-5 text-[#f44336] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-[#E5E5E5] font-medium">Connection Issue</p>
                <p className="text-xs text-[#A0A0A0] mt-1">{apiError}</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 text-xs bg-[#f44336] text-white rounded-lg hover:bg-[#d32f2f] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                aria-label="Retry connection"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
          )}

          {/* Header — greeting + toolbar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-2">
            <GreetingHeader name={userName} lastUpdated={lastUpdated} roleLabel={roleLabel} verified={verified} />
            {isAuthenticated && !isAdminRole && (
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 lg:overflow-visible lg:mx-0 lg:px-0">
                <CurrencySelector />
                <DensityToggle />
                <ExportMenu />
                <CustomizeWidgets />
              </div>
            )}
          </div>

          {/* Inline admin tools — visible only when the server confirms admin role. */}
          {isAuthenticated && isAdminRole && (
            <>
              <div className="mb-3 rounded-xl border border-[#0C8B44]/20 bg-[#0C8B44]/5 px-4 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#00E676]">Admin Command Center</p>
                <p className="text-xs text-[#8EA39B]">All admin operations are consolidated here under Dashboard.</p>
              </div>
              <AdminQuickPanel />
              <div className="mb-8 rounded-3xl border border-[#ffffff10] bg-[#0f1619]/50 p-6">
                <h2 className="text-sm font-semibold text-[#E5E5E5] mb-4">Admin Overview</h2>
                <AdminDashboardCharts />
              </div>
              <div className="mb-8 rounded-3xl border border-[#ffffff10] bg-[#0f1619]/40 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#A0A0A0]">Administration</p>
                    <h2 className="text-lg font-medium text-[#E5E5E5] mt-1">Settings are managed in a dedicated control page</h2>
                  </div>
                  <Link to="/admin/settings" className="inline-flex items-center gap-2 rounded-lg border border-[#0C8B44]/30 bg-[#0C8B44]/10 px-3 py-2 text-xs text-[#0C8B44] hover:bg-[#0C8B44]/20 transition-colors">
                    Open settings
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* Total Net Worth — reorganized into a clearer command-center layout with summary cards and quick context panels. */}
          <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr] mb-8">
            <div className="liquid-card hero-sweep dash-pad-card p-4 sm:p-8 relative overflow-hidden" style={{ '--fill-color': 'rgba(12,139,68,0.12)' } as React.CSSProperties}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-[#0C8B44]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#A0A0A0]">{isAuthenticated ? 'Total Net Worth' : 'Portfolio Value'}</p>
                    <p className="text-xs text-[#737373]">{isAuthenticated ? 'Across all wallets' : 'Log in to view your data'}</p>
                  </div>
                </div>
                {isAuthenticated && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowNetWorth((v) => !v)}
                      aria-label={showNetWorth ? 'Hide net worth' : 'Show net worth'}
                      className="w-9 h-9 rounded-full border border-[#ffffff10] bg-[#1a1a1a]/60 hover:border-[#0C8B44]/40 hover:text-[#0C8B44] text-[#A0A0A0] transition-colors flex items-center justify-center"
                    >
                      {showNetWorth ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <div className="text-right">
                      <p className={`text-sm flex items-center gap-1 justify-end ${periodChangePercent >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                        {periodChangePercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {periodChangePercent >= 0 ? '+' : ''}{periodChangePercent.toFixed(2)}% <span className="text-[#737373]">past {rangeLabel(chartRange).toLowerCase()}</span>
                      </p>
                      <p className={`text-xs ${periodChange >= 0 ? 'text-[#4CAF50]/80' : 'text-[#f44336]/80'}`}>
                        {fmtMoney(periodChange, { sign: true })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {isAuthenticated ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <TimeRangePicker value={chartRange} onChange={setChartRange} />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowBenchmark((v) => !v)}
                        className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${showBenchmark ? 'bg-[#FF9800]/15 text-[#FF9800] border-[#FF9800]/30' : 'text-[#737373] border-[#ffffff10] hover:text-[#E5E5E5]'}`}
                        aria-label="Toggle Bitcoin benchmark comparison"
                        aria-pressed={showBenchmark}
                      >
                        vs BTC
                      </button>
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        className="p-1.5 rounded-full border border-[#ffffff10] text-[#737373] hover:text-[#0C8B44] hover:border-[#0C8B44]/30 transition-colors disabled:opacity-50"
                        aria-label="Refresh data"
                        title="Refresh market data"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="w-full mb-6" role="img" aria-label={`Net worth chart showing ${periodChangePercent >= 0 ? 'positive' : 'negative'} ${Math.abs(periodChangePercent).toFixed(2)}% change over ${rangeLabel(chartRange)}`}>
                    {portfolioHistory.length >= 2 ? (
                      <NetWorthChart
                        series={portfolioHistory}
                        benchmark={(() => {
                          if (!showBenchmark) return null
                          const btcSp = quoteById['bitcoin']?.sparkline_in_7d?.price
                          if (!btcSp || btcSp.length < 2) return null
                          const btcStart = btcSp[0]
                          const points = portfolioHistory.length
                          const anchorIdx = portfolioHistory.findIndex((v) => v > 0)
                          const baseStart = anchorIdx >= 0 ? portfolioHistory[anchorIdx] : 0
                          if (!btcStart || baseStart <= 0) return null
                          const out: number[] = []
                          for (let i = 0; i < points; i++) {
                            const idx = Math.min(btcSp.length - 1, Math.round((i / (points - 1)) * (btcSp.length - 1)))
                            out.push((btcSp[idx] / btcStart) * baseStart)
                          }
                          return out
                        })()}
                        range={chartRange}
                        isUp={periodChangePercent >= 0}
                        startMs={chartStartMs}
                        height={260}
                      />
                    ) : (
                      <div className="h-56 w-full flex items-center justify-center text-xs text-[#737373]" role="status" aria-live="polite">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
                          <span>Loading market history…</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#737373] mt-2 mb-6">
                    <span>{chartRange === '1D' ? '24h ago' : chartRange === '1W' ? '7 days ago' : chartRange === '1M' ? '30 days ago' : chartRange === '1Y' ? '1 year ago' : 'All time'}</span>
                    <span>Now</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 mb-6">
                    {[
                        {
                          label: 'Net Worth',
                          value: showNetWorth ? fmtMoney(totalValue) : maskMoney(fmtMoney(totalValue)),
                          detail: 'Live balance',
                        },
                        {
                          label: 'Today',
                          value: fmtMoney(totalPnl, { sign: true }),
                          detail: 'Unrealized P&L (all-time)',
                        },
                        {
                          label: 'Cash (wallet)',
                          value: showNetWorth ? fmtMoney(walletValueUsd) : maskMoney(fmtMoney(walletValueUsd)),
                          detail: 'Available liquidity',
                        },
                      ].map((item, i) => (
                        <div key={`${item.label}-${i}`} className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#737373]">
                            {item.label}
                            {item.label === 'Cash (wallet)' && (
                              <span title="Includes cash and stablecoins; buys consume USD from your wallet" className="ml-1 text-xs text-[#737373]">?</span>
                            )}
                          </p>
                          <p className={`mt-1 text-sm font-medium tabular-nums truncate ${item.label === 'Cash (wallet)' ? (walletValueUsd >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]') : 'text-[#E5E5E5]'}`}>{item.value}</p>
                          <p className="text-[11px] text-[#8EA39B]">{item.detail}</p>
                        </div>
                      ))}
                  </div>

                  {transactions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-[#ffffff08]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[#E5E5E5]">Recent Activity</h4>
                        <Link to="/activity" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">View all</Link>
                      </div>
                      <div className="space-y-1">
                        {transactions.slice(0, 5).map((tx, i) => {
                          const isFiat = tx.currency === 'USD' || tx.currency === 'USDC' || tx.currency === 'USDT'
                          const fmtAmt = Math.abs(tx.amount).toLocaleString(undefined, {
                            minimumFractionDigits: isFiat ? 2 : 0,
                            maximumFractionDigits: isFiat ? 2 : 8,
                          })
                          const sign = tx.amount >= 0 ? '+' : '-'
                          const when = relativeTimeShort(new Date(tx.timestamp))
                          const isPending = tx.status === 'pending'
                            return (
                            <Link key={`${tx.id}-${i}`} to={`/activity?tx=${encodeURIComponent(tx.id)}`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 -mx-2 px-2 rounded-lg hover:bg-[#ffffff05] transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] leading-none shrink-0 ${tx.type === 'deposit' || tx.type === 'dividend' || tx.type === 'interest' ? 'bg-[#4CAF50]/15 text-[#4CAF50]' : tx.type === 'withdraw' ? 'bg-[#f44336]/15 text-[#f44336]' : 'bg-[#FF9800]/15 text-[#FF9800]'}`}>
                                  {tx.type === 'deposit' || tx.type === 'dividend' || tx.type === 'interest' ? '↓' : tx.type === 'withdraw' ? '↑' : '↔'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-[#E5E5E5] truncate">{tx.description}</p>
                                  <p className="text-[11px] text-[#737373] flex items-center gap-1.5 truncate">
                                    <span className="capitalize">{tx.type}</span>
                                    <span>·</span>
                                    <span>{when}</span>
                                    {isPending && (
                                      <>
                                        <span>·</span>
                                        <span className="text-[#FF9800]">Pending</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <p className={`text-sm tabular-nums ${tx.amount >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                                  {sign}{fmtAmt} {tx.currency}
                                </p>
                                <p className="text-[10px] text-[#737373] uppercase tracking-[0.04em]">
                                  {tx.amount >= 0 ? 'Credit' : 'Debit'}
                                </p>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mb-4">
                    <Lock className="w-7 h-7 text-[#0C8B44]" />
                  </div>
                  <p className="text-[#A0A0A0] mb-2">Your portfolio data is private</p>
                  <p className="text-xs text-[#737373] mb-6">Log in to view your net worth, holdings, and performance</p>
                  <div className="flex items-center gap-3">
                    <button onClick={openLogin} className="px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                      Log In
                    </button>
                    <button onClick={openSignup} className="px-5 py-2.5 text-[#A0A0A0] text-sm font-medium border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#E5E5E5] transition-colors">
                      Sign Up
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="liquid-card p-5" style={{ '--fill-color': 'rgba(33,150,243,0.1)' } as React.CSSProperties}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#E5E5E5]">Allocation</h3>
                  <Link to="/trading" className="text-xs text-[#0C8B44] hover:text-[#00E676]">Rebalance</Link>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Cash', value: showNetWorth ? fmtMoney(walletValueUsd) : maskMoney(fmtMoney(walletValueUsd)) },
                    { label: 'Top holding', value: holdings[0] ? `${holdings[0].symbol}` : 'N/A' },
                    { label: 'Assets', value: `${holdings.filter((h) => h.id !== 'usd').length}` },
                  ].map((item, i) => (
                    <div key={`${item.label}-${i}`} className="flex items-center justify-between rounded-xl bg-[#0f1619]/60 px-3 py-2">
                      <span className="text-sm text-[#A0A0A0]">{item.label}</span>
                      <span className="text-sm font-medium text-[#E5E5E5] tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="liquid-card p-5" style={{ '--fill-color': 'rgba(255,152,0,0.1)' } as React.CSSProperties}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-[#E5E5E5]">Live signals</h3>
                  <Link to="/alerts" className="text-xs text-[#0C8B44] hover:text-[#00E676]">Manage</Link>
                </div>
                <div className="space-y-2 text-sm text-[#DCE7FF]">
                  <div className="rounded-xl bg-[#0f1619]/60 px-3 py-2">• Momentum remains strong across your core growth positions.</div>
                  <div className="rounded-xl bg-[#0f1619]/60 px-3 py-2">• Watch for volatility around your largest position.</div>
                  <div className="rounded-xl bg-[#0f1619]/60 px-3 py-2">• AI model suggests preserving cash for near-term opportunities.</div>
                </div>
              </div>
            </div>
          </div>

          {/* User onboarding / next-step guide for authenticated users */}
          {isAuthenticated && !isAdminRole && (
            <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-4 sm:p-6 mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#737373]">Account setup</p>
                  <h3 className="text-base font-medium text-[#E5E5E5] mt-1">{completedSteps === onboardingSteps.length ? 'Your dashboard is ready to go' : 'A few quick wins to make this page more useful'}</h3>
                  <p className="text-sm text-[#A0A0A0] mt-1">Complete the essentials to turn this into a full portfolio command center.</p>
                </div>
                <div className="rounded-full border border-[#0C8B44]/20 bg-[#0C8B44]/10 px-3 py-1 text-xs font-medium text-[#0C8B44]">
                  {completedSteps}/{onboardingSteps.length} complete
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {onboardingSteps.map((step, i) => {
                  const Icon = step.done ? CheckCircle2 : CircleDashed
                  return (
                    <Link key={`${step.label}-${i}`} to={step.to} className="flex items-start gap-3 rounded-xl border border-[#ffffff05] bg-[#1a1a1a]/50 p-3 transition-colors hover:border-[#0C8B44]/30 hover:bg-[#0C8B44]/5">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${step.done ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'bg-[#ffffff08] text-[#A0A0A0]'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#E5E5E5]">{step.label}</p>
                        <p className="text-xs text-[#737373] mt-1">{step.hint}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty-state CTA — shown when authenticated but no real holdings */}
          {isAuthenticated && holdings.filter((h) => h.id !== 'usd').length === 0 && (
            <EmptyStateCta />
          )}

          {/* Top Movers strip — user-focused market widget (hidden for admins). */}
          {!isAdminRole && !hiddenWidgets.has('topMovers') && cryptoData.length > 0 && (
            <TopMovers data={cryptoData} />
          )}

          {/* Top Stats Row — deduped: 'Total Net Worth' lives in the hero
              card above, so this row covers the next three KPIs only.
              On mobile this becomes a horizontal snap-scroll strip so the
              three cards don't crowd; on >= sm it's a 3-column grid. */}
          {isAuthenticated && (() => {
            const stats = [
              { label: 'Unrealized P&L', value: fmtMoney(totalPnl, { sign: true }), change: 'All-time', positive: totalPnl >= 0, icon: TrendingUp, accent: totalPnl >= 0 ? '#4CAF50' : '#f44336' },
              { label: 'Best Performer', value: bestPerformer ? `${bestPerformer.pnlPercent >= 0 ? '+' : ''}${bestPerformer.pnlPercent.toFixed(1)}%` : 'N/A', change: bestPerformer ? bestPerformer.symbol : '', positive: (bestPerformer?.pnlPercent || 0) >= 0, icon: Gem, accent: '#FF9800' },
              { label: 'Total Holdings', value: `${holdings.length}`, change: `${holdings.filter(h => h.id !== 'usd').length} assets`, positive: true, icon: Layers, accent: '#2196F3' },
            ]
            return (
              <div className="-mx-1 sm:mx-0 px-1 sm:px-0 overflow-x-auto sm:overflow-visible no-scrollbar mb-8 dash-mb">
                <div className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-4 dash-gap snap-x snap-mandatory sm:snap-none dash-stagger">
                  {stats.map((stat, i) => (
                    <div key={`${stat.label}-${i}`} className="kpi-tile p-5 dash-pad-card rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] min-w-[16rem] sm:min-w-0 snap-start">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.accent}1f`, border: `1px solid ${stat.accent}33` }}>
                          <stat.icon className="w-4 h-4" style={{ color: stat.accent }} />
                        </div>
                        <span className="text-xs text-[#737373] truncate">{stat.label}</span>
                      </div>
                      <p className="text-lg md:text-xl font-light text-[#E5E5E5] tracking-[-0.02em] truncate tabular-nums">{stat.value}</p>
                      <p className={`text-xs mt-1 truncate ${stat.positive ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{stat.change}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Morning Brief + Portfolio Health — the new "command center" row */}
          {isAuthenticated && (
            <div className="flex items-center gap-3 mb-3 mt-2">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#737373]">Insights</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-[#ffffff10] to-transparent" />
            </div>
          )}

          {isAuthenticated && (() => {
            const health = computePortfolioHealth({
              holdings,
              wallet,
              market: cryptoData,
              netWorth: totalValue,
            })
            const showBrief = !hiddenWidgets.has('morningBrief')
            const showHealth = !hiddenWidgets.has('portfolioHealth')
            if (!showBrief && !showHealth) return null
            return (
              <div className={`grid grid-cols-1 ${showBrief && showHealth ? 'lg:grid-cols-2' : ''} gap-4 mb-6`}>
                {showBrief && (
                  <MorningBriefCard
                    holdings={holdings}
                    market={cryptoData}
                    netWorth={totalValue}
                    dayChangePercent={dayChangePercent}
                    health={health}
                    fmtMoney={fmtMoney}
                    userName={userName}
                  />
                )}
                {showHealth && (
                  <PortfolioHealthCard
                    holdings={holdings}
                    wallet={wallet}
                    market={cryptoData}
                    netWorth={totalValue}
                  />
                )}
              </div>
            )
          })()}

          {/* Trading Attribution - Today's Performance */}
          {isAuthenticated && !isAdminRole && (
            <div className="mb-6">
              <TradingAttribution />
            </div>
          )}

          {/* Performance Metrics — inspired by Wealthfolio analytics */}
          {isAuthenticated && (
            <div className="flex items-center gap-3 mb-3 mt-2">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#737373]">Performance</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-[#ffffff10] to-transparent" />
            </div>
          )}
          {isAuthenticated && (() => {
            // Restrict performance metrics to trades inside the active
            // chart range, so "Performance" actually mirrors the line on
            // the Net Worth chart instead of always showing all-time.
            const allTrades = portfolioStore.getTrades()
            const inWindow = (d: Date | string) => {
              const t = new Date(d).getTime()
              return t >= chartStartMs && t <= nowMs
            }
            const trades = allTrades.filter(t => inWindow(t.timestamp))
            const buys = trades.filter(t => t.side === 'buy')
            const sells = trades.filter(t => t.side === 'sell')
            const totalInvested = buys.reduce((s, t) => s + t.total, 0)
            // Avg cost is built from ALL prior buys (so sells inside the
            // window are matched against the user's true average cost,
            // not just the buys that happen to fall in the window).
            const avgCostBySymbol = new Map<string, { qty: number; cost: number }>()
            allTrades
              .filter(t => t.side === 'buy' && new Date(t.timestamp).getTime() <= nowMs)
              .forEach(b => {
                const cur = avgCostBySymbol.get(b.symbol) || { qty: 0, cost: 0 }
                cur.qty += b.quantity; cur.cost += b.total
                avgCostBySymbol.set(b.symbol, cur)
              })
            let realizedPnl = 0
            let wins = 0
            sells.forEach(s => {
              const stats = avgCostBySymbol.get(s.symbol)
              if (!stats || stats.qty === 0) return
              const avg = stats.cost / stats.qty
              const pnl = (s.price - avg) * s.quantity
              realizedPnl += pnl
              if (pnl > 0) wins++
            })
            const winRate = sells.length > 0 ? (wins / sells.length) * 100 : 0
            // Total Return for the active range = % change of the net-worth
            // curve we already built (periodChangePercent), so the metric
            // matches the chart 1:1.
            const totalReturnPct = periodChangePercent
            const periodLabel = rangeLabel(chartRange)
            return (
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-4 sm:p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#E5E5E5]">Performance Metrics</h3>
                  <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Past {periodLabel}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Period Return</p>
                    <p className={`text-xl font-light ${totalReturnPct >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Realized P&L</p>
                    <p className={`text-xl font-light ${realizedPnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{realizedPnl >= 0 ? '+' : ''}${Math.abs(realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Win Rate</p>
                    <p className="text-xl font-light text-[#E5E5E5]">{winRate.toFixed(0)}% <span className="text-xs text-[#737373]">({wins}/{sells.length})</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Trades · Invested</p>
                    <p className="text-xl font-light text-[#E5E5E5]">{trades.length} <span className="text-xs text-[#737373]">${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
                  </div>
                </div>
              </div>
            )
          })()}

          {isAuthenticated && (
            <div className="mb-6">
              <RiskMetricsCard />
            </div>
          )}

          {/* Quick Actions - Redesigned */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {(isAdminRole
              ? [
                  { label: 'Users', icon: Layers, path: '/admin/users', color: '#0C8B44' },
                  { label: 'Transfer', icon: ArrowRight, path: '/admin/transfer', color: '#00838F' },
                  { label: 'Deposits', icon: Wallet, path: '/admin/deposits', color: '#26A69A' },
                  { label: 'Broadcast', icon: AlertTriangle, path: '/admin/broadcast', color: '#F57C00' },
                  { label: 'Audit', icon: History, path: '/admin/audit', color: '#5C6BC0' },
                  { label: 'Settings', icon: SettingsIcon, path: '/settings', color: '#757575' },
                ]
              : [
                  { label: 'Deposit', icon: ArrowDownRight, path: '/wallet?action=deposit', color: '#0C8B44' },
                  { label: 'Withdraw', icon: ArrowUpRight, path: '/wallet?action=withdraw', color: '#f44336' },
                  { label: 'Trade', icon: BarChart3, path: '/trading', color: '#FF9800' },
                  { label: 'Transfer', icon: ArrowRight, path: '/wallet?action=transfer', color: '#00838F' },
                  { label: 'Convert', icon: Repeat, path: '/wallet?action=convert', color: '#26A69A' },
                  { label: 'Activity', icon: History, path: '/activity', color: '#5C6BC0' },
                ]).map((action, i) => (
              <Link key={`${action.label}-${i}`} to={action.path}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/5 transition-all group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${action.color}15` }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <span className="text-xs font-medium text-[#E5E5E5] text-center">{action.label}</span>
              </Link>
            ))}
          </div>


          {/* Portfolio Breakdown - Authenticated Only */}
          <div className="liquid-card p-6" style={{ '--fill-color': 'rgba(0,131,143,0.15)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00838F]/20 flex items-center justify-center">
                    <PieChart className="w-5 h-5 text-[#00838F]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#E5E5E5]">Portfolio Breakdown</h3>
                </div>
                {!isAdminRole ? (
                  <Link to="/trading" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">Rebalance</Link>
                ) : (
                  <Link to="/admin/users" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">Manage Users</Link>
                )}
              </div>

              {isAuthenticated ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
                  {/* Holdings List */}
                  <div className="space-y-2 sm:space-y-3">
                    {holdings.map((h, i) => (
                      <Link to={`/asset/${h.id}`} key={`${h.id}-${i}`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-[#ffffff05] transition-colors">
                        <div className="flex items-center gap-3">
                          {getCryptoLogo(h.symbol || h.id) ? (
                            <img
                              src={getCryptoLogo(h.symbol || h.id)!}
                              alt={h.name || h.symbol || h.id}
                              className="w-9 h-9 rounded-full object-cover"
                              onError={cryptoIconErrorFallback((h.symbol || h.id || '?')[0]?.toUpperCase() || '?', h.symbol || h.id)}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">
                              {(h.symbol || h.id || '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[#E5E5E5]">{h.name || h.symbol || h.id}</p>
                            <p className="text-xs text-[#737373]">
                              {formatCryptoAmount(h.quantity)} {h.symbol}
                              {h.avgBuyPrice > 0 && (
                                <span className="ml-1.5 text-[#555]">· avg ${h.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm text-[#E5E5E5]">{fmtMoney(h.value)}</p>
                          <p className={`text-xs ${h.pnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                            {fmtMoney(h.pnl, { sign: true })} ({h.pnlPercent.toFixed(2)}%)
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Donut Chart + Allocation */}
                  <div className="flex flex-col items-center">
                    <svg viewBox="0 0 120 120" className="w-36 h-36 mb-4">
                        {(() => {
                        let offset = 0
                        const colors = ['#0C8B44', '#2196F3', '#FF9800', '#9C27B0', '#737373', '#00BCD4']
                        return holdings.map((h, i) => {
                          const dash = h.allocation * 3.6
                          const gap = 360 - dash
                          const el = (
                            <circle
                              key={`${h.id}-${i}`}
                              cx="60"
                              cy="60"
                              r="50"
                              fill="none"
                              stroke={colors[i % colors.length]}
                              strokeWidth="14"
                              strokeDasharray={`${dash} ${gap}`}
                              strokeDashoffset={-offset}
                              transform="rotate(-90 60 60)"
                              strokeLinecap="round"
                            />
                          )
                          offset += dash
                          return el
                        })
                      })()}
                      <circle cx="60" cy="60" r="32" fill="#070C0E" />
                      <text x="60" y="58" textAnchor="middle" fill="#E5E5E5" fontSize="14" fontWeight="300">{holdings.length}</text>
                      <text x="60" y="70" textAnchor="middle" fill="#737373" fontSize="8">Assets</text>
                    </svg>
                    <div className="w-full space-y-2">
                      {holdings.map((h, i) => {
                        const colors = ['#0C8B44', '#2196F3', '#FF9800', '#9C27B0', '#737373', '#00BCD4']
                        return (
                          <div key={`${h.id}-${i}`} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                              <span className="text-xs text-[#A0A0A0]">{h.symbol}</span>
                            </div>
                            <span className="text-xs text-[#E5E5E5]">{h.allocation}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-[#A0A0A0] mb-4">Log in to see your portfolio allocation and holdings</p>
                  <button onClick={openLogin} className="px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                    Log In to View Portfolio
                  </button>
                </div>
              )}

              {/* Recent Trades */}
              {isAuthenticated && !isAdminRole && trades.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#ffffff08]">
                  <h4 className="text-sm font-medium text-[#E5E5E5] mb-3">Recent Trades</h4>
                  <div className="space-y-2">
                    {trades.map((t, i) => (
                      <div key={`${t.id}-${i}`} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${t.side === 'buy' ? 'bg-[#4CAF50]/20 text-[#4CAF50]' : 'bg-[#f44336]/20 text-[#f44336]'}`}>
                            {t.side === 'buy' ? '+' : '-'}
                          </div>
                          <span className="text-sm text-[#E5E5E5]">{t.symbol}</span>
                        </div>
                        <span className="text-xs text-[#A0A0A0]">{t.quantity.toFixed(4)} @ ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className={`text-xs ${t.side === 'buy' ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{t.side.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* Wallet Balances - Authenticated */}
          {isAuthenticated && (
            <div className="liquid-card p-4 sm:p-6" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-[#0C8B44]" />
                    </div>
                    <h3 className="text-lg font-medium text-[#E5E5E5]">Wallet</h3>
                  </div>
                  <Link to="/wallet" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">Manage</Link>
                </div>
                <div className="space-y-3">
                  {wallet.map((w, i) => {
                    const cur = w.currency.toUpperCase()
                    const isFiat = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(cur)
                    const inner = (
                      <>
                      <div className="flex items-center gap-3">
                        {getCryptoLogo(w.currency.toLowerCase()) ? (
                          <img
                            src={getCryptoLogo(w.currency.toLowerCase())!}
                            alt={w.currency}
                            className="w-7 h-7 rounded-full object-cover"
                            onError={cryptoIconErrorFallback(w.currency[0]?.toUpperCase() || '?', w.currency.toLowerCase())}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44]">{w.currency[0]}</div>
                        )}
                        <div>
                          <p className="text-sm text-[#E5E5E5]">{w.currency}</p>
                          <p className="text-xs text-[#737373]">Available</p>
                        </div>
                      </div>
                      <span className="text-sm text-[#E5E5E5]">{w.symbol}{w.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                      </>
                    )
                    if (isFiat) {
                      return (
                        <div key={`${w.currency}-${i}`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl bg-[#1a1a1a]/50">{inner}</div>
                      )
                    }
                    return (
                      <Link
                        key={`${w.currency}-${i}`}
                        to={`/asset/${w.currency.toLowerCase()}`}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl bg-[#1a1a1a]/50 hover:bg-[#1a1a1a]/80 hover:border-[#0C8B44]/30 border border-transparent transition-colors"
                      >
                        {inner}
                      </Link>
                    )
                  })}
                </div>
            </div>
          )}

          {/* AI Insights + Alerts + Goals - 3 Column Row */}
          {isAuthenticated && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* AI Insights */}
              <div className="liquid-card p-6" style={{ '--fill-color': 'rgba(106,13,173,0.15)' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-[#9C27B0]" />
                      </div>
                      <h3 className="text-sm font-medium text-[#E5E5E5]">AI Insights</h3>
                    </div>
                    <Link to="/ai" className="text-[10px] text-[#0C8B44] hover:text-[#00E676]">More</Link>
                  </div>
                  <div className="space-y-2">
                    {insights.slice(0, 2).map((insight, i) => (
                      <div key={`dash-card-${i}`} className="p-3 rounded-lg bg-[#1a1a1a]/50 border border-[#ffffff05]">
                        <div className="flex items-start gap-2">
                          {insight.type === 'recommendation' && <Sparkles className="w-3 h-3 text-[#0C8B44] mt-0.5 shrink-0" />}
                          {insight.type === 'alert' && <AlertTriangle className="w-3 h-3 text-[#F57C00] mt-0.5 shrink-0" />}
                          {insight.type === 'analysis' && <Zap className="w-3 h-3 text-[#2196F3] mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#E5E5E5] truncate">{insight.title}</p>
                            <p className="text-[10px] text-[#A0A0A0] mt-0.5 line-clamp-2">{insight.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              {/* Alerts Summary */}
              {!hiddenWidgets.has('alertsSummary') && (
                <AlertsSummaryCard />
              )}

              {/* Goals Progress */}
              {!isAdminRole && !hiddenWidgets.has('goalsProgress') && (
                <GoalsProgressCard portfolioValue={totalValue} />
              )}
            </div>
          )}

          {isAuthenticated && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {!hiddenWidgets.has('connectedAccounts') && <ConnectedAccountsCard />}
              {!hiddenWidgets.has('newsSnippet') && <NewsSnippetCard />}
            </div>
          )}

          {/* Category Breakdown */}
          {isAuthenticated && !hiddenWidgets.has('categoryBreakdown') && (
            <div className="mb-8">
              <CategoryBreakdownCard holdings={holdings} totalValue={positionsValue} />
            </div>
          )}

          {/* Staking + DCA + Watchlist - 3 Column Row */}
          {isAuthenticated && !isAdminRole && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {!hiddenWidgets.has('staking') && <StakingCard />}
              {!hiddenWidgets.has('dca') && <DcaCard />}
              {!hiddenWidgets.has('watchlist') && (
                <div id="watchlist" className="scroll-mt-24">
                  <WatchlistPanel
                    availableSymbols={cryptoData.slice(0, 10).map((c) => ({ symbol: (c.symbol || c.id || '').toUpperCase(), name: c.name || c.symbol || c.id }))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Market Overview */}
          {!isAdminRole && (
            <div className="liquid-card p-4 sm:p-6" style={{ '--fill-color': 'rgba(12,139,68,0.08)' } as React.CSSProperties}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-[#0C8B44]" />
                    </div>
                    <h3 className="text-lg font-medium text-[#E5E5E5]">Market Overview</h3>
                  </div>
                  <Link to="/markets" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">
                    Full Markets <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={`dash-skel-${i}`} className="p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-5 h-5 rounded-full" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-7 w-full" />
                      </div>
                    ))}
                  </div>
                ) : cryptoData.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
                    {cryptoData.slice(0, 6).map((crypto, i) => (
                      <LiveMarketCard key={`${crypto.id}-${i}`} crypto={crypto} fmtMoney={fmtMoney} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
                    <WifiOff className="w-12 h-12 text-[#737373] mb-3" />
                    <p className="text-sm text-[#A0A0A0] mb-2">Unable to load market data</p>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="px-4 py-2 text-xs bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Retry
                    </button>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="lg:hidden fixed inset-x-0 bottom-[5.2rem] z-40 px-3">
        <div className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-2 overflow-x-auto px-2 py-2 no-scrollbar">
            {mobileQuickActions.map((action, i) => {
              const Icon = action.icon
              return (
                <Link key={`${action.label}-${i}`} to={action.path} className="flex min-w-[5.4rem] flex-col items-center justify-center gap-1 rounded-xl border border-[#ffffff08] bg-[#1a1a1a]/60 px-2 py-2 text-[10px] font-medium uppercase tracking-[0.04em] text-[#E5E5E5]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${action.color}15` }}>
                    <Icon className="h-4 w-4" style={{ color: action.color }} />
                  </div>
                  <span>{action.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-[#ffffff10] bg-[#070C0E]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-2 px-2 py-2 sm:px-4">
          {mobileNavItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path || (item.path === '/dashboard' && location.pathname.startsWith('/dashboard'))
            return (
              <Link key={item.path} to={item.path} className={`flex min-w-[4.4rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium uppercase tracking-[0.04em] transition-colors ${active ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'text-[#A0A0A0] hover:text-[#E5E5E5]'}`}>
                <Icon className="h-4.5 w-4.5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
      <Footer />
    </div>
  )
}
