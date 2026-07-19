// aiBrain — heavy-lift analytics used by the AI assistant. Pure functions,
// no I/O, no React. Everything here is computed from data the app already
// has in memory (portfolioStore, marketData, goals, staking, dca, alerts)
// so answers stay snappy and offline-tolerant.
//
// The aiService routes a user's natural-language question to one of these
// helpers, formats the result with the active persona's voice, and returns
// a markdown-friendly string.

import type { CryptoQuote } from './marketData'
import type { PortfolioHolding, Trade, WalletTransaction, WalletBalance } from './portfolioStore'
import { dailyReturns, annualisedVolatility, sharpeRatio, maxDrawdown, valueAtRisk, mean, stdev } from './quant'

// ---------- formatting ----------

export function fmtUsd(n: number, opts: { dp?: number } = {}): string {
  const dp = opts.dp ?? (Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 2 : 4)
  if (!isFinite(n)) return '$0.00'
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
}

export function fmtPct(n: number, dp = 2): string {
  if (!isFinite(n)) return '0.00%'
  return `${n >= 0 ? '+' : ''}${n.toFixed(dp)}%`
}

export function fmtNum(n: number, dp = 4): string {
  if (!isFinite(n)) return '0'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp })
}

export function fmtBig(n: number): string {
  if (!isFinite(n) || n === 0) return '$0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

// ---------- symbol extraction ----------

// Pull out asset references the user mentioned in their query. Matches
// 1) coingecko ids ("bitcoin"), 2) tickers in caps ("BTC"), 3) common
// English names. Returns canonical CryptoQuote objects from the market list.
export function extractMentionedAssets(query: string, market: CryptoQuote[]): CryptoQuote[] {
  if (!query || market.length === 0) return []
  const q = query.toLowerCase()
  const found = new Map<string, CryptoQuote>()

  // Exact id / symbol / name match
  for (const m of market) {
    const id = (m.id || '').toLowerCase()
    const sym = (m.symbol || '').toLowerCase()
    const name = (m.name || '').toLowerCase()
    if (!id) continue
    // require word boundary so "doge" doesn't match "dogecoin"... actually it
    // *should* match dogecoin too. Use simple includes for ids/names.
    if (id && q.includes(id)) found.set(m.id, m)
    else if (name && q.includes(name)) found.set(m.id, m)
    else if (sym && new RegExp(`(^|[^a-z0-9])${sym}([^a-z0-9]|$)`, 'i').test(query)) found.set(m.id, m)
  }
  // Limit to first 4 matches, sorted by market cap desc
  return Array.from(found.values()).sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).slice(0, 4)
}

// ---------- sparkline indicators ----------

export interface TechSignals {
  trend: 'up' | 'down' | 'flat'
  trendStrength: number          // 0-100
  rsi: number                    // 0-100, >70 overbought, <30 oversold
  vol7d: number                  // annualised %
  drawdown7d: number             // worst peak-to-trough %
  sma_short: number
  sma_long: number
  smaCross: 'bullish' | 'bearish' | 'none'
  vsHigh: number                 // distance from 7d high (%)
  vsLow: number                  // distance from 7d low (%)
}

export interface TechSignals {
  trend: 'up' | 'down' | 'flat'
  trendStrength: number
  rsi: number
  vol7d: number
  drawdown7d: number
  sma_short: number
  sma_long: number
  smaCross: 'bullish' | 'bearish' | 'none'
  vsHigh: number
  vsLow: number
  macd: number
  macdSignal: number
  macdHistogram: number
  bbUpper: number
  bbMiddle: number
  bbLower: number
  bbWidth: number
  bbPosition: number   // 0=at lower band, 1=at upper band
}

export function computeSignals(spark: number[] | undefined): TechSignals | null {
  if (!spark || spark.length < 12) return null
  const prices = spark.filter((x) => typeof x === 'number' && isFinite(x) && x > 0)
  if (prices.length < 12) return null

  const last = prices[prices.length - 1]
  const first = prices[0]
  const high = Math.max(...prices)
  const low = Math.min(...prices)

  const rets = dailyReturns(prices)
  const vol = annualisedVolatility(rets, 24 * 7) * 100
  const dd = maxDrawdown(prices) * 100

  const shortLen = Math.max(4, Math.floor(prices.length / 4))
  const longLen  = prices.length
  const sma_short = mean(prices.slice(-shortLen))
  const sma_long  = mean(prices.slice(-longLen))
  const prevShort = mean(prices.slice(-shortLen - 1, -1))
  const prevLong  = mean(prices.slice(-longLen, -1))
  let smaCross: TechSignals['smaCross'] = 'none'
  if (prevShort <= prevLong && sma_short > sma_long) smaCross = 'bullish'
  else if (prevShort >= prevLong && sma_short < sma_long) smaCross = 'bearish'

  const rsi = computeRSI(prices, Math.min(14, Math.max(6, Math.floor(prices.length / 5))))

  // MACD: EMA(12) - EMA(26), signal EMA(9) of MACD
  const ema12 = computeEMA(prices, Math.min(12, Math.floor(prices.length / 3)))
  const ema26 = computeEMA(prices, Math.min(26, Math.floor(prices.length * 2 / 3)))
  const macdLine = ema12 - ema26
  // Build a short MACD series for the signal line
  const macdSeries: number[] = []
  const step = Math.max(1, Math.floor(prices.length / 20))
  for (let i = step; i <= prices.length; i += step) {
    const slice = prices.slice(0, i)
    macdSeries.push(computeEMA(slice, Math.min(12, Math.floor(slice.length / 3))) -
                    computeEMA(slice, Math.min(26, Math.floor(slice.length * 2 / 3))))
  }
  const macdSignal = macdSeries.length >= 3 ? computeEMA(macdSeries, Math.min(9, macdSeries.length)) : macdLine
  const macdHistogram = macdLine - macdSignal

  // Bollinger Bands: 20-period SMA ± 2σ
  const bbLen = Math.min(20, prices.length)
  const bbSlice = prices.slice(-bbLen)
  const bbMiddle = mean(bbSlice)
  const bbStd = stdev(bbSlice)
  const bbUpper = bbMiddle + 2 * bbStd
  const bbLower = bbMiddle - 2 * bbStd
  const bbWidth = bbStd > 0 ? ((bbUpper - bbLower) / bbMiddle) * 100 : 0
  const bbPosition = bbUpper > bbLower ? (last - bbLower) / (bbUpper - bbLower) : 0.5

  const totalChange = (last - first) / first
  const trend: TechSignals['trend'] = totalChange > 0.01 ? 'up' : totalChange < -0.01 ? 'down' : 'flat'
  const trendStrength = Math.min(100, Math.round(Math.abs(totalChange) * 1000))

  return {
    trend, trendStrength, rsi, vol7d: vol, drawdown7d: dd,
    sma_short, sma_long, smaCross,
    vsHigh: ((last - high) / high) * 100,
    vsLow:  ((last - low)  / low)  * 100,
    macd: macdLine, macdSignal, macdHistogram,
    bbUpper, bbMiddle, bbLower, bbWidth, bbPosition,
  }
}

function computeEMA(prices: number[], period: number): number {
  if (prices.length === 0 || period <= 0) return 0
  const k = 2 / (period + 1)
  let ema = prices[0]
  for (let i = 1; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k)
  return ema
}

function computeRSI(prices: number[], period = 14): number {
  if (prices.length <= period) return 50
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff >= 0) gain += diff
    else loss -= diff
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const g = diff > 0 ? diff : 0
    const l = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ---------- portfolio analytics ----------

export interface PortfolioStats {
  netWorth: number
  positionsValue: number
  cash: number
  totalCost: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  realizedPnl: number
  realizedPnlPct: number
  topHolding: PortfolioHolding | null
  worstHolding: PortfolioHolding | null
  bestHolding: PortfolioHolding | null
  hhi: number                    // Herfindahl-Hirschman Index (0-10000)
  effectivePositions: number     // 1/sum(w^2)
  totalDeposited: number
  totalWithdrawn: number
  netDeposited: number
  lifetimeReturn: number         // (netWorth - netDeposited) / netDeposited
}

export function computeStats(
  holdings: PortfolioHolding[],
  cash: number,
  txs: WalletTransaction[],
  trades: Trade[],
): PortfolioStats {
  const positionsValue = holdings.reduce((s, h) => s + (h.value || 0), 0)
  const netWorth = positionsValue + cash
  const totalCost = holdings.reduce((s, h) => s + (h.avgBuyPrice || 0) * (h.quantity || 0), 0)
  const unrealizedPnl = holdings.reduce((s, h) => s + (h.pnl || 0), 0)
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0

  // Realized P&L from sell trades — rough estimate: sell value vs avg buy at time of sell
  // We don't have historical avg buy, so we approximate as sell.total minus quantity*currentAvg.
  const realizedPnl = trades
    .filter((t) => t.side === 'sell')
    .reduce((s, t) => {
      const h = holdings.find((x) => (x.symbol || '').toUpperCase() === (t.symbol || '').toUpperCase())
      const cost = (h?.avgBuyPrice || t.price) * t.quantity
      return s + ((t.total || t.price * t.quantity) - cost)
    }, 0)
  const sellsCost = trades.filter((t) => t.side === 'sell').reduce((s, t) => s + (t.price * t.quantity), 0)
  const realizedPnlPct = sellsCost > 0 ? (realizedPnl / sellsCost) * 100 : 0

  const sorted = [...holdings].sort((a, b) => (b.value || 0) - (a.value || 0))
  const topHolding = sorted[0] || null
  const byPnl = [...holdings].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0))
  const bestHolding = byPnl[0] || null
  const worstHolding = byPnl[byPnl.length - 1] || null

  // HHI on positions only (ignore cash so the score reflects equity concentration)
  let hhi = 0
  if (positionsValue > 0) {
    for (const h of holdings) {
      const w = (h.value || 0) / positionsValue
      hhi += (w * 100) ** 2
    }
  }
  const effectivePositions = hhi > 0 ? 10000 / hhi : 0

  const totalDeposited = txs.filter((t) => t.type === 'deposit').reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalWithdrawn = txs.filter((t) => t.type === 'withdraw').reduce((s, t) => s + Math.abs(t.amount), 0)
  const netDeposited = totalDeposited - totalWithdrawn
  const lifetimeReturn = netDeposited > 0 ? ((netWorth - netDeposited) / netDeposited) * 100 : 0

  return {
    netWorth, positionsValue, cash, totalCost, unrealizedPnl, unrealizedPnlPct,
    realizedPnl, realizedPnlPct, topHolding, worstHolding, bestHolding,
    hhi, effectivePositions, totalDeposited, totalWithdrawn, netDeposited, lifetimeReturn,
  }
}

// ---------- portfolio-level risk on 7d sparklines ----------

export interface PortfolioRisk {
  weightedVolPct: number         // annualised %
  weightedSharpe: number
  weightedDrawdownPct: number
  var95Daily: number             // % of portfolio
  riskGrade: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Extreme'
}

export function computePortfolioRisk(
  holdings: PortfolioHolding[],
  market: CryptoQuote[],
  netWorth: number,
): PortfolioRisk | null {
  if (netWorth <= 0 || holdings.length === 0) return null
  const bySym = new Map(market.map((m) => [(m.symbol || '').toLowerCase(), m] as const))
  const byId = new Map(market.map((m) => [m.id, m] as const))

  let wVol = 0, wSharpe = 0, wDD = 0, wVar = 0, wSum = 0
  for (const h of holdings) {
    const m = byId.get(h.id) ?? bySym.get((h.symbol || '').toLowerCase())
    const spark = m?.sparkline_in_7d?.price
    if (!spark || spark.length < 12) continue
    const rets = dailyReturns(spark)
    const w = (h.value || 0) / netWorth
    wVol    += annualisedVolatility(rets, 24 * 7) * 100 * w
    wSharpe += sharpeRatio(rets, 0.04, 24 * 7) * w
    wDD     += maxDrawdown(spark) * 100 * w
    wVar    += valueAtRisk(rets, 0.95) * 100 * w
    wSum    += w
  }
  if (wSum === 0) return null
  const weightedVolPct      = wVol / wSum
  const weightedSharpe      = wSharpe / wSum
  const weightedDrawdownPct = wDD / wSum
  const var95Daily          = wVar / wSum

  let riskGrade: PortfolioRisk['riskGrade'] = 'Low'
  if (weightedVolPct > 200) riskGrade = 'Extreme'
  else if (weightedVolPct > 120) riskGrade = 'High'
  else if (weightedVolPct > 80) riskGrade = 'Elevated'
  else if (weightedVolPct > 40) riskGrade = 'Moderate'

  return { weightedVolPct, weightedSharpe, weightedDrawdownPct, var95Daily, riskGrade }
}

// ---------- trade analytics ----------

export interface TradeStats {
  count: number
  buys: number
  sells: number
  winRate: number             // % of sell trades that were profitable
  avgHoldDays: number         // approximation
  totalVolume: number
  mostTradedSymbol: string | null
  lastTrade: Trade | null
}

export function computeTradeStats(trades: Trade[], holdings: PortfolioHolding[]): TradeStats {
  if (trades.length === 0) {
    return { count: 0, buys: 0, sells: 0, winRate: 0, avgHoldDays: 0, totalVolume: 0, mostTradedSymbol: null, lastTrade: null }
  }
  const buys = trades.filter((t) => t.side === 'buy').length
  const sells = trades.filter((t) => t.side === 'sell').length
  const totalVolume = trades.reduce((s, t) => s + (t.total || t.price * t.quantity), 0)
  const sym = new Map<string, number>()
  for (const t of trades) sym.set(t.symbol, (sym.get(t.symbol) || 0) + 1)
  const mostTraded = [...sym.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Win rate — sells priced above corresponding holding's avg buy
  let wins = 0, sellTotal = 0
  for (const t of trades.filter((x) => x.side === 'sell')) {
    sellTotal++
    const h = holdings.find((x) => (x.symbol || '').toUpperCase() === (t.symbol || '').toUpperCase())
    if (h && t.price > (h.avgBuyPrice || 0)) wins++
  }
  const winRate = sellTotal > 0 ? (wins / sellTotal) * 100 : 0

  // Avg hold days — distance between first buy and last sell per symbol
  const symBuys = new Map<string, number>()
  const symSells = new Map<string, number>()
  for (const t of trades) {
    const k = (t.symbol || '').toUpperCase()
    const ts = t.timestamp.getTime()
    if (t.side === 'buy' && (!symBuys.has(k) || symBuys.get(k)! > ts)) symBuys.set(k, ts)
    if (t.side === 'sell' && (!symSells.has(k) || symSells.get(k)! < ts)) symSells.set(k, ts)
  }
  let holdSum = 0, holdCnt = 0
  for (const [k, b] of symBuys) {
    const s = symSells.get(k)
    if (s && s > b) { holdSum += (s - b) / 86_400_000; holdCnt++ }
  }
  const avgHoldDays = holdCnt > 0 ? holdSum / holdCnt : 0

  const lastTrade = [...trades].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] || null
  return { count: trades.length, buys, sells, winRate, avgHoldDays, totalVolume, mostTradedSymbol: mostTraded, lastTrade }
}

// ---------- market regime ----------

export interface MarketRegime {
  fearGreed: number              // 0-100 (low=fear)
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  breadth: number                // % of top market trending up
  topGainer: CryptoQuote | null
  topLoser: CryptoQuote | null
  btcDominance: number           // % BTC of total top-30 market cap (proxy)
}

export function computeMarketRegime(market: CryptoQuote[]): MarketRegime | null {
  if (market.length === 0) return null
  const top = market.slice(0, 30)
  const ups = top.filter((m) => (m.price_change_percentage_24h || 0) > 0).length
  const breadth = (ups / top.length) * 100
  const avgChange = mean(top.map((m) => m.price_change_percentage_24h || 0))
  const volSpread = stdev(top.map((m) => m.price_change_percentage_24h || 0))

  // Fear/Greed proxy: weight breadth (50%), avg 24h change scaled (30%), inverse vol spread (20%)
  let fg = breadth * 0.5
  fg += Math.max(0, Math.min(100, 50 + avgChange * 5)) * 0.3
  fg += Math.max(0, Math.min(100, 100 - volSpread * 10)) * 0.2
  fg = Math.round(Math.max(0, Math.min(100, fg)))

  let label: MarketRegime['label'] = 'Neutral'
  if (fg < 20) label = 'Extreme Fear'
  else if (fg < 40) label = 'Fear'
  else if (fg > 80) label = 'Extreme Greed'
  else if (fg > 60) label = 'Greed'

  const sorted = [...top].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
  const topGainer = sorted[0] || null
  const topLoser = sorted[sorted.length - 1] || null

  const btc = market.find((m) => m.id === 'bitcoin')
  const totalCap = top.reduce((s, m) => s + (m.market_cap || 0), 0)
  const btcDominance = btc && totalCap > 0 ? (btc.market_cap / totalCap) * 100 : 0

  return { fearGreed: fg, label, breadth, topGainer, topLoser, btcDominance }
}

// ---------- correlation between portfolio and BTC ----------

export function btcCorrelation(holdings: PortfolioHolding[], market: CryptoQuote[]): number | null {
  const btc = market.find((m) => m.id === 'bitcoin')
  if (!btc?.sparkline_in_7d?.price) return null
  const btcRets = dailyReturns(btc.sparkline_in_7d.price)
  if (btcRets.length < 8) return null

  const totalVal = holdings.reduce((s, h) => s + (h.value || 0), 0)
  if (totalVal === 0) return null

  // Build weighted portfolio returns
  const len = btcRets.length
  const portRets = new Array(len).fill(0) as number[]
  let used = false
  const bySym = new Map(market.map((m) => [(m.symbol || '').toLowerCase(), m] as const))
  const byId = new Map(market.map((m) => [m.id, m] as const))
  for (const h of holdings) {
    const m = byId.get(h.id) ?? bySym.get((h.symbol || '').toLowerCase())
    const spark = m?.sparkline_in_7d?.price
    if (!spark) continue
    const r = dailyReturns(spark)
    const w = (h.value || 0) / totalVal
    const offset = Math.max(0, r.length - len)
    for (let i = 0; i < len; i++) {
      const idx = i + offset
      if (idx < r.length) { portRets[i] += r[idx] * w; used = true }
    }
  }
  if (!used) return null
  return correlation(portRets, btcRets)
}

function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const ma = mean(a.slice(0, n))
  const mb = mean(b.slice(0, n))
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma
    const y = b[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  const denom = Math.sqrt(da * db)
  if (denom === 0) return 0
  return num / denom
}

// ---------- market opportunity scanner ----------

export interface MarketOpportunity {
  coin: CryptoQuote
  action: 'BUY' | 'SELL' | 'WATCH'
  score: number          // 0-100 (higher = stronger signal)
  reasons: string[]      // human-readable signal explanations
  riskLevel: 'Low' | 'Medium' | 'High'
  signals: TechSignals
}

/**
 * Scans the top N coins and scores each one for buy / sell / watch.
 * Scoring weights:
 *   RSI oversold/overbought  → ±30 pts
 *   SMA cross                → ±20 pts
 *   MACD histogram direction → ±15 pts
 *   Bollinger band position  → ±15 pts
 *   24h momentum             → ±10 pts
 *   Volatility penalty       → up to -10 pts
 */
export function computeMarketOpportunities(
  market: CryptoQuote[],
  holdings: PortfolioHolding[],
  topN = 30,
): MarketOpportunity[] {
  const results: MarketOpportunity[] = []
  const heldSyms = new Set(holdings.map(h => h.symbol.toLowerCase()))

  for (const coin of market.slice(0, topN)) {
    const sig = computeSignals(coin.sparkline_in_7d?.price)
    if (!sig) continue

    let score = 50  // neutral baseline
    const reasons: string[] = []

    // RSI
    if (sig.rsi <= 30) {
      score += 30
      reasons.push(`RSI ${sig.rsi.toFixed(0)} — oversold (potential bounce)`)
    } else if (sig.rsi <= 40) {
      score += 15
      reasons.push(`RSI ${sig.rsi.toFixed(0)} — approaching oversold`)
    } else if (sig.rsi >= 70) {
      score -= 30
      reasons.push(`RSI ${sig.rsi.toFixed(0)} — overbought (mean-reversion risk)`)
    } else if (sig.rsi >= 60) {
      score -= 15
      reasons.push(`RSI ${sig.rsi.toFixed(0)} — elevated, watch for reversal`)
    }

    // SMA cross
    if (sig.smaCross === 'bullish') {
      score += 20
      reasons.push('Bullish SMA cross — short MA crossed above long MA')
    } else if (sig.smaCross === 'bearish') {
      score -= 20
      reasons.push('Bearish SMA cross — short MA crossed below long MA')
    }

    // MACD
    if (sig.macdHistogram > 0) {
      score += 15
      reasons.push('MACD histogram positive — bullish momentum building')
    } else {
      score -= 15
      reasons.push('MACD histogram negative — bearish momentum')
    }

    // Bollinger band position
    if (sig.bbPosition < 0.2) {
      score += 15
      reasons.push('Price near lower Bollinger Band — potential mean-reversion entry')
    } else if (sig.bbPosition > 0.8) {
      score -= 15
      reasons.push('Price near upper Bollinger Band — extended, risk of pullback')
    }

    // 24h momentum
    const chg = coin.price_change_percentage_24h || 0
    if (chg > 5) {
      score += 10
      reasons.push(`Strong 24h momentum +${chg.toFixed(1)}%`)
    } else if (chg < -5) {
      score -= 10
      reasons.push(`Weak 24h momentum ${chg.toFixed(1)}%`)
    }

    // Volatility penalty (very high vol = higher risk, lower score)
    const volPenalty = Math.min(10, Math.max(0, (sig.vol7d - 80) / 20))
    score -= volPenalty

    score = Math.round(Math.max(0, Math.min(100, score)))

    const riskLevel: MarketOpportunity['riskLevel'] =
      sig.vol7d > 150 ? 'High' : sig.vol7d > 80 ? 'Medium' : 'Low'

    let action: MarketOpportunity['action'] = 'WATCH'
    if (score >= 65) action = 'BUY'
    else if (score <= 35) action = 'SELL'

    // If user holds this coin and signal is SELL, prioritise it
    const isHeld = heldSyms.has(coin.symbol.toLowerCase())
    if (isHeld && action === 'SELL') score = Math.min(100, score + 10)

    results.push({ coin, action, score, reasons, riskLevel, signals: sig })
  }

  return results.sort((a, b) => {
    // Sort: BUY first (highest score), then WATCH, then SELL (lowest score)
    if (a.action !== b.action) {
      const order = { BUY: 0, WATCH: 1, SELL: 2 }
      return order[a.action] - order[b.action]
    }
    return b.score - a.score
  })
}

// ---------- portfolio-level risk advisory ----------

export interface RiskAdvisory {
  overallRisk: 'Low' | 'Medium' | 'High' | 'Critical'
  sellAdvisories: { symbol: string; reason: string; urgency: 'low' | 'medium' | 'high' }[]
  buyOpportunities: { symbol: string; reason: string; confidence: number }[]
  regimeSummary: string
}

export function computeRiskAdvisory(
  holdings: PortfolioHolding[],
  market: CryptoQuote[],
  netWorth: number,
): RiskAdvisory {
  const regime = computeMarketRegime(market)
  const opportunities = computeMarketOpportunities(market, holdings)
  const risk = computePortfolioRisk(holdings, market, netWorth)

  const sellAdvisories: RiskAdvisory['sellAdvisories'] = []
  const buyOpportunities: RiskAdvisory['buyOpportunities'] = []

  // Check each held position for sell signals
  for (const h of holdings) {
    const m = market.find(x => x.id === h.id || x.symbol.toLowerCase() === h.symbol.toLowerCase())
    if (!m) continue
    const sig = computeSignals(m.sparkline_in_7d?.price)
    if (!sig) continue

    const reasons: string[] = []
    let urgency: 'low' | 'medium' | 'high' = 'low'

    if (sig.rsi >= 75) { reasons.push(`RSI ${sig.rsi.toFixed(0)} — severely overbought`); urgency = 'high' }
    else if (sig.rsi >= 65) { reasons.push(`RSI ${sig.rsi.toFixed(0)} — overbought`); urgency = 'medium' }

    if (sig.smaCross === 'bearish') { reasons.push('Bearish SMA cross confirmed'); urgency = urgency === 'low' ? 'medium' : 'high' }
    if (sig.macdHistogram < 0 && sig.trend === 'down') { reasons.push('MACD bearish + downtrend'); urgency = urgency === 'low' ? 'medium' : urgency }
    if (h.pnlPercent > 40) { reasons.push(`Up ${h.pnlPercent.toFixed(0)}% — consider locking in gains`); urgency = urgency === 'low' ? 'low' : urgency }
    if (h.pnlPercent < -20) { reasons.push(`Down ${Math.abs(h.pnlPercent).toFixed(0)}% — stop-loss territory`); urgency = 'high' }

    if (reasons.length > 0) {
      sellAdvisories.push({ symbol: h.symbol, reason: reasons.join('; '), urgency })
    }
  }

  // Top buy opportunities from unowned coins
  const heldSyms = new Set(holdings.map(h => h.symbol.toLowerCase()))
  const buys = opportunities
    .filter(o => o.action === 'BUY' && !heldSyms.has(o.coin.symbol.toLowerCase()))
    .slice(0, 5)
  for (const b of buys) {
    buyOpportunities.push({
      symbol: b.coin.symbol.toUpperCase(),
      reason: b.reasons.slice(0, 2).join('; '),
      confidence: b.score,
    })
  }

  // Overall risk
  const fearGreed = regime?.fearGreed ?? 50
  const volGrade = risk?.riskGrade ?? 'Low'
  let overallRisk: RiskAdvisory['overallRisk'] = 'Low'
  if (volGrade === 'Extreme' || fearGreed < 15 || fearGreed > 90) overallRisk = 'Critical'
  else if (volGrade === 'High' || fearGreed < 25 || fearGreed > 80) overallRisk = 'High'
  else if (volGrade === 'Elevated' || fearGreed < 40 || fearGreed > 70) overallRisk = 'Medium'

  const regimeSummary = regime
    ? `${regime.label} (Fear/Greed ${regime.fearGreed}/100, breadth ${regime.breadth.toFixed(0)}% advancing)`
    : 'Market data unavailable'

  return { overallRisk, sellAdvisories, buyOpportunities, regimeSummary }
}

// ---------- intent classifier ----------

export type Intent =
  | 'greeting' | 'help' | 'thanks'
  | 'portfolio_overview' | 'portfolio_health' | 'portfolio_risk'
  | 'concentration' | 'diversification' | 'allocation'
  | 'pnl' | 'best_worst' | 'win_rate'
  | 'asset_quote' | 'asset_signals' | 'compare_assets'
  | 'market_regime' | 'market_news' | 'top_movers'
  | 'deposit_history' | 'withdraw_history' | 'transaction_history' | 'fee_history'
  | 'cash_balance' | 'rebalance' | 'tax_estimate'
  | 'staking' | 'yield' | 'goals' | 'dca'
  | 'alerts' | 'watchlist'
  | 'whatif_sell' | 'whatif_buy'
  | 'recommendation' | 'strategy'
  | 'fundamentals' | 'persona_question'
  | 'copy_trading' | 'paper_trading' | 'sentiment'
  | 'execute_trade' | 'execute_sell' | 'execute_swap'
  | 'market_opportunities' | 'risk_advisory'
  | 'unknown'

export function classifyIntent(query: string): Intent {
  const q = query.toLowerCase().trim()
  if (!q) return 'unknown'

  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening|night))/.test(q)) return 'greeting'
  if (/(thank|thanks|appreciate|cheers|great|awesome|perfect|nice one)/.test(q)) return 'thanks'
  if (/(help|what can you do|what.*do you do|capabilities|commands|features)/.test(q)) return 'help'

  if (/(rebalance|reallocate|reweight)/.test(q)) return 'rebalance'
  if (/(tax|capital gains|wash sale|cost basis)/.test(q)) return 'tax_estimate'
  if (/(what (if|happens) i (sell|dump|trim|reduce)|sell .* of my)/.test(q)) return 'whatif_sell'
  if (/(what (if|happens) i (buy|add|stack))/.test(q)) return 'whatif_buy'

  if (/(copy.trad|mirror.trad|follow.*trader|copy.*trade)/.test(q)) return 'copy_trading'
  if (/(paper.trad|simulated|virtual.*trad|practice.*trad|demo.*trad)/.test(q)) return 'paper_trading'
  if (/(sentiment|mood|feeling|bullish|bearish|community|market.*vibe)/.test(q)) return 'sentiment'

  if (/(stake|staking|validator|delegation)/.test(q)) return 'staking'
  if (/(yield|apy|apr|earn|farming)/.test(q)) return 'yield'
  if (/(goal|target|milestone|saving for)/.test(q)) return 'goals'
  if (/(dca|dollar.cost|recurring buy|auto buy|schedule)/.test(q)) return 'dca'
  if (/(alert|notification|notify)/.test(q)) return 'alerts'
  if (/(watchlist|watching)/.test(q)) return 'watchlist'

  if (/(fee|fees|charged|deducted|management fee|service fee|commission)/.test(q)) return 'fee_history'
  if (/(deposit|funded|funding|topped? up|added money|put in|received|credited)/.test(q)) return 'deposit_history'
  if (/(withdraw|withdrew|cashed out|took out|sent out|debited)/.test(q)) return 'withdraw_history'
  if (/(transaction|history|activity|statement|ledger)/.test(q)) return 'transaction_history'
  if (/(cash|usd balance|how much (cash|money)|dry powder|available balance)/.test(q)) return 'cash_balance'

  if (/(health score|portfolio health|how healthy)/.test(q)) return 'portfolio_health'
  if (/(risk|volatility|var|drawdown|sharpe)/.test(q)) return 'portfolio_risk'
  if (/(concentration|concentrated|exposed|hhi)/.test(q)) return 'concentration'
  if (/(diversif|spread out)/.test(q)) return 'diversification'
  if (/(allocation|breakdown|weights?|split)/.test(q)) return 'allocation'

  if (/(pnl|p&l|profit|loss|gain|return|made|lost|how (much|am i) (up|down)|performance|earnings)/.test(q)) return 'pnl'
  if (/(best|worst|top|bottom) (performer|holding|trade|position|asset)/.test(q)) return 'best_worst'
  if (/(win rate|win\/loss|trade stats|trading stats|how (many|often) (did|do) i)/.test(q)) return 'win_rate'

  if (/(top movers?|gainers?|losers?|biggest movers?|24h movers?)/.test(q)) return 'top_movers'
  if (/(market sentiment|market regime|fear.*greed|how.*market.*feeling|breadth|market.*mood)/.test(q)) return 'market_regime'
  if (/(news|headline|story|latest.*crypto|crypto.*news)/.test(q)) return 'market_news'

  if (/(compare|vs\.?|versus|which is better|which should i)/.test(q)) return 'compare_assets'
  if (/(price|quote|how much is|what.*(trading|priced) at|how is my|how.*doing)/.test(q)) return 'asset_quote'
  if (/(rsi|moving average|sma|ema|macd|bollinger|trend|signal|momentum|overbought|oversold|breakout)/.test(q)) return 'asset_signals'

  if (/(strategy|approach|plan|tactic|playbook|how should i invest)/.test(q)) return 'strategy'
  if (/(should i|recommend|suggest|advice|what.*should|what.*do (you|i) think|what.*buy|what.*sell)/.test(q)) return 'recommendation'
  if (/(fundamental|moat|business|earnings|revenue|cash flow|valuation|p\/?e|tokenomics)/.test(q)) return 'fundamentals'
  if (/(who are you|what.*persona|which.*persona|tell me about yourself|your philosophy|your style)/.test(q)) return 'persona_question'

  if (/(portfolio|net worth|holdings|positions)/.test(q)) return 'portfolio_overview'

  // Action intents — must come after what-if checks
  if (/(^buy |^i want to buy|^place.*buy|^execute.*buy|^purchase |^i.d like to buy|^can you buy)/.test(q)) return 'execute_trade'
  if (/(^sell |^i want to sell|^place.*sell|^execute.*sell|^dump |^i.d like to sell|^can you sell)/.test(q)) return 'execute_sell'
  if (/(^swap |^i want to swap|^exchange |^convert |^i.d like to swap|^can you swap)/.test(q)) return 'execute_swap'

  if (/(best (market|coin|crypto|asset|buy|trade)|what (should|can) i buy|top (opportunity|opportunities)|where (should|to) invest|good (entry|buy)|market scan|scan market|opportunity|opportunities)/.test(q)) return 'market_opportunities'
  if (/(risk advisory|advise|should i sell|when (to|should i) sell|market risk|portfolio danger|danger|protect|hedge|exit|cut loss|stop loss|at risk)/.test(q)) return 'risk_advisory'

  return 'unknown'
}

// ---------- helpers shared across replies ----------

export function describeRsi(rsi: number): string {
  if (rsi >= 70) return `RSI ${rsi.toFixed(0)} — overbought, mean-reversion risk`
  if (rsi <= 30) return `RSI ${rsi.toFixed(0)} — oversold, potential bounce zone`
  if (rsi >= 55) return `RSI ${rsi.toFixed(0)} — bullish bias`
  if (rsi <= 45) return `RSI ${rsi.toFixed(0)} — bearish bias`
  return `RSI ${rsi.toFixed(0)} — neutral`
}

export function findHolding(holdings: PortfolioHolding[], symOrId: string): PortfolioHolding | null {
  if (!symOrId) return null
  const k = symOrId.toLowerCase()
  return holdings.find((h) =>
    (h.id || '').toLowerCase() === k ||
    (h.symbol || '').toLowerCase() === k ||
    (h.name || '').toLowerCase() === k
  ) || null
}

export function totalCashFromWallet(wallet: WalletBalance[]): number {
  return wallet
    .filter((w) => (w.currency || '').toUpperCase() === 'USD')
    .reduce((s, w) => s + (w.balance || 0), 0)
}
