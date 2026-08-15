import { portfolioStore } from './portfolioStore'

/**
 * Real-time Price Update System
 * Centralizes market price updates across the entire app.
 * When a price changes, ALL dependent data updates automatically:
 * - Portfolio P&L recalculation
 * - Holdings value updates
 * - Net worth changes
 * - AI insights refresh
 */

export interface PriceUpdate {
  coinId: string
  symbol: string
  price: number
  change24h: number
  changePercent24h: number
  timestamp: number
}

export interface LivePriceMap {
  [key: string]: PriceUpdate
}

// Event names for real-time updates
export const PRICE_UPDATE_EVENT = 'verdexis:price-update'
export const PORTFOLIO_VALUE_CHANGE_EVENT = 'verdexis:portfolio-value-change'

type PriceListener = (prices: LivePriceMap) => void
type PortfolioListener = (portfolio: {
  netWorth: number
  totalPnl: number
  positions: Array<{ symbol: string; value: number; pnl: number; pnlPercent: number }>
}) => void

class RealTimePriceSystem {
  private liveprices: LivePriceMap = {}
  private priceListeners: Set<PriceListener> = new Set()
  private portfolioListeners: Set<PortfolioListener> = new Set()
  private lastPortfolioValue = 0
  private updateInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Subscribe to real-time price updates
   */
  onPriceUpdate(callback: PriceListener): () => void {
    this.priceListeners.add(callback)
    return () => this.priceListeners.delete(callback)
  }

  /**
   * Subscribe to portfolio value changes (P&L updates)
   */
  onPortfolioValueChange(callback: PortfolioListener): () => void {
    this.portfolioListeners.add(callback)
    return () => this.portfolioListeners.delete(callback)
  }

  /**
   * Update a single price and trigger cascading recalculations
   */
  updatePrice(update: PriceUpdate): void {
    const key = update.symbol.toUpperCase()
    const oldPrice = this.liveprices[key]?.price

    this.liveprices[key] = update
    this.liveprices[update.coinId.toLowerCase()] = update

    // Notify price listeners
    this.notifyPriceUpdate()

    // If price actually changed, recalculate portfolio
    if (!oldPrice || oldPrice !== update.price) {
      this.recalculatePortfolio()
    }
  }

  /**
   * Bulk update multiple prices at once
   */
  updatePrices(updates: PriceUpdate[]): void {
    let pricesChanged = false

    for (const update of updates) {
      const key = update.symbol.toUpperCase()
      const oldPrice = this.liveprices[key]?.price

      this.liveprices[key] = update
      this.liveprices[update.coinId.toLowerCase()] = update

      if (!oldPrice || oldPrice !== update.price) {
        pricesChanged = true
      }
    }

    if (updates.length > 0) {
      this.notifyPriceUpdate()
    }

    if (pricesChanged) {
      this.recalculatePortfolio()
    }
  }

  /**
   * Get current price for a symbol or coin ID
   */
  getPrice(symbolOrId: string): number | null {
    const key = symbolOrId.toUpperCase()
    return this.liveprices[key]?.price ?? this.liveprices[symbolOrId.toLowerCase()]?.price ?? null
  }

  /**
   * Get all current prices
   */
  getAllPrices(): LivePriceMap {
    return { ...this.liveprices }
  }

  /**
   * Private: Notify all price update listeners
   */
  private notifyPriceUpdate(): void {
    if (this.priceListeners.size === 0) return

    const snapshot = { ...this.liveprices }
    for (const listener of this.priceListeners) {
      try {
        listener(snapshot)
      } catch (e) {
        console.error('[RealTimePrice] Listener error:', e)
      }
    }
  }

  /**
   * Private: Recalculate portfolio and notify if value changed
   */
  private recalculatePortfolio(): void {
    if (this.portfolioListeners.size === 0) return

    const holdings = portfolioStore.getHoldings()
    const quoteMap = this.liveprices

    // Update portfolio store with new prices
    const quotes: Record<string, number> = {}
    for (const [key, update] of Object.entries(quoteMap)) {
      quotes[key] = update.price
    }
    portfolioStore.markToMarket(quotes)

    // Recalculate portfolio metrics
    const positions = holdings.map(h => {
      const livePrice = quoteMap[h.symbol.toUpperCase()]?.price ?? quoteMap[h.id]?.price ?? h.currentPrice
      const value = h.quantity * livePrice
      const cost = h.avgBuyPrice * h.quantity
      const pnl = value - cost
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0

      return {
        symbol: h.symbol,
        value,
        pnl,
        pnlPercent,
      }
    })

    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)
    const netWorth = portfolioStore.getNetWorth()

    // Only notify if portfolio value actually changed
    if (netWorth !== this.lastPortfolioValue) {
      this.lastPortfolioValue = netWorth

      for (const listener of this.portfolioListeners) {
        try {
          listener({ netWorth, totalPnl, positions })
        } catch (e) {
          console.error('[RealTimePrice] Portfolio listener error:', e)
        }
      }
    }
  }

  /**
   * Start polling for price updates (for testing/demo only - real prices come from liveTicker)
   */
  startPolling(interval: number = 5000): void {
    if (this.updateInterval) clearInterval(this.updateInterval)

    this.updateInterval = setInterval(() => {
      // Real prices come from liveTicker or WebSocket subscriptions.
      // This polling is only a fallback for testing/demo purposes.
      window.dispatchEvent(new Event(PRICE_UPDATE_EVENT))
    }, interval)
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  /**
   * Reset all prices
   */
  reset(): void {
    this.liveprices = {}
    this.lastPortfolioValue = 0
    this.stopPolling()
  }
}

export const realTimePrice = new RealTimePriceSystem()

// Dispatch browser event when prices update
if (typeof window !== 'undefined') {
  realTimePrice.onPriceUpdate(() => {
    window.dispatchEvent(new Event(PRICE_UPDATE_EVENT))
  })

  realTimePrice.onPortfolioValueChange((portfolio) => {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_VALUE_CHANGE_EVENT, { detail: portfolio }))
  })
}
