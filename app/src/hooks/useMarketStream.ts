import { useEffect, useState, useRef, useCallback } from 'react'

interface PriceUpdate {
  symbol: string
  price: number
  timestamp: number
}

type PriceListener = (data: PriceUpdate) => void

class MarketStreamClient {
  private ws: WebSocket | null = null
  private url: string
  private listeners = new Map<string, Set<PriceListener>>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private subscriptions = new Set<string>()

  constructor(url: string) {
    this.url = url
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[market-stream] WebSocket connected')
          this.reconnectAttempts = 0
          this.resubscribe()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'price' && msg.data) {
              const update: PriceUpdate = msg.data
              const listeners = this.listeners.get(update.symbol)
              if (listeners) {
                listeners.forEach((fn) => fn(update))
              }
            }
          } catch (err) {
            console.warn('[market-stream] parse error:', err)
          }
        }

        this.ws.onclose = () => {
          console.log('[market-stream] WebSocket closed')
          this.ws = null
          this.attemptReconnect()
        }

        this.ws.onerror = (err) => {
          console.error('[market-stream] WebSocket error:', err)
          reject(err)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[market-stream] Max reconnect attempts reached')
      return
    }
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    setTimeout(() => {
      if (this.subscriptions.size > 0) {
        this.connect().catch((err) => console.error('[market-stream] reconnect failed:', err))
      }
    }, delay)
  }

  public subscribe(symbols: string[], listener: PriceListener) {
    const newSymbols = symbols.filter((s) => !this.subscriptions.has(s))
    
    for (const symbol of symbols) {
      if (!this.listeners.has(symbol)) {
        this.listeners.set(symbol, new Set())
      }
      this.listeners.get(symbol)!.add(listener)
      this.subscriptions.add(symbol)
    }

    if (newSymbols.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        symbols: newSymbols,
      }))
    }
  }

  public unsubscribe(symbols: string[], listener: PriceListener) {
    for (const symbol of symbols) {
      const listeners = this.listeners.get(symbol)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.listeners.delete(symbol)
          this.subscriptions.delete(symbol)
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              action: 'unsubscribe',
              symbols: [symbol],
            }))
          }
        }
      }
    }
  }

  public close() {
    this.subscriptions.clear()
    this.listeners.clear()
    this.ws?.close()
    this.ws = null
  }
}

let streamClient: MarketStreamClient | null = null

export function useMarketStream(symbols: string[]): Record<string, number | null> {
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const listenerRef = useRef<PriceListener | null>(null)
  const clientRef = useRef<MarketStreamClient | null>(null)

  useEffect(() => {
    const getWsUrl = () => {
      if (typeof window === 'undefined') return null
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const host = window.location.host
      return `${protocol}://${host}`
    }

    const wsUrl = getWsUrl()
    if (!wsUrl) return

    if (!streamClient) {
      streamClient = new MarketStreamClient(wsUrl)
      streamClient.connect().catch((err) => {
        console.error('[market-stream] initial connect failed:', err)
      })
    }

    clientRef.current = streamClient

    const listener: PriceListener = (update) => {
      setPrices((prev) => ({
        ...prev,
        [update.symbol]: update.price,
      }))
    }

    listenerRef.current = listener

    if (symbols.length > 0) {
      streamClient.subscribe(symbols, listener)
    }

    return () => {
      if (listenerRef.current && symbols.length > 0) {
        streamClient?.unsubscribe(symbols, listenerRef.current)
      }
    }
  }, [symbols.join(',')])

  return prices
}

export function useMarketStreamSingle(symbol: string | null): number | null {
  const symbols = symbol ? [symbol] : []
  const prices = useMarketStream(symbols)
  return symbol ? (prices[symbol] ?? null) : null
}
