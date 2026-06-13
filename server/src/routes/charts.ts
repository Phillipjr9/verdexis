import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

// OHLCV data point
interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Fetch OHLC data from market data service (Coinbase, CoinGecko)
async function fetchOHLC(symbol: string, timeframe: string, days: number): Promise<Candle[]> {
  // Map timeframe to granularity (in seconds for Coinbase)
  const granularityMap: Record<string, number> = {
    '1': 60,        // 1 minute
    '5': 300,       // 5 minutes
    '15': 900,      // 15 minutes
    '30': 1800,     // 30 minutes
    '1H': 3600,     // 1 hour
    '4H': 14400,    // 4 hours
    '1D': 86400,    // 1 day
    '1W': 604800,   // 1 week
    '1M': 2592000,  // 1 month
  }

  const granularity = granularityMap[timeframe] || 3600

  try {
    // Try CoinGecko for rich OHLC data
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${symbol}/ohlc?vs_currency=usd&days=${days}`,
    )
    const data: number[][] = await response.json()

    return data.map((candle) => ({
      time: Math.floor(candle[0] / 1000), // Convert ms to seconds
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: 0, // CoinGecko doesn't provide volume in free tier
    }))
  } catch (err) {
    console.error('[charts] OHLC fetch error:', err)
    return []
  }
}

// GET /api/charts/ohlc?symbol=bitcoin&timeframe=1D&days=365
router.get('/ohlc', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'bitcoin').toLowerCase()
  const timeframe = ((req.query.timeframe as string) || '1D').toUpperCase()
  const days = Math.min(365, Math.max(1, parseInt((req.query.days as string) || '30', 10)))

  try {
    const candles = await fetchOHLC(symbol, timeframe, days)

    if (candles.length === 0) {
      res.status(404).json({ error: 'No OHLC data available' })
      return
    }

    res.set('Cache-Control', 'public, max-age=60')
    res.json({
      symbol,
      timeframe,
      candles,
      count: candles.length,
      range: {
        from: candles[0].time,
        to: candles[candles.length - 1].time,
      },
    })
  } catch (err) {
    console.error('[charts] error:', err)
    res.status(500).json({ error: 'Failed to fetch chart data' })
  }
})

// GET /api/charts/info?symbol=bitcoin
// Get symbol info for chart display
router.get('/info', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'bitcoin').toLowerCase()

  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${symbol}`)
    const data = (await response.json()) as {
      id: string
      name: string
      symbol: string
      image?: { large?: string }
      market_data?: { current_price?: { usd?: number } }
    }

    res.json({
      id: data.id,
      name: data.name,
      symbol: data.symbol.toUpperCase(),
      logo: data.image?.large,
      currentPrice: data.market_data?.current_price?.usd,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch symbol info' })
  }
})

// POST /api/charts/saved-views
// Save user's chart view (zoom, timeframe, indicators)
router.post('/saved-views', async (req, res) => {
  const { userId, name, symbol, timeframe, indicators } = req.body

  if (!userId || !name || !symbol) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  try {
    // Store in AppSetting or create ChartView model
    const key = `chart-view:${userId}:${symbol}`
    await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify({ name, timeframe, indicators, savedAt: new Date() }),
      },
      update: {
        value: JSON.stringify({ name, timeframe, indicators, savedAt: new Date() }),
      },
    })

    res.json({ ok: true, key })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save chart view' })
  }
})

export default router
