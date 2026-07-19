import axios from 'axios'
import { prisma } from './db.js'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const CACHE_TTL = 60 * 1000 // 1 minute

interface PriceCache {
  [key: string]: {
    price: number
    timestamp: number
  }
}

const priceCache: PriceCache = {}

export async function getPriceFromCoinGecko(symbol: string): Promise<number | null> {
  try {
    // Check cache first
    const cached = priceCache[symbol.toUpperCase()]
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.price
    }

    // Map common symbols to CoinGecko IDs
    const symbolMap: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      USDC: 'usd-coin',
      USDT: 'tether',
      BNB: 'binancecoin',
      XRP: 'ripple',
      ADA: 'cardano',
      SOL: 'solana',
      DOGE: 'dogecoin',
      MATIC: 'matic-network',
      LINK: 'chainlink',
      AVAX: 'avalanche-2',
      ATOM: 'cosmos',
      NEAR: 'near',
      FTM: 'fantom',
      ARB: 'arbitrum',
      OP: 'optimism',
      LTC: 'litecoin',
      BCH: 'bitcoin-cash',
      XLM: 'stellar',
    }

    const coinId = symbolMap[symbol.toUpperCase()] || symbol.toLowerCase()

    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: 'usd',
      },
      timeout: 5000,
    })

    const price = response.data[coinId]?.usd
    if (price) {
      priceCache[symbol.toUpperCase()] = {
        price,
        timestamp: Date.now(),
      }
      return price
    }

    return null
  } catch (error) {
    console.error(`[price-service] Error fetching price for ${symbol}:`, error)
    return null
  }
}

export async function getPricesBatch(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}

  // Get unique symbols
  const uniqueSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))]

  // Check cache first
  const uncachedSymbols = uniqueSymbols.filter((symbol) => {
    const cached = priceCache[symbol]
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      prices[symbol] = cached.price
      return false
    }
    return true
  })

  if (uncachedSymbols.length === 0) {
    return prices
  }

  try {
    const symbolMap: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      USDC: 'usd-coin',
      USDT: 'tether',
      BNB: 'binancecoin',
      XRP: 'ripple',
      ADA: 'cardano',
      SOL: 'solana',
      DOGE: 'dogecoin',
      MATIC: 'matic-network',
      LINK: 'chainlink',
      AVAX: 'avalanche-2',
      ATOM: 'cosmos',
      NEAR: 'near',
      FTM: 'fantom',
      ARB: 'arbitrum',
      OP: 'optimism',
      LTC: 'litecoin',
      BCH: 'bitcoin-cash',
      XLM: 'stellar',
    }

    const coinIds = uncachedSymbols.map((s) => symbolMap[s] || s.toLowerCase()).join(',')

    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: coinIds,
        vs_currencies: 'usd',
      },
      timeout: 5000,
    })

    uncachedSymbols.forEach((symbol) => {
      const coinId = symbolMap[symbol] || symbol.toLowerCase()
      const price = response.data[coinId]?.usd

      if (price) {
        prices[symbol] = price
        priceCache[symbol] = {
          price,
          timestamp: Date.now(),
        }
      }
    })

    return prices
  } catch (error) {
    console.error('[price-service] Error fetching batch prices:', error)
    return prices
  }
}

export async function updatePortfolioWithLivePrice(userId: string): Promise<{
  totalInvested: number
  currentValue: number
  totalGainLoss: number
  totalGainLossPercent: number
}> {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId },
    })

    if (holdings.length === 0) {
      return {
        totalInvested: 0,
        currentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
      }
    }

    // Get live prices
    const symbols = holdings.map((h) => h.symbol)
    const prices = await getPricesBatch(symbols)

    let totalInvested = 0
    let currentValue = 0

    holdings.forEach((holding) => {
      const invested = holding.amount * holding.avgPrice
      const livePrice = prices[holding.symbol.toUpperCase()] || holding.avgPrice
      const value = holding.amount * livePrice

      totalInvested += invested
      currentValue += value
    })

    const totalGainLoss = currentValue - totalInvested
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

    // Update portfolio
    await prisma.investmentPortfolio.upsert({
      where: { userId },
      create: {
        userId,
        totalInvested,
        currentValue,
        totalGainLoss,
        totalGainLossPercent,
      },
      update: {
        totalInvested,
        currentValue,
        totalGainLoss,
        totalGainLossPercent,
      },
    })

    return {
      totalInvested,
      currentValue,
      totalGainLoss,
      totalGainLossPercent,
    }
  } catch (error) {
    console.error('[price-service] Error updating portfolio:', error)
    throw error
  }
}

export async function trackPriceHistory(): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: { id: true },
    })

    for (const user of users) {
      const holdings = await prisma.holding.findMany({
        where: { userId: user.id },
      })

      if (holdings.length === 0) continue

      const symbols = holdings.map((h) => h.symbol)
      const prices = await getPricesBatch(symbols)

      let totalWorthUsd = 0
      holdings.forEach((holding) => {
        const livePrice = prices[holding.symbol.toUpperCase()] || holding.avgPrice
        totalWorthUsd += holding.amount * livePrice
      })

      // Create balance history snapshot
      await prisma.balanceHistory.create({
        data: {
          userId: user.id,
          currency: 'USD',
          balance: totalWorthUsd,
          available: totalWorthUsd,
          totalWorthUsd,
        },
      })
    }

    console.log('[price-service] Price history tracked for all users')
  } catch (error) {
    console.error('[price-service] Error tracking price history:', error)
  }
}

export async function checkPriceAlerts(): Promise<void> {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { active: true, triggered: false },
      include: { user: true },
    })

    for (const alert of alerts) {
      const price = await getPriceFromCoinGecko(alert.symbol)
      if (!price) continue

      let shouldTrigger = false

      if (alert.direction === 'above' && price >= alert.target) {
        shouldTrigger = true
      } else if (alert.direction === 'below' && price <= alert.target) {
        shouldTrigger = true
      }

      if (shouldTrigger) {
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: {
            triggered: true,
            triggeredAt: new Date(),
          },
        })

        // Create notification
        await prisma.notification.create({
          data: {
            userId: alert.userId,
            kind: 'price_alert',
            title: `Price Alert: ${alert.symbol}`,
            body: `${alert.symbol} has reached ${price} USD (target: ${alert.target})`,
          },
        })
      }
    }

    console.log('[price-service] Price alerts checked')
  } catch (error) {
    console.error('[price-service] Error checking price alerts:', error)
  }
}

export function clearPriceCache(): void {
  Object.keys(priceCache).forEach((key) => {
    delete priceCache[key]
  })
  console.log('[price-service] Price cache cleared')
}
