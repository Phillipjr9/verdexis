import { prisma } from '../db.js'
import { getCurrentCryptoPrice } from '../historicalPrice.js'

export interface TaxLossHarvestingOpportunity {
  symbol: string
  currentPrice: number
  costBasis: number
  unrealizedLoss: number
  unrealizedLossPercent: number
  holdingPeriod: 'short' | 'long'
  recommendation: string
}

export interface TaxReport {
  year: number
  shortTermGains: number
  longTermGains: number
  shortTermLosses: number
  longTermLosses: number
  netCapitalGain: number
  washSaleLosses: number
  form8949Data: Form8949Entry[]
  scheduleDData: ScheduleDEntry[]
}

export interface Form8949Entry {
  description: string
  dateAcquired: string
  dateSold: string
  proceeds: number
  costBasis: number
  gain: number
  code: string
}

export interface ScheduleDEntry {
  shortTermGains: number
  shortTermLosses: number
  longTermGains: number
  longTermLosses: number
  netCapitalGain: number
}

/**
 * Tax Optimization Service
 * Identifies tax-loss harvesting opportunities and generates tax reports
 */
export class TaxOptimizationService {
  /**
   * Find tax-loss harvesting opportunities
   */
  async findTaxLossHarvestingOpportunities(userId: string): Promise<TaxLossHarvestingOpportunity[]> {
    const holdings = await prisma.holding.findMany({
      where: { userId }
    })

    const opportunities: TaxLossHarvestingOpportunity[] = []

    for (const holding of holdings) {
      // Get current price from CoinGecko
      const currentPrice = await this.getCurrentPrice(holding.symbol)
      const costBasis = holding.avgPrice * holding.amount
      const currentValue = currentPrice * holding.amount
      const unrealizedLoss = currentValue - costBasis

      // Only include if there's a loss
      if (unrealizedLoss >= 0) continue

      // Determine holding period
      const holdingDays = (Date.now() - new Date(holding.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      const holdingPeriod = holdingDays > 365 ? 'long' : 'short'

      const unrealizedLossPercent = (unrealizedLoss / costBasis) * 100

      // Generate recommendation
      let recommendation = ''
      if (unrealizedLossPercent < -10) {
        recommendation = `Significant loss (${unrealizedLossPercent.toFixed(1)}%). Consider harvesting to offset gains.`
      } else if (unrealizedLossPercent < -5) {
        recommendation = `Moderate loss (${unrealizedLossPercent.toFixed(1)}%). May be worth harvesting.`
      } else {
        recommendation = `Minor loss (${unrealizedLossPercent.toFixed(1)}%). Monitor for larger losses.`
      }

      opportunities.push({
        symbol: holding.symbol,
        currentPrice,
        costBasis: holding.avgPrice,
        unrealizedLoss,
        unrealizedLossPercent,
        holdingPeriod,
        recommendation
      })
    }

    return opportunities.sort((a, b) => a.unrealizedLoss - b.unrealizedLoss)
  }

  /**
   * Execute tax-loss harvest
   */
  async executeTaxLossHarvest(
    userId: string,
    symbol: string,
    quantity: number
  ): Promise<{ success: boolean; message: string; harvestedLoss: number }> {
    try {
      const holding = await prisma.holding.findUnique({
        where: { userId_symbol: { userId, symbol } }
      })

      if (!holding || holding.amount < quantity) {
        return {
          success: false,
          message: 'Insufficient holdings',
          harvestedLoss: 0
        }
      }

      const currentPrice = await this.getCurrentPrice(symbol)
      const costBasis = holding.avgPrice * quantity
      const currentValue = currentPrice * quantity
      const harvestedLoss = currentValue - costBasis

      // Record the sale
      await prisma.trade.create({
        data: {
          userId,
          symbol,
          side: 'sell',
          amount: quantity,
          price: currentPrice,
          total: currentValue
        }
      })

      // Update holding
      await prisma.holding.update({
        where: { userId_symbol: { userId, symbol } },
        data: {
          amount: { decrement: quantity }
        }
      })

      // Record transaction
      await prisma.transaction.create({
        data: {
          userId,
          kind: 'withdraw',
          currency: symbol,
          amount: -quantity,
          status: 'completed',
          reference: `Tax-loss harvest: ${symbol}`,
          subType: 'tax_loss_harvest'
        }
      })

      return {
        success: true,
        message: `Harvested ${quantity} ${symbol} for a loss of $${Math.abs(harvestedLoss).toFixed(2)}`,
        harvestedLoss
      }
    } catch (error) {
      return {
        success: false,
        message: `Error executing harvest: ${error instanceof Error ? error.message : 'Unknown error'}`,
        harvestedLoss: 0
      }
    }
  }

  /**
   * Check for wash sales
   */
  async checkForWashSales(userId: string, symbol: string, saleDate: Date): Promise<boolean> {
    // Wash sale rule: can't buy same security 30 days before or after sale
    const thirtyDaysBefore = new Date(saleDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    const thirtyDaysAfter = new Date(saleDate.getTime() + 30 * 24 * 60 * 60 * 1000)

    const purchases = await prisma.trade.findMany({
      where: {
        userId,
        symbol,
        side: 'buy',
        createdAt: {
          gte: thirtyDaysBefore,
          lte: thirtyDaysAfter
        }
      }
    })

    return purchases.length > 0
  }

  /**
   * Generate tax report for year
   */
  async generateTaxReport(userId: string, year: number): Promise<TaxReport> {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    // Get all trades for the year
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate }
      },
      orderBy: { createdAt: 'asc' }
    })

    let shortTermGains = 0
    let longTermGains = 0
    let shortTermLosses = 0
    let longTermLosses = 0
    let washSaleLosses = 0

    const form8949Data: Form8949Entry[] = []

    for (const trade of trades) {
      if (trade.side !== 'sell') continue

      // Find corresponding purchase
      const purchase = await prisma.trade.findFirst({
        where: {
          userId,
          symbol: trade.symbol,
          side: 'buy',
          createdAt: { lt: trade.createdAt }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (!purchase) continue

      const proceeds = trade.total
      const costBasis = purchase.price * trade.amount
      const gain = proceeds - costBasis

      // Determine holding period
      const holdingDays = (trade.createdAt.getTime() - purchase.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      const isLongTerm = holdingDays > 365

      // Check for wash sale
      const isWashSale = await this.checkForWashSales(userId, trade.symbol, trade.createdAt)

      if (isWashSale) {
        washSaleLosses += Math.min(0, gain)
      } else {
        if (isLongTerm) {
          if (gain > 0) longTermGains += gain
          else longTermLosses += Math.abs(gain)
        } else {
          if (gain > 0) shortTermGains += gain
          else shortTermLosses += Math.abs(gain)
        }
      }

      form8949Data.push({
        description: trade.symbol,
        dateAcquired: purchase.createdAt.toISOString().split('T')[0] ?? '',
        dateSold: trade.createdAt.toISOString().split('T')[0] ?? '',
        proceeds,
        costBasis,
        gain,
        code: isLongTerm ? 'L' : 'S'
      })
    }

    const netCapitalGain = (shortTermGains - shortTermLosses) + (longTermGains - longTermLosses)

    return {
      year,
      shortTermGains,
      longTermGains,
      shortTermLosses,
      longTermLosses,
      netCapitalGain,
      washSaleLosses,
      form8949Data,
      scheduleDData: [{
        shortTermGains,
        shortTermLosses,
        longTermGains,
        longTermLosses,
        netCapitalGain
      }]
    }
  }

  /**
   * Generate Form 8949 CSV export
   */
  async generateForm8949CSV(userId: string, year: number): Promise<string> {
    const report = await this.generateTaxReport(userId, year)

    const headers = ['Description', 'Date Acquired', 'Date Sold', 'Proceeds', 'Cost Basis', 'Gain/Loss', 'Code']
    const rows = report.form8949Data.map(entry => [
      entry.description,
      entry.dateAcquired,
      entry.dateSold,
      entry.proceeds.toFixed(2),
      entry.costBasis.toFixed(2),
      entry.gain.toFixed(2),
      entry.code
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csv
  }

  /**
   * Generate Schedule D CSV export
   */
  async generateScheduleDCSV(userId: string, year: number): Promise<string> {
    const report = await this.generateTaxReport(userId, year)
    const data = report.scheduleDData[0]

    if (!data) return ''

    const csv = `Schedule D Summary for ${year}
Short-Term Capital Gains,${data.shortTermGains.toFixed(2)}
Short-Term Capital Losses,${data.shortTermLosses.toFixed(2)}
Long-Term Capital Gains,${data.longTermGains.toFixed(2)}
Long-Term Capital Losses,${data.longTermLosses.toFixed(2)}
Net Capital Gain/Loss,${data.netCapitalGain.toFixed(2)}`

    return csv
  }

  /**
   * Get tax-loss harvesting recommendations
   */
  async getTaxRecommendations(userId: string): Promise<string[]> {
    const recommendations: string[] = []

    const opportunities = await this.findTaxLossHarvestingOpportunities(userId)
    const totalLosses = opportunities.reduce((sum, opp) => sum + opp.unrealizedLoss, 0)

    if (totalLosses < -5000) {
      recommendations.push(`You have $${Math.abs(totalLosses).toFixed(2)} in unrealized losses. Consider tax-loss harvesting to offset gains.`)
    }

    // Check for wash sales
    const trades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    for (const trade of trades) {
      if (trade.side === 'sell' && trade.total < 0) {
        const isWashSale = await this.checkForWashSales(userId, trade.symbol, trade.createdAt)
        if (isWashSale) {
          recommendations.push(`Potential wash sale detected for ${trade.symbol}. Verify 30-day rule compliance.`)
          break
        }
      }
    }

    // Check for long-term vs short-term gains
    const currentYear = new Date().getFullYear()
    const report = await this.generateTaxReport(userId, currentYear)

    if (report.shortTermGains > report.longTermGains * 2) {
      recommendations.push('You have significant short-term gains. Consider holding positions longer for lower tax rates.')
    }

    return recommendations.length > 0 ? recommendations : ['Your tax position looks optimized.']
  }

  /**
   * Helper: Get current price from CoinGecko with 5-minute cache
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    const price = await getCurrentCryptoPrice(symbol)
    if (price === null) {
      console.warn(`[tax] Could not fetch price for ${symbol}, using fallback`)
      return 100 // Fallback to prevent crashes, but log the issue
    }
    return price
  }
}

export const taxOptimizationService = new TaxOptimizationService()
