// Live price ticker — tries a backend WebSocket at /api/market/ws first,
// falls back to HTTP polling (/api/market/tickers) after MAX_WS_ATTEMPTS
// failures. Either path notifies subscribers on every price change.
// Also feeds prices into the real-time price system for portfolio updates.

import { realTimePrice } from './realTimePrice'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''
const LIVE_POLL_MS = 2_000
const WS_RECONNECT_MS = 5_000
const WS_TIMEOUT_MS = 10_000

const SYMBOL_TO_COIN_ID: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ada: 'cardano',
  xrp: 'ripple', doge: 'dogecoin', dot: 'polkadot', link: 'chainlink',
  avax: 'avalanche-2', ltc: 'litecoin', matic: 'matic-network',
  shib: 'shiba-inu', uni: 'uniswap', bch: 'bitcoin-cash', xlm: 'stellar',
  atom: 'cosmos', fil: 'filecoin', near: 'near-protocol', apt: 'aptos',
  arb: 'arbitrum', op: 'optimism', bnb: 'binancecoin',
}

function canonical(idOrSymbol: string): string {
  const k = (idOrSymbol || '').toLowerCase()
  return SYMBOL_TO_COIN_ID[k] ?? k
}

type Listener = (price: number) => void

class LiveTickerService {
  private listeners = new Map<string, Set<Listener>>()
  private latest = new Map<string, number>()
  private timer: number | null = null
  private inflight = false
  private ws: WebSocket | null = null
  private wsReconnectTimer: number | null = null
  private useWebSocket = true
  private wsConnectionAttempts = 0
  private readonly MAX_WS_ATTEMPTS = 3

  getPrice(coinId: string): number | null {
    return this.latest.get(canonical(coinId)) ?? null
  }

  subscribe(coinId: string, cb: Listener): () => void {
    const id = canonical(coinId)
    let bucket = this.listeners.get(id)
    if (!bucket) { bucket = new Set(); this.listeners.set(id, bucket) }
    bucket.add(cb)
    const cached = this.latest.get(id)
    if (cached != null) cb(cached)
    if (this.useWebSocket && this.wsConnectionAttempts < this.MAX_WS_ATTEMPTS) {
      this.ensureWebSocket()
    } else {
      this.ensurePolling()
    }
    void this.tick()
    return () => {
      const b = this.listeners.get(id)
      if (!b) return
      b.delete(cb)
      if (b.size === 0) this.listeners.delete(id)
      if (this.listeners.size === 0) { this.stopPolling(); this.closeWebSocket() }
    }
  }

  private ensurePolling() {
    if (this.timer != null) return
    if (typeof window === 'undefined') return
    this.timer = window.setInterval(() => { void this.tick() }, LIVE_POLL_MS)
  }

  private stopPolling() {
    if (this.timer != null) { window.clearInterval(this.timer); this.timer = null }
  }

  private ensureWebSocket() {
    if (this.ws != null && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    if (typeof window === 'undefined') return
    if (this.wsConnectionAttempts >= this.MAX_WS_ATTEMPTS) {
      this.useWebSocket = false
      this.ensurePolling()
      return
    }
    this.wsConnectionAttempts++
    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/api/market/ws'
    try {
      this.ws = new WebSocket(wsUrl)
      const timeout = window.setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.closeWebSocket()
          this.useWebSocket = false
          this.ensurePolling()
        }
      }, WS_TIMEOUT_MS)
      this.ws.onopen = () => {
        window.clearTimeout(timeout)
        this.wsConnectionAttempts = 0
        this.stopPolling()
        const ids = Array.from(this.listeners.keys())
        if (ids.length > 0 && this.ws) this.ws.send(JSON.stringify({ type: 'subscribe', ids }))
      }
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { id: string; price: number }
          if (typeof data.price !== 'number' || !isFinite(data.price)) return
          const prev = this.latest.get(data.id)
          if (prev === data.price) return
          this.latest.set(data.id, data.price)
          const bucket = this.listeners.get(data.id)
          if (bucket) for (const cb of bucket) cb(data.price)
          // Feed price into real-time system for portfolio updates
          realTimePrice.updatePrice({
            coinId: data.id,
            symbol: data.id.toUpperCase(),
            price: data.price,
            change24h: 0, // Will be updated from market data
            changePercent24h: 0,
            timestamp: Date.now(),
          })
        } catch { /* ignore malformed messages */ }
      }
      this.ws.onerror = () => {
        window.clearTimeout(timeout)
        this.useWebSocket = false
        this.ensurePolling()
      }
      this.ws.onclose = () => {
        window.clearTimeout(timeout)
        this.ws = null
        if (this.listeners.size > 0 && this.wsConnectionAttempts < this.MAX_WS_ATTEMPTS && this.useWebSocket) {
          this.wsReconnectTimer = window.setTimeout(() => this.ensureWebSocket(), WS_RECONNECT_MS)
        } else if (this.listeners.size > 0) {
          this.useWebSocket = false
          this.ensurePolling()
        }
      }
    } catch {
      this.useWebSocket = false
      this.ensurePolling()
    }
  }

  private closeWebSocket() {
    if (this.wsReconnectTimer != null) { window.clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null }
    if (this.ws != null) { this.ws.close(); this.ws = null }
  }

  private async tick() {
    if (this.inflight) return
    // Skip polling while WebSocket is healthy
    if (this.ws?.readyState === WebSocket.OPEN) return
    const ids = Array.from(this.listeners.keys())
    if (ids.length === 0) return
    this.inflight = true
    try {
      const url = `${API_BASE}/api/market/tickers?ids=${encodeURIComponent(ids.join(','))}`
      const r = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (!r.ok) return
      const data = (await r.json()) as Record<string, number>
      for (const [coinId, price] of Object.entries(data)) {
        if (typeof price !== 'number' || !isFinite(price)) continue
        const prev = this.latest.get(coinId)
        if (prev === price) continue
        this.latest.set(coinId, price)
        const bucket = this.listeners.get(coinId)
        if (bucket) for (const cb of bucket) cb(price)
        // Feed price into real-time system for portfolio updates
        realTimePrice.updatePrice({
          coinId,
          symbol: coinId.toUpperCase(),
          price,
          change24h: 0,
          changePercent24h: 0,
          timestamp: Date.now(),
        })
      }
    } catch {
      /* network blip — try again next interval */
    } finally {
      this.inflight = false
    }
  }
}

export const liveTicker = new LiveTickerService()
