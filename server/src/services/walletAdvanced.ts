import crypto from 'node:crypto'
import { prisma } from '../db.js'

export interface WalletLabel {
  address: string
  label: string
  category: 'exchange' | 'personal' | 'cold_storage' | 'other'
}

export interface GasFeeEstimate {
  standard: number
  fast: number
  instant: number
  unit: string
}

export interface TransactionExport {
  date: string
  type: string
  symbol: string
  amount: number
  price: number
  total: number
  fee: number
  notes: string
}

export class WalletService {
  /**
   * Add wallet address label
   */
  static async labelWalletAddress(userId: string, address: string, label: string, category: string): Promise<WalletLabel> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    const labels = ((prefs as { walletLabels?: WalletLabel[] }).walletLabels || []) as WalletLabel[]
    const existingIndex = labels.findIndex(l => l.address === address)

    const newLabel: WalletLabel = { address, label, category: category as any }

    if (existingIndex >= 0) {
      labels[existingIndex] = newLabel
    } else {
      labels.push(newLabel)
    }

    prefs.walletLabels = labels

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    return newLabel
  }

  /**
   * Get wallet labels
   */
  static async getWalletLabels(userId: string): Promise<WalletLabel[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!user?.prefs) return []

    let prefs: Record<string, unknown> = {}
    try {
      prefs = JSON.parse(user.prefs)
    } catch {
      return []
    }

    return ((prefs as { walletLabels?: WalletLabel[] }).walletLabels || []) as WalletLabel[]
  }

  /**
   * Remove wallet label
   */
  static async removeWalletLabel(userId: string, address: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    const labels = ((prefs as { walletLabels?: WalletLabel[] }).walletLabels || []) as WalletLabel[]
    const filtered = labels.filter(l => l.address !== address)

    if (filtered.length === labels.length) {
      return false
    }

    prefs.walletLabels = filtered

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    return true
  }

  /**
   * Estimate gas fees (placeholder)
   */
  static async estimateGasFees(network: string): Promise<GasFeeEstimate> {
    // Placeholder - in production, fetch from actual network
    const estimates: Record<string, GasFeeEstimate> = {
      ethereum: { standard: 50, fast: 100, instant: 150, unit: 'gwei' },
      polygon: { standard: 30, fast: 50, instant: 100, unit: 'gwei' },
      bsc: { standard: 5, fast: 10, instant: 20, unit: 'gwei' },
    }

    return estimates[network.toLowerCase()] || { standard: 0, fast: 0, instant: 0, unit: 'gwei' }
  }

  /**
   * Export transactions as CSV
   */
  static async exportTransactionsCSV(userId: string): Promise<string> {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    const headers = ['Date', 'Type', 'Currency', 'Amount', 'Status', 'Reference']
    const rows = transactions.map(t => [
      t.createdAt.toISOString().split('T')[0],
      t.kind,
      t.currency,
      t.amount.toString(),
      t.status,
      t.reference || '',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    return csv
  }

  /**
   * Export transactions as PDF (placeholder)
   */
  static async exportTransactionsPDF(userId: string): Promise<Buffer> {
    // Placeholder - in production, use a PDF library like pdfkit
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    const content = `
Transaction Report
Generated: ${new Date().toISOString()}

${transactions.map(t => `${t.createdAt.toISOString()} | ${t.kind} | ${t.amount} ${t.currency} | ${t.status}`).join('\n')}
    `

    return Buffer.from(content)
  }

  /**
   * Get wallet balance history
   */
  static async getBalanceHistory(userId: string, currency: string, days: number = 30): Promise<any[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        currency,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    })

    let balance = 0
    const history = []

    for (const tx of transactions) {
      if (tx.kind === 'deposit' || tx.kind === 'dividend' || tx.kind === 'interest') {
        balance += tx.amount
      } else if (tx.kind === 'withdraw' || tx.kind === 'fee') {
        balance -= tx.amount
      }

      history.push({
        date: tx.createdAt,
        balance,
        transaction: tx.kind,
        amount: tx.amount,
      })
    }

    return history
  }

  /**
   * Validate wallet address
   */
  static validateWalletAddress(address: string, network: string): boolean {
    // Ethereum/EVM address validation
    if (network.toLowerCase() === 'ethereum' || network.toLowerCase() === 'polygon') {
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    }

    // Bitcoin address validation (simplified)
    if (network.toLowerCase() === 'bitcoin') {
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[a-z0-9]{39,59}$/.test(address)
    }

    return false
  }

  /**
   * Generate multi-sig wallet (placeholder)
   */
  static async generateMultiSigWallet(userId: string, signers: string[], requiredSignatures: number): Promise<{ address: string; signers: string[] }> {
    // Placeholder - in production, use actual multi-sig implementation
    const address = `0x${crypto.randomBytes(20).toString('hex')}`

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    prefs.multiSigWallet = {
      address,
      signers,
      requiredSignatures,
      createdAt: new Date().toISOString(),
    }

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    return { address, signers }
  }

  /**
   * Get wallet security score
   */
  static async getWalletSecurityScore(userId: string): Promise<{ score: number; recommendations: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, phoneVerified: true, twoFactor: true, prefs: true },
    })

    let score = 0
    const recommendations: string[] = []

    if (user?.emailVerified) score += 20
    else recommendations.push('Verify your email address')

    if (user?.phoneVerified) score += 20
    else recommendations.push('Verify your phone number')

    if (user?.twoFactor) score += 30
    else recommendations.push('Enable two-factor authentication')

    let prefs: Record<string, unknown> = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    const multiSigWallet = (prefs as { multiSigWallet?: unknown }).multiSigWallet
    if (multiSigWallet) score += 30
    else recommendations.push('Consider using a multi-signature wallet')

    return { score: Math.min(100, score), recommendations }
  }
}

export const walletService = new WalletService()
