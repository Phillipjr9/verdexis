import { prisma } from '../db.js'

export interface TaxReport {
  year: number
  totalIncome: number
  totalExpenses: number
  capitalGains: number
  capitalLosses: number
  netIncome: number
  transactions: any[]
}

export class DataExportService {
  /**
   * Export transactions as CSV
   */
  static async exportTransactionsCSV(userId: string, startDate?: Date, endDate?: Date): Promise<string> {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    })

    const headers = ['Date', 'Type', 'Currency', 'Amount', 'Status', 'Reference', 'Fee']
    const rows = transactions.map(t => [
      t.createdAt.toISOString().split('T')[0],
      t.kind,
      t.currency,
      t.amount.toFixed(2),
      t.status,
      t.reference || '',
      t.subType || '',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

    return csv
  }

  /**
   * Export holdings as CSV
   */
  static async exportHoldingsCSV(userId: string): Promise<string> {
    const holdings = await prisma.holding.findMany({
      where: { userId },
      orderBy: { symbol: 'asc' },
    })

    const headers = ['Symbol', 'Name', 'Amount', 'Avg Price', 'Total Cost', 'Type']
    const rows = holdings.map(h => [
      h.symbol,
      h.name,
      h.amount.toFixed(8),
      h.avgPrice.toFixed(2),
      (h.amount * h.avgPrice).toFixed(2),
      h.type,
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

    return csv
  }

  /**
   * Export trades as CSV
   */
  static async exportTradesCSV(userId: string, startDate?: Date, endDate?: Date): Promise<string> {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    })

    const headers = ['Date', 'Symbol', 'Side', 'Amount', 'Price', 'Total']
    const rows = trades.map(t => [
      t.createdAt.toISOString().split('T')[0],
      t.symbol,
      t.side,
      t.amount.toFixed(8),
      t.price.toFixed(2),
      (t.amount * t.price).toFixed(2),
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

    return csv
  }

  /**
   * Generate tax report (US 1099 style)
   */
  static async generateTaxReport(userId: string, year: number): Promise<TaxReport> {
    const startDate = new Date(`${year}-01-01`)
    const endDate = new Date(`${year}-12-31`)

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
    })

    let totalIncome = 0
    let totalExpenses = 0
    let capitalGains = 0
    let capitalLosses = 0

    for (const tx of transactions) {
      if (tx.kind === 'deposit' || tx.kind === 'dividend' || tx.kind === 'interest') {
        totalIncome += tx.amount
      } else if (tx.kind === 'withdraw' || tx.kind === 'fee') {
        totalExpenses += tx.amount
      }
    }

    // Calculate capital gains/losses from trades
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    })

    for (let i = 0; i < trades.length - 1; i++) {
      const entryPrice = trades[i].price
      const exitPrice = trades[i + 1].price
      const gain = (exitPrice - entryPrice) * trades[i].amount

      if (gain > 0) {
        capitalGains += gain
      } else {
        capitalLosses += Math.abs(gain)
      }
    }

    const netIncome = totalIncome - totalExpenses + capitalGains - capitalLosses

    return {
      year,
      totalIncome,
      totalExpenses,
      capitalGains,
      capitalLosses,
      netIncome,
      transactions,
    }
  }

  /**
   * Generate portfolio statement
   */
  static async generatePortfolioStatement(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    const holdings = await prisma.holding.findMany({
      where: { userId },
    })

    const walletBalances = await prisma.walletBalance.findMany({
      where: { userId },
    })

    let totalValue = 0
    let totalCost = 0

    for (const holding of holdings) {
      totalCost += holding.amount * holding.avgPrice
      totalValue += holding.amount * holding.avgPrice // Placeholder - use current price
    }

    for (const balance of walletBalances) {
      totalValue += balance.balance
    }

    const unrealizedPnL = totalValue - totalCost

    const statement = `
PORTFOLIO STATEMENT
Generated: ${new Date().toISOString()}
User: ${user?.name} (${user?.email})

HOLDINGS:
${holdings.map(h => `${h.symbol}: ${h.amount} @ $${h.avgPrice} = $${(h.amount * h.avgPrice).toFixed(2)}`).join('\n')}

CASH BALANCES:
${walletBalances.map(b => `${b.currency}: ${b.balance.toFixed(2)}`).join('\n')}

SUMMARY:
Total Value: $${totalValue.toFixed(2)}
Total Cost: $${totalCost.toFixed(2)}
Unrealized P&L: $${unrealizedPnL.toFixed(2)} (${((unrealizedPnL / totalCost) * 100).toFixed(2)}%)
    `

    return statement
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(userId: string, startDate: Date, endDate: Date): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, kycStatus: true, emailVerified: true, phoneVerified: true },
    })

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
    })

    const totalDeposits = transactions
      .filter(t => t.kind === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalWithdrawals = transactions
      .filter(t => t.kind === 'withdraw')
      .reduce((sum, t) => sum + t.amount, 0)

    const report = `
COMPLIANCE REPORT
Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}
Generated: ${new Date().toISOString()}

USER INFORMATION:
Name: ${user?.name}
Email: ${user?.email}
KYC Status: ${user?.kycStatus}
Email Verified: ${user?.emailVerified ? 'Yes' : 'No'}
Phone Verified: ${user?.phoneVerified ? 'Yes' : 'No'}

TRANSACTION SUMMARY:
Total Transactions: ${transactions.length}
Total Deposits: $${totalDeposits.toFixed(2)}
Total Withdrawals: $${totalWithdrawals.toFixed(2)}
Net Flow: $${(totalDeposits - totalWithdrawals).toFixed(2)}

TRANSACTION DETAILS:
${transactions.map(t => `${t.createdAt.toISOString()} | ${t.kind} | ${t.amount} ${t.currency} | ${t.status}`).join('\n')}
    `

    return report
  }

  /**
   * Export as PDF (placeholder)
   */
  static async exportAsPDF(content: string, filename: string): Promise<Buffer> {
    // Placeholder - in production, use a PDF library like pdfkit
    return Buffer.from(content)
  }

  /**
   * Get export history
   */
  static async getExportHistory(userId: string): Promise<any[]> {
    // Placeholder - would need to track exports in database
    return []
  }

  /**
   * Schedule recurring export
   */
  static async scheduleRecurringExport(
    userId: string,
    type: 'transactions' | 'holdings' | 'trades' | 'tax_report',
    frequency: 'daily' | 'weekly' | 'monthly',
    email: string,
  ): Promise<{ id: string; scheduled: boolean }> {
    // Placeholder - would need to implement job scheduling
    return { id: crypto.randomUUID(), scheduled: true }
  }
}

export const dataExportService = new DataExportService()
