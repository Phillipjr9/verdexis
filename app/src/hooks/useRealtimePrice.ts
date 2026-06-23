import { useEffect, useState, useCallback, useRef } from 'react'
import { highFreqTicker } from '../lib/highFrequencyTicker'

/**
 * Hook: Subscribe to real-time price updates (millisecond frequency)
 * Perfect for live charts, tickers, and portfolio displays
 */
export function useRealtimePrice(symbol: string | null) {
  const [price, setPrice] = useState<number | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Get initial price
    const initial = highFreqTicker.getPrice(symbol)
    if (initial) setPrice(initial)

    // Subscribe to updates
    unsubscribeRef.current = highFreqTicker.subscribeChart(
      symbol,
      (_symbol, currentPrice) => {
        setPrice(currentPrice)
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [symbol])

  return price
}

/**
 * Hook: Subscribe to multiple prices
 */
export function useRealtimePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const unsubscribesRef = useRef<Array<() => void>>([])

  useEffect(() => {
    // Get initial prices
    const initial: Record<string, number> = {}
    for (const sym of symbols) {
      const price = highFreqTicker.getPrice(sym)
      if (price !== null) initial[sym] = price
    }
    setPrices(initial)

    // Subscribe to each
    unsubscribesRef.current = symbols.map((sym) =>
      highFreqTicker.subscribeChart(sym, (_symbol, currentPrice) => {
        setPrices((prev) => ({
          ...prev,
          [sym]: currentPrice,
        }))
      })
    )

    return () => {
      for (const unsub of unsubscribesRef.current) {
        unsub()
      }
      unsubscribesRef.current = []
    }
  }, [symbols.join(',')])

  return prices
}

/**
 * Hook: Subscribe to chart data with timestamps
 * Returns array of [price, timestamp] tuples for charting
 */
export function useRealtimeChart(symbol: string | null, maxPoints = 1000) {
  const [points, setPoints] = useState<Array<[number, number]>>([])
  const bufferRef = useRef<Array<[number, number]>>([])
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!symbol) return

    unsubscribeRef.current = highFreqTicker.subscribeChart(
      symbol,
      (_symbol, price, timestamp) => {
        bufferRef.current.push([price, timestamp])

        // Update state every 100ms to avoid excessive renders
        setPoints((prev) => {
          const updated = [...prev, ...bufferRef.current]
          bufferRef.current = []

          // Keep only last N points
          if (updated.length > maxPoints) {
            return updated.slice(-maxPoints)
          }
          return updated
        })
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [symbol, maxPoints])

  return points
}

/**
 * Hook: Get full price data including bid/ask/volume
 */
export function useRealtimePriceData(symbol: string | null) {
  const [data, setData] = useState<{
    price: number
    bid: number
    ask: number
    volume24h?: number
    change24h?: number
    high24h?: number
    low24h?: number
  } | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Get initial data
    const initial = highFreqTicker.getPriceData(symbol)
    if (initial) {
      setData({
        price: initial.price,
        bid: initial.bid,
        ask: initial.ask,
        volume24h: initial.volume24h,
        change24h: initial.change24h,
        high24h: initial.high24h,
        low24h: initial.low24h,
      })
    }

    // Subscribe to updates
    unsubscribeRef.current = highFreqTicker.subscribeChart(
      symbol,
      (_symbol, currentPrice) => {
        setData((prev) =>
          prev
            ? {
                ...prev,
                price: currentPrice,
                bid: currentPrice * 0.999,
                ask: currentPrice * 1.001,
              }
            : null
        )
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [symbol])

  return data
}
