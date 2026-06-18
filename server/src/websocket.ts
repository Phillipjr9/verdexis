import WebSocket, { WebSocketServer } from 'ws'
import https from 'node:https'
import { env } from './env.js'

interface PriceUpdate {
  symbol: string
  price: number
  timestamp: number
}

interface ClientSubscription {
  symbols: Set<string>
  ws: WebSocket
}

class PriceStreamManager {
  private clients = new Map<WebSocket, ClientSubscription>()
  private finnhubWs: WebSocket | null = null
  private coinbaseWs: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private priceCache = new Map<string, PriceUpdate>()
  private subscriptions = new Map<string, Set<WebSocket>>()

  constructor() {}

  public connectClients(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket) => {
      const subscription: ClientSubscription = {
        symbols: new Set(),
        ws,
      }
      this.clients.set(ws, subscription)

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleClientMessage(ws, msg)
        } catch (err) {
          console.warn('[websocket] parse error:', err)
        }
      })

      ws.on('close', () => {
        this.clients.delete(ws)
        for (const symbols of this.subscriptions.values()) {
          symbols.delete(ws)
        }
      })

      ws.on('error', (err) => {
        console.error('[websocket] client error:', err)
      })
    })
  }

  private handleClientMessage(ws: WebSocket, msg: unknown) {
    const m = msg as { action?: string; symbols?: string[] }
    if (m.action === 'subscribe') {
      const symbols = m.symbols || []
      const sub = this.clients.get(ws)
      if (!sub) return

      for (const symbol of symbols) {
        sub.symbols.add(symbol)
        if (!this.subscriptions.has(symbol)) {
          this.subscriptions.set(symbol, new Set())
        }
        this.subscriptions.get(symbol)!.add(ws)
        
        // Send cached price if available
        const cached = this.priceCache.get(symbol)
        if (cached) {
          ws.send(JSON.stringify({ type: 'price', data: cached }), (err) => {
            if (err) console.warn('[websocket] send error:', err)
          })
        }
      }
      
      this.ensureUpstreamConnections()
    } else if (m.action === 'unsubscribe') {
      const symbols = m.symbols || []
      const sub = this.clients.get(ws)
      if (!sub) return

      for (const symbol of symbols) {
        sub.symbols.delete(symbol)
        this.subscriptions.get(symbol)?.delete(ws)
      }
    }
  }

  private ensureUpstreamConnections() {
    // Only connect if we have subscribers
    const totalSubscribers = Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0)
    if (totalSubscribers === 0) return

    if (!this.finnhubWs && env.FINNHUB_API_KEY) {
      this.connectFinnhub()
    }
    if (!this.coinbaseWs) {
      this.connectCoinbase()
    }
  }

  private connectFinnhub() {
    try {
      this.finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${env.FINNHUB_API_KEY}`)
      
      this.finnhubWs.on('open', () => {
        console.log('[websocket] Finnhub connected')
        this.reconnectAttempts = 0
        
        // Subscribe to symbols our clients want
        for (const symbol of this.subscriptions.keys()) {
          this.finnhubWs?.send(JSON.stringify({ type: 'subscribe', symbol }))
        }
      })

      this.finnhubWs.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; data?: Array<{ s?: string; c?: number }> }
          if (msg.type === 'trade' && msg.data?.length > 0) {
            for (const trade of msg.data) {
              if (trade.s && typeof trade.c === 'number') {
                this.broadcastPrice({
                  symbol: trade.s,
                  price: trade.c,
                  timestamp: Date.now(),
                })
              }
            }
          }
        } catch (err) {
          console.warn('[websocket] finnhub parse error:', err)
        }
      })

      this.finnhubWs.on('close', () => {
        console.log('[websocket] Finnhub closed')
        this.finnhubWs = null
        this.reconnectFinnhub()
      })

      this.finnhubWs.on('error', (err) => {
        console.warn('[websocket] Finnhub error:', err)
      })
    } catch (err) {
      console.error('[websocket] Finnhub connect failed:', err)
    }
  }

  private reconnectFinnhub() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[websocket] Max Finnhub reconnect attempts reached')
      return
    }
    this.reconnectAttempts++
    setTimeout(() => {
      const totalSubscribers = Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0)
      if (totalSubscribers > 0) {
        this.connectFinnhub()
      }
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1))
  }

  private connectCoinbase() {
    try {
      this.coinbaseWs = new WebSocket('wss://ws-feed.exchange.coinbase.com')
      
      this.coinbaseWs.on('open', () => {
        console.log('[websocket] Coinbase connected')
        
        // Subscribe to product channels
        const products: string[] = []
        for (const symbol of this.subscriptions.keys()) {
          // Map common symbols to Coinbase product IDs
          const product = this.symbolToCoinbaseProduct(symbol)
          if (product) products.push(product)
        }

        if (products.length > 0) {
          this.coinbaseWs?.send(JSON.stringify({
            type: 'subscribe',
            product_ids: products,
            channels: ['ticker'],
          }))
        }
      })

      this.coinbaseWs.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; product_id?: string; price?: string }
          if (msg.type === 'ticker' && msg.product_id && msg.price) {
            const symbol = this.coinbaseProductToSymbol(msg.product_id)
            if (symbol) {
              this.broadcastPrice({
                symbol,
                price: parseFloat(msg.price),
                timestamp: Date.now(),
              })
            }
          }
        } catch (err) {
          console.warn('[websocket] coinbase parse error:', err)
        }
      })

      this.coinbaseWs.on('close', () => {
        console.log('[websocket] Coinbase closed')
        this.coinbaseWs = null
        // Reconnect after delay
        setTimeout(() => {
          const totalSubscribers = Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0)
          if (totalSubscribers > 0) {
            this.connectCoinbase()
          }
        }, 5000)
      })

      this.coinbaseWs.on('error', (err) => {
        console.warn('[websocket] Coinbase error:', err)
      })
    } catch (err) {
      console.error('[websocket] Coinbase connect failed:', err)
    }
  }

  private symbolToCoinbaseProduct(symbol: string): string | null {
    const map: Record<string, string> = {
      bitcoin: 'BTC-USD',
      ethereum: 'ETH-USD',
      solana: 'SOL-USD',
      cardano: 'ADA-USD',
      ripple: 'XRP-USD',
      dogecoin: 'DOGE-USD',
      polkadot: 'DOT-USD',
      chainlink: 'LINK-USD',
      'avalanche-2': 'AVAX-USD',
      litecoin: 'LTC-USD',
      'matic-network': 'MATIC-USD',
      'shiba-inu': 'SHIB-USD',
      uniswap: 'UNI-USD',
    }
    return map[symbol] || null
  }

  private coinbaseProductToSymbol(product: string): string | null {
    const map: Record<string, string> = {
      'BTC-USD': 'bitcoin',
      'ETH-USD': 'ethereum',
      'SOL-USD': 'solana',
      'ADA-USD': 'cardano',
      'XRP-USD': 'ripple',
      'DOGE-USD': 'dogecoin',
      'DOT-USD': 'polkadot',
      'LINK-USD': 'chainlink',
      'AVAX-USD': 'avalanche-2',
      'LTC-USD': 'litecoin',
      'MATIC-USD': 'matic-network',
      'SHIB-USD': 'shiba-inu',
      'UNI-USD': 'uniswap',
    }
    return map[product] || null
  }

  private broadcastPrice(update: PriceUpdate) {
    this.priceCache.set(update.symbol, update)
    const subscribers = this.subscriptions.get(update.symbol)
    if (!subscribers) return

    const payload = JSON.stringify({ type: 'price', data: update })
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload, (err) => {
          if (err) console.warn('[websocket] send error:', err)
        })
      }
    }
  }

  public close() {
    this.finnhubWs?.close()
    this.coinbaseWs?.close()
    for (const ws of this.clients.keys()) {
      ws.close()
    }
  }
}

export const priceStreamManager = new PriceStreamManager()
