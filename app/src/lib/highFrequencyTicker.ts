/**
 * High-Frequency Price Ticker
 * Updates prices every millisecond with minimal latency
 * Perfect for real-time charts, dashboard updates, and live P&L
 */

import { realTimePrice, type PriceUpdate } from './realTimePrice'

export interface HighFreqPrice {
  symbol: string
  price: number
  bid: number
  ask: number
  lastUpdate: number
  volume24h?: number
  change24h?: number
  high24h?: number
  low24h?: number
}

type HighFreqListener = (prices: Map<string, HighFreqPrice>) => void
type ChartUpdateListener = (symbol: string, price: number, timestamp: number) => void

class HighFrequencyTicker {
  private prices: Map<string, HighFreqPrice> = new Map()
  private listeners: Set<HighFreqListener> = new Set()
  private chartListeners: Map<string, Set<ChartUpdateListener>> = new Map()
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private isConnecting = false
  private subscriptionIds: Set<string> = new Set()
  private priceBuffer: Map<string, PriceUpdate> = new Map()
  private flushInterval: number | null = null
  private lastFlushTime = 0

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebSocket()
      // Flush buffered prices every 50ms to realTimePrice (avoids thrashing)
      this.flushInterval = window.setInterval(() => this.flushPrices(), 50)
    }
  }

  /**
   * Subscribe to chart updates for a specific symbol
   * Gets called on every price tick (ms-level granularity)
   */
  subscribeChart(symbol: string, listener: ChartUpdateListener): () => void {
    if (!this.chartListeners.has(symbol)) {
      this.chartListeners.set(symbol, new Set())
    }
    this.chartListeners.get(symbol)!.add(listener)

    // Auto-subscribe to WebSocket if needed
    this.subscribe(symbol)

    return () => {
      const listeners = this.chartListeners.get(symbol)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.chartListeners.delete(symbol)
          this.unsubscribe(symbol)
        }
      }
    }
  }

  /**
   * Subscribe to all price updates
   */
  subscribe(symbols: string | string[]): void {
    const syms = Array.isArray(symbols) ? symbols : [symbols]

    for (const sym of syms) {
      const upper = sym.toUpperCase()
      if (this.subscriptionIds.has(upper)) continue

      this.subscriptionIds.add(upper)

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'subscribe',
            symbols: [upper],
          })
        )
      }
    }
  }

  /**
   * Unsubscribe from symbol updates
   */
  private unsubscribe(symbol: string): void {
    const upper = symbol.toUpperCase()
    this.subscriptionIds.delete(upper)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'unsubscribe',
          symbols: [upper],
        })
      )
    }
  }

  /**
   * Get current price for symbol
   */
  getPrice(symbol: string): number | null {
    return this.prices.get(symbol.toUpperCase())?.price ?? null
  }

  /**
   * Get all current prices
   */
  getAllPrices(): Map<string, HighFreqPrice> {
    return new Map(this.prices)
  }

  /**
   * Get high-freq price data for symbol
   */
  getPriceData(symbol: string): HighFreqPrice | null {
    return this.prices.get(symbol.toUpperCase()) ?? null
  }

  /**
   * Listen to all price updates
   */
  onPriceUpdate(listener: HighFreqListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Private: Initialize WebSocket connection to live price feed
   */
  private initWebSocket(): void {
    if (this.isConnecting) return
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.isConnecting = true
    const wsUrl = (import.meta.env.VITE_API_URL || '').replace(/^http/, 'ws') + '/api/market/prices-live'

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[HighFreqTicker] WebSocket connected')
        this.isConnecting = false
        this.reconnectAttempts = 0

        // Re-subscribe to all symbols
        if (this.subscriptionIds.size > 0) {
          this.ws!.send(
            JSON.stringify({
              type: 'subscribe',
              symbols: Array.from(this.subscriptionIds),
            })
          )
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)

          if (data.type === 'price') {
            this.handlePriceUpdate(data)
          } else if (data.type === 'batch') {
            // Batch update for multiple prices
            for (const price of data.prices) {
              this.handlePriceUpdate(price)
            }
          }
        } catch (e) {
          console.warn('[HighFreqTicker] Message parse error:', e)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[HighFreqTicker] WebSocket error:', error)
        this.isConnecting = false
      }

      this.ws.onclose = () => {
        console.warn('[HighFreqTicker] WebSocket closed, attempting reconnect')
        this.isConnecting = false
        this.ws = null
        this.attemptReconnect()
      }
    } catch (e) {
      console.error('[HighFreqTicker] Failed to create WebSocket:', e)
      this.isConnecting = false
      this.attemptReconnect()
    }
  }

  /**
   * Private: Handle individual price update
   */
  private handlePriceUpdate(data: any): void {
    if (!data.symbol || typeof data.price !== 'number') return

    const symbol = data.symbol.toUpperCase()
    const price = data.price

    // Update local cache
    const old = this.prices.get(symbol)
    this.prices.set(symbol, {
      symbol,
      price,
      bid: data.bid ?? price * 0.999,
      ask: data.ask ?? price * 1.001,
      lastUpdate: data.timestamp ?? Date.now(),
      volume24h: data.volume24h,
      change24h: data.change24h,
      high24h: data.high24h,
      low24h: data.low24h,
    })

    // Buffer price for realTimePrice system (batched every 50ms)
    this.priceBuffer.set(symbol, {
      coinId: data.coinId ?? symbol.toLowerCase(),
      symbol,
      price,
      change24h: data.change24h ?? 0,
      changePercent24h: data.changePercent24h ?? 0,
      timestamp: data.timestamp ?? Date.now(),
    })

    // Notify chart listeners immediately (ms-level)
    const chartListeners = this.chartListeners.get(symbol)
    if (chartListeners && chartListeners.size > 0) {
      const timestamp = data.timestamp ?? Date.now()
      for (const listener of chartListeners) {
        try {
          listener(symbol, price, timestamp)
        } catch (e) {
          console.error('[HighFreqTicker] Chart listener error:', e)
        }
      }
    }

    // Notify general listeners (batched)
    if (this.listeners.size > 0 && !this.shouldThrottle()) {
      for (const listener of this.listeners) {
        try {
          listener(new Map(this.prices))
        } catch (e) {
          console.error('[HighFreqTicker] Listener error:', e)
        }
      }
    }
  }

  /**
   * Private: Throttle general listener updates (every 100ms)
   */
  private shouldThrottle(): boolean {
    const now = Date.now()
    if (now - this.lastFlushTime < 100) return true
    this.lastFlushTime = now
    return false
  }

  /**
   * Private: Batch flush buffered prices to realTimePrice system
   */
  private flushPrices(): void {
    if (this.priceBuffer.size === 0) return

    const updates = Array.from(this.priceBuffer.values())
    realTimePrice.updatePrices(updates)
    this.priceBuffer.clear()
  }

  /**
   * Private: Attempt to reconnect after failure
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[HighFreqTicker] Max reconnect attempts reached, giving up')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)

    console.log(`[HighFreqTicker] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.initWebSocket()
    }, delay)
  }

  /**
   * Close and cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.prices.clear()
    this.listeners.clear()
    this.chartListeners.clear()
    this.subscriptionIds.clear()
    this.priceBuffer.clear()
  }
}

export const highFreqTicker = new HighFrequencyTicker()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    highFreqTicker.destroy()
  })
}
