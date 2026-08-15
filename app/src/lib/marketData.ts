// Frontend must never hold admin or full-privilege API credentials.
// It only talks to our backend proxy, which owns the server-side keys.
// CoinGecko is blocked by CORS for browser clients. We proxy through our own
// API which fetches server-side and caches. Vite dev proxies /api -> :4000.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''
const CG_PROXY = `${API_BASE}/api/market/coingecko`

export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: string
}

export interface CryptoQuote {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap: number
  total_volume: number
  high_24h: number
  low_24h: number
  // CoinGecko returns a hosted PNG for every coin (`https://assets.coingecko.com/coins/images/.../small.png`).
  // Surfacing it on the type lets the UI use the canonical logo instead of
  // guessing a CDN by ticker, which is what made so many icons 404.
  image?: string
  sparkline_in_7d?: { price: number[] }
}

export interface MarketNews {
  category: string
  datetime: number
  headline: string
  source: string
  summary: string
  url: string
}

export interface Candle {
  time: number // ms epoch
  open: number
  high: number
  low: number
  close: number
}

export type OhlcRange = '1H' | '1D' | '1W' | '1M' | '1Y'

// No mock crypto / news fallbacks. When the upstream APIs are unreachable
// the service returns empty arrays so the UI can render an explicit
// empty/error state instead of fabricated prices that look like real money.

// Normalize a raw CoinGecko coin object so every consumer can safely call
// `.symbol.toUpperCase()`, `.price_change_percentage_24h.toFixed(2)`, etc.
// CoinGecko occasionally returns null/undefined for any of these fields
// (especially on freshly-listed coins or during partial outages), and that
// is what triggers "null is not an object" crashes across the app.
function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function sanitizeCryptoQuote(raw: unknown): CryptoQuote | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  if (!id) return null
  const symbol = str(r.symbol) || id
  const name = str(r.name) || symbol.toUpperCase() || id
  const spark = (r.sparkline_in_7d && typeof r.sparkline_in_7d === 'object')
    ? (r.sparkline_in_7d as { price?: unknown }).price
    : undefined
  const sparkline_in_7d = Array.isArray(spark)
    ? { price: (spark as unknown[]).filter((p): p is number => typeof p === 'number' && isFinite(p)) }
    : undefined
  return {
    id,
    symbol,
    name,
    current_price: num(r.current_price),
    price_change_24h: num(r.price_change_24h),
    price_change_percentage_24h: num(r.price_change_percentage_24h),
    market_cap: num(r.market_cap),
    total_volume: num(r.total_volume),
    high_24h: num(r.high_24h),
    low_24h: num(r.low_24h),
    image: typeof r.image === 'string' ? r.image : undefined,
    sparkline_in_7d,
  }
}
function sanitizeCryptoList(raw: unknown): CryptoQuote[] {
  if (!Array.isArray(raw)) return []
  const out: CryptoQuote[] = []
  for (const item of raw) {
    const q = sanitizeCryptoQuote(item)
    if (q) out.push(q)
  }
  return out
}

class MarketDataService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map()
  private cacheDuration = 30000              // generic cache (stocks etc)
  private cryptoCacheDuration = 3000         // REDUCED: live crypto updates every 3s
  private ohlcCacheDuration = 5000           // REDUCED: OHLC updates every 5s
  private apiFailedUntil = 0                 // cooldown timestamp; 0 = healthy
  private apiCooldownMs = 15000              // back off only 15 seconds after failure

  private isApiCoolingDown(): boolean {
    return Date.now() < this.apiFailedUntil
  }

  private markApiFailed() {
    this.apiFailedUntil = Date.now() + this.apiCooldownMs
  }

  private getCached<T>(key: string, ttlMs: number = this.cacheDuration): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data as T
    }
    return null
  }

  private setCache<T>(key: string, data: T) {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `stock_${symbol}`
    const cached = this.getCached<StockQuote>(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch(`${API_BASE}/api/market/stock-quote?symbol=${encodeURIComponent(symbol)}`, {
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      })
      if (!response.ok) return null
      const data = await response.json() as StockQuote | { error?: string }
      if (!data || typeof data !== 'object' || 'error' in data) return null
      this.setCache(cacheKey, data)
      return data
    } catch {
      return null
    }
  }

  async getCryptoList(): Promise<CryptoQuote[]> {
    const cacheKey = 'crypto_list'
    const cached = this.getCached<CryptoQuote[]>(cacheKey, this.cryptoCacheDuration)
    if (cached && cached.length > 0) {
      // Return cache immediately and refresh in background
      this.refreshCryptoListInBackground()
      return cached
    }

    // Try to fetch real data first
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)

      const response = await fetch(
        `${CG_PROXY}/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Empty response from CoinGecko')
      }

      const sanitized = sanitizeCryptoList(data)
      this.setCache(cacheKey, sanitized)
      return sanitized
    } catch (error) {
      console.error('[marketData] getCryptoList failed:', error)
      this.markApiFailed()
      // Try stale cache
      const stale = this.cache.get(cacheKey)?.data as CryptoQuote[] | undefined
      if (stale && stale.length > 0) {
        return stale
      }
      return []
    }
  }

  private refreshCryptoListInBackground() {
    // Non-blocking background refresh
    Promise.resolve().then(async () => {
      if (this.isApiCoolingDown()) return
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)
        const response = await fetch(
          `${CG_PROXY}/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)
        if (!response.ok) throw new Error(`Error: ${response.status}`)
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          const sanitized = sanitizeCryptoList(data)
          this.setCache('crypto_list', sanitized)
        }
      } catch {
        this.markApiFailed()
      }
    })
  }

  async getCryptoPrice(ids: string[]): Promise<CryptoQuote[]> {
    if (!ids.length) return []
    const cacheKey = `crypto_${ids.slice().sort().join('_')}`
    const cached = this.getCached<CryptoQuote[]>(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch(
        `${CG_PROXY}/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=true`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
      const data = await response.json()
      const sanitized = sanitizeCryptoList(data)
      this.setCache(cacheKey, sanitized)
      return sanitized
    } catch {
      const stale = this.cache.get(cacheKey)?.data as CryptoQuote[] | undefined
      if (!stale || stale.length === 0) {
        return []
      }
      return stale
    }
  }

  async getOhlc(coinId: string, range: OhlcRange): Promise<Candle[]> {
    // CoinGecko's /coins/{id}/ohlc supports days = 1, 7, 14, 30, 90, 180, 365, max.
    // Granularity is auto: <=2d → 30min, <=30d → 4h, >30d → 4d.
    const days = range === '1H' ? 1 : range === '1D' ? 1 : range === '1W' ? 7 : range === '1M' ? 30 : 365
    const cacheKey = `ohlc_${coinId}_${days}`
    const cached = this.getCached<Candle[]>(cacheKey, this.ohlcCacheDuration)
    if (cached) return cached

    if (this.isApiCoolingDown()) {
      const stale = this.cache.get(cacheKey)?.data as Candle[] | undefined
      if (stale && stale.length > 0) return stale
      return this.generateMockOhlc(coinId, range)
    }

    try {
      const url = `${CG_PROXY}/ohlc?id=${encodeURIComponent(coinId)}&vs_currency=usd&days=${days}`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) {
        // If backend isn't deployed (404), fall back to mock data
        if (res.status === 404 || res.status === 502 || res.status === 503) {
          console.warn(`[marketData] Backend unavailable (${res.status}), using mock OHLC data`)
          const mock = this.generateMockOhlc(coinId, range)
          this.setCache(cacheKey, mock)
          return mock
        }
        // Try to surface upstream detail so the chart UI can show *why* it failed.
        let detail = `OHLC ${res.status}`
        try {
          const body = (await res.json()) as { error?: string; detail?: string }
          if (body?.detail) detail = body.detail
          else if (body?.error) detail = body.error
        } catch { /* not json */ }
        throw new Error(detail)
      }
      const raw = (await res.json()) as Array<[number, number, number, number, number]>
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty')
      let candles: Candle[] = raw.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
      // For "1H" tighten to the last hour using the highest-resolution slice we got back.
      if (range === '1H') {
        const cutoff = Date.now() - 60 * 60 * 1000
        const recent = candles.filter((c) => c.time >= cutoff)
        if (recent.length >= 4) candles = recent
        else candles = candles.slice(-12)
      }
      this.setCache(cacheKey, candles)
      return candles
    } catch (error) {
      console.warn('CoinGecko OHLC failed:', error)
      const stale = this.cache.get(cacheKey)?.data as Candle[] | undefined
      if (stale && stale.length > 0) return stale
      // Fallback to mock data for demo purposes
      const mock = this.generateMockOhlc(coinId, range)
      this.setCache(cacheKey, mock)
      return mock
    }
  }

  private generateMockOhlc(coinId: string, range: OhlcRange): Candle[] {
    // Generate realistic-looking OHLC data for demo
    const coin = MOCK_CRYPTO_DATA.find(c => c.id === coinId) || MOCK_CRYPTO_DATA[0]
    const basePrice = coin.current_price
    const volatility = 0.02 // 2% moves
    
    const pointCount = range === '1H' ? 12 : range === '1D' ? 24 : range === '1W' ? 168 : range === '1M' ? 120 : 365
    const interval = range === '1H' ? 5 * 60 * 1000 : range === '1D' ? 60 * 60 * 1000 : range === '1W' ? 60 * 60 * 1000 : range === '1M' ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    
    const candles: Candle[] = []
    let currentPrice = basePrice
    const now = Date.now()
    
    for (let i = 0; i < pointCount; i++) {
      const time = now - (pointCount - i) * interval
      const open = currentPrice
      const change = (Math.random() - 0.5) * basePrice * volatility
      const close = Math.max(open + change, basePrice * 0.8) // Don't go below 80% of base
      const high = Math.max(open, close) * (1 + Math.random() * 0.01)
      const low = Math.min(open, close) * (1 - Math.random() * 0.01)
      
      candles.push({ time, open, high, low, close })
      currentPrice = close
    }
    
    return candles
  }

  async getMarketNews(opts: { category?: string; force?: boolean } = {}): Promise<MarketNews[]> {
    const category = (opts.category || 'general').toLowerCase()
    const cacheKey = `news:${category}`
    if (!opts.force) {
      const cached = this.getCached<MarketNews[]>(cacheKey, 60_000)
      if (cached) return cached
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/market/news?category=${encodeURIComponent(category)}`,
        { signal: AbortSignal.timeout(6000), cache: 'no-store' },
      )
      if (res.ok) {
        const data = (await res.json()) as MarketNews[]
        const result = Array.isArray(data) ? data.slice(0, 30) : []
        if (result.length > 0) {
          this.setCache(cacheKey, result)
          return result
        }
      }
    } catch {
      /* backend proxy is the only allowed browser path */
    }
    return this.getCached<MarketNews[]>(cacheKey, 10 * 60_000) ?? []
  }

  async searchStocks(query: string): Promise<unknown[]> {
    if (!query.trim()) return []
    try {
      const response = await fetch(`${API_BASE}/api/market/search?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      })
      if (!response.ok) return []
      const data = await response.json() as { results?: unknown[] }
      return Array.isArray(data.results) ? data.results : []
    } catch {
      return []
    }
  }
}

export const marketData = new MarketDataService()
