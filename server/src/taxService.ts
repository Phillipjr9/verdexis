import { prisma } from '../db.js'

interface TaxLot {
  id: string
  symbol: string
  quantity: number
  costBasis: number
  dateAcquired: Date
  method: 'FIFO' | 'LIFO' | 'SPECIFIC'
}

interface TaxableEvent {
  date: Date
  symbol: string
  quantity: number
  proceeds: number
  costBasis: number
  gainLoss: number
  type: 'SHORT_TERM' | 'LONG_TERM'
}

interface WashSale {
  originalSaleId: string
  disallowedLoss: number
  dateOfSale: Date
  repurchaseDate: Date
  reclassifiedTo: string
}

export class TaxService {
  static isLongTerm(dateAcquired: Date, dateSold: Date): boolean {
    const daysDiff = (dateSold.getTime() - dateAcquired.getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff >= 365
  }

  static selectLotsWithFIFO(holdings: TaxLot[], quantitySold: number): TaxLot[] {
    return holdings.sort((a, b) => a.dateAcquired.getTime() - b.dateAcquired.getTime()).slice(0, quantitySold)
  }

  static selectLotsWithLIFO(holdings: TaxLot[], quantitySold: number): TaxLot[] {
    return holdings.sort((a, b) => b.dateAcquired.getTime() - a.dateAcquired.getTime()).slice(0, quantitySold)
  }

  static selectLotsWithAverage(holdings: TaxLot[], quantitySold: number): TaxLot[] {
    const totalCost = holdings.reduce((sum, lot) => sum + lot.costBasis * lot.quantity, 0)
    const totalQty = holdings.reduce((sum, lot) => sum + lot.quantity, 0)
    const avgCost = totalCost / totalQty

    return [
      {
        id: 'avg-lot',
        symbol: holdings[0].symbol,
        quantity: quantitySold,
        costBasis: avgCost,
        dateAcquired: new Date(),
        method: 'SPECIFIC',
      },
    ]
  }

  static calculateGainLoss(proceeds: number, costBasis: number, quantity: number): { gain: number; loss: number } {
    const totalProceeds = proceeds * quantity
    const totalCost = costBasis * quantity
    const netGain = totalProceeds - totalCost

    return {
      gain: netGain > 0 ? netGain : 0,
      loss: netGain < 0 ? -netGain : 0,
    }
  }

  static detectWashSales(trades: Array<{ date: Date; side: 'buy' | 'sell'; symbol: string; quantity: number }>, symbol: string): WashSale[] {
    const sales = trades.filter((t) => t.side === 'sell' && t.symbol === symbol && t.date)
    const purchases = trades.filter((t) => t.side === 'buy' && t.symbol === symbol && t.date)
    const washSales: WashSale[] = []

    for (const sale of sales) {
      const relevantPurchases = purchases.filter((p) => {
        const daysDiff = Math.abs((p.date.getTime() - sale.date.getTime()) / (1000 * 60 * 60 * 24))
        return daysDiff <= 30
      })

      if (relevantPurchases.length > 0) {
        washSales.push({
          originalSaleId: `sale-${sale.date.getTime()}`,
          disallowedLoss: 0,
          dateOfSale: sale.date,
          repurchaseDate: relevantPurchases[0].date,
          reclassifiedTo: `purchase-${relevantPurchases[0].date.getTime()}`,
        })
      }
    }

    return washSales
  }

  static async generateForm8949(userId: string, year: number) {
    const startDate = new Date(`${year}-01-01`)
    const endDate = new Date(`${year}-12-31`)

    const trades = await prisma.trade.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const salesOnly = trades.filter((t) => t.side === 'sell')
    const form8949Entries = salesOnly.map((trade) => ({
      description: `${trade.amount} ${trade.symbol.toUpperCase()}`,
      dateAcquired: new Date(trade.createdAt).toLocaleDateString(),
      dateSold: new Date(trade.createdAt).toLocaleDateString(),
      proceeds: trade.total,
      costBasis: trade.amount * trade.price,
      adjustedGainLoss: trade.total - trade.amount * trade.price,
      term: 'SHORT' as const,
    }))

    return {
      year,
      entries: form8949Entries,
      totalProceeds: form8949Entries.reduce((sum, e) => sum + e.proceeds, 0),
      totalCostBasis: form8949Entries.reduce((sum, e) => sum + e.costBasis, 0),
      totalGainLoss: form8949Entries.reduce((sum, e) => sum + e.adjustedGainLoss, 0),
    }
  }

  static async exportToCSV(userId: string, year: number): Promise<string> {
    const form8949 = await TaxService.generateForm8949(userId, year)

    let csv = 'Date Acquired,Date Sold,Description,Proceeds,Cost Basis,Gain/Loss,Term\n'

    for (const entry of form8949.entries) {
      const line = `${entry.dateAcquired},${entry.dateSold},"${entry.description}",${entry.proceeds},${entry.costBasis},${entry.adjustedGainLoss},${entry.term}\n`
      csv += line
    }

    csv += `\n,,TOTAL PROCEEDS,${form8949.totalProceeds},TOTAL COST,${form8949.totalCostBasis},${form8949.totalGainLoss}\n`

    return csv
  }
}
