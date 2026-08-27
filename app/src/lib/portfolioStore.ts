import { api, getToken } from './api'

// Enable synthetic/fallback transactions only when the VITE_ALLOW_SYNTHETIC_TRANSACTIONS
// environment variable is explicitly set to '1' or 'true'. This prevents the UI from
// inventing deposit history when the server returns balances but no transaction list.
const ALLOW_SYNTHETIC_TRANSACTIONS = typeof import.meta !== 'undefined' && Boolean(
  (import.meta.env?.VITE_ALLOW_SYNTHETIC_TRANSACTIONS === '1') ||
  (import.meta.env?.VITE_ALLOW_SYNTHETIC_TRANSACTIONS === 'true')
)

export interface PortfolioHolding {
  id: string
  symbol: string
  name: string
  quantity: number
  avgBuyPrice: number
  currentPrice: number
  value: number
  pnl: number
  pnlPercent: number
  allocation: number
}

export interface Trade {
  id: string
  symbol: string
  name: string
  side: 'buy' | 'sell'
  type: string
  price: number
  quantity: number
  total: number
  timestamp: Date
}

export interface WalletTransaction {
  id: string
  type: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest' | 'fee'
  amount: number
  currency: string
  description: string
  timestamp: Date
  status: 'completed' | 'pending'
}

export interface WalletBalance {
  currency: string
  symbol: string
  balance: number
  available: number
}

const STORAGE_KEYS = {
  holdings: 'verdexis_holdings',
  trades: 'verdexis_trades',
  wallet: 'verdexis_wallet',
  transactions: 'verdexis_transactions',
}

// One-time purge of the legacy mock seed data (BTC 2.45 / USDC 125,430 /
// $5,000 "Bank Transfer from Chase" etc.) that earlier builds wrote to
// localStorage on first visit. Bumping this key forces a re-evaluation:
// any browser still holding the seed will be cleared once and start fresh.
const STORAGE_RESET_FLAG = 'verdexis_storage_reset_v2'
function purgeLegacyMockSeeds() {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(STORAGE_RESET_FLAG) === '1') return
    localStorage.removeItem(STORAGE_KEYS.holdings)
    localStorage.removeItem(STORAGE_KEYS.trades)
    localStorage.removeItem(STORAGE_KEYS.wallet)
    localStorage.removeItem(STORAGE_KEYS.transactions)
    localStorage.setItem(STORAGE_RESET_FLAG, '1')
  } catch { /* ignore */ }
}
purgeLegacyMockSeeds()

// Empty defaults: real holdings/trades/balances come from the server (loadFromApi)
// once the user is authenticated. Showing seeded mock numbers like $125,430.50 or
// a $5,000 "Bank Transfer from Chase" creates the impression that the app is
// faking balances. Anonymous / pre-login views start at zero and reflect actual
// activity from there.
const DEFAULT_HOLDINGS: PortfolioHolding[] = []

const DEFAULT_TRADES: Trade[] = []

const DEFAULT_WALLET: WalletBalance[] = [
  { currency: 'USD', symbol: '$', balance: 0, available: 0 },
  { currency: 'BTC', symbol: 'B', balance: 0, available: 0 },
]

const DEFAULT_TRANSACTIONS: WalletTransaction[] = []

function symbolFor(currency: string): string {
  const c = (currency || '').toUpperCase()
  if (c === 'USD' || c === 'USDT' || c === 'USDC') return '$'
  if (c === 'BTC') return '₿'
  if (c === 'ETH') return 'Ξ'
  return c.slice(0, 1) || '?'
}

function sanitizeActivityDescription(ref: string): string {
  if (!ref || typeof ref !== 'string') return 'Activity'
  return ref.replace(/[<>]/g, '').slice(0, 120)
}

type ApiHolding = { id?: string; symbol?: string; name?: string; amount?: number; avgPrice?: number }
type ApiBalance = { currency?: string; symbol?: string; balance?: number; available?: number }
type ApiTransaction = {
  id: string
  kind: string
  amount?: number
  currency?: string
  reference?: string
  createdAt: string
  status?: string
}
type ApiTrade = {
  id: string
  symbol?: string
  side: 'buy' | 'sell'
  price?: number
  amount?: number
  total?: number
  createdAt: string
}

const listeners = new Set<() => void>()
function emit() {
  listeners.forEach((fn) => {
    try { fn() } catch { /* ignore */ }
  })
}

class PortfolioStore {
  private holdings: PortfolioHolding[] = []
  private trades: Trade[] = []
  private wallet: WalletBalance[] = []
  private transactions: WalletTransaction[] = []
  private hydrated = false

  constructor() {
    this.holdings = this.load(STORAGE_KEYS.holdings, DEFAULT_HOLDINGS)
    this.trades = this.load(STORAGE_KEYS.trades, DEFAULT_TRADES)
    this.wallet = this.load(STORAGE_KEYS.wallet, DEFAULT_WALLET)
    this.transactions = this.load(STORAGE_KEYS.transactions, DEFAULT_TRANSACTIONS)
    try {
      this.trades = (this.trades || []).map((t: any) => ({ ...t, timestamp: typeof t?.timestamp === 'string' ? new Date(t.timestamp) : t?.timestamp }))
      this.transactions = (this.transactions || []).map((tx: any) => ({ ...tx, timestamp: typeof tx?.timestamp === 'string' ? new Date(tx.timestamp) : tx?.timestamp }))
    } catch { /* ignore */ }
  }

  private load<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  private save(key: string, value: unknown) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch { /* ignore */ }
  }

  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }

  async hydrate(force = false): Promise<void> {
    if (!getToken()) return
    if (this.hydrated && !force) return
    try {
      const isAbortLike = (value: unknown): boolean => {
        if (!value || typeof value !== 'object') return false
        if ('name' in value && (value as { name?: string }).name === 'AbortError') return true
        if ('status' in value && (value as { status?: number }).status === 401) return true
        if ('status' in value && (value as { status?: number }).status === 403) return true
        return false
      }

      const [hResult, wResult, tResult] = await Promise.allSettled([
        api.listHoldings(),
        api.getWallet(),
        api.listTrades(),
      ])

      let hadSuccess = false

      if (hResult.status === 'fulfilled') {
        const rawHoldings = Array.isArray(hResult.value?.holdings) ? hResult.value.holdings : []
        const apiHoldings = (rawHoldings as ApiHolding[])
          .filter((h) => h && (typeof h.symbol === 'string' || typeof h.id === 'string'))
          .map<PortfolioHolding>((h) => {
            const symbol = (typeof h.symbol === 'string' && h.symbol) || (typeof h.id === 'string' ? h.id : 'UNKNOWN')
            const name = (typeof h.name === 'string' && h.name) || symbol
            const amount = typeof h.amount === 'number' && isFinite(h.amount) ? h.amount : 0
            const avgPrice = typeof h.avgPrice === 'number' && isFinite(h.avgPrice) ? h.avgPrice : 0
            const value = amount * avgPrice
            return {
              id: symbol.toLowerCase(),
              symbol,
              name,
              quantity: amount,
              avgBuyPrice: avgPrice,
              currentPrice: avgPrice,
              value,
              pnl: 0,
              pnlPercent: 0,
              allocation: 0,
            }
          })
        const totalValue = apiHoldings.reduce((s, h) => s + h.value, 0)
        apiHoldings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })
        this.holdings = apiHoldings
        this.save(STORAGE_KEYS.holdings, this.holdings)
        hadSuccess = true
      } else if (!isAbortLike(hResult.reason)) {
        console.warn('portfolioStore.hydrate: listHoldings failed', hResult.reason)
      }

      if (wResult.status === 'fulfilled') {
        const wRes = wResult.value
        const rawBalances = Array.isArray(wRes?.balances) ? wRes.balances : []
        const apiBalances = (rawBalances as ApiBalance[])
          .filter((b) => b && typeof b.currency === 'string' && b.currency)
          .map<WalletBalance>((b) => ({
            currency: b.currency,
            symbol: (typeof b.symbol === 'string' && b.symbol) || symbolFor(b.currency),
            balance: typeof b.balance === 'number' && isFinite(b.balance) ? b.balance : 0,
            available: typeof b.available === 'number' && isFinite(b.available) ? b.available : 0,
          }))

        const rawTransactions = Array.isArray(wRes?.transactions) ? wRes.transactions : []
        const apiTransactions = (rawTransactions as ApiTransaction[])
          .filter((tx) => tx && typeof tx.kind === 'string')
          .map<WalletTransaction>((tx) => {
            const kind = tx.kind
            const currency = (typeof tx.currency === 'string' && tx.currency) || 'USD'
            const amount = typeof tx.amount === 'number' && isFinite(tx.amount) ? tx.amount : 0
            const signedAmount =
              (kind === 'withdraw' || kind === 'fee')
                ? -Math.abs(amount)
                : kind === 'transfer'
                  ? amount
                  : Math.abs(amount)
            const description = tx.reference
              ? sanitizeActivityDescription(tx.reference)
              : `${(kind[0] || '?').toUpperCase()}${kind.slice(1)} ${currency}`
            return {
              id: tx.id,
              type: kind as WalletTransaction['type'],
              amount: signedAmount,
              currency,
              description,
              timestamp: new Date(tx.createdAt),
              status: tx.status === 'completed' ? 'completed' : 'pending',
            }
          })

        this.wallet = this.mergeWalletBalances(apiBalances)
        // Merge: keep any local-only pending transactions (e.g. deposits
        // awaiting admin approval) that the server doesn't know about yet.
        // Without this, every 30s hydrate cycle silently drops them.
        const serverIds = new Set(apiTransactions.map((t) => t.id))
        const localOnly = this.transactions.filter((t) => !serverIds.has(t.id))
        const mergedTransactions = [...apiTransactions, ...localOnly]
        const shouldFallbackDepositHistory = ALLOW_SYNTHETIC_TRANSACTIONS && mergedTransactions.length === 0 && apiBalances.some((b) => {
          const currency = (b.currency || '').toUpperCase()
          const amount = typeof b.balance === 'number' && isFinite(b.balance) ? b.balance : 0
          return currency && amount > 0
        })

        const fallbackTransactions: WalletTransaction[] = shouldFallbackDepositHistory
          ? apiBalances
              .filter((b) => {
                const amount = typeof b.balance === 'number' && isFinite(b.balance) ? b.balance : 0
                return amount > 0
              })
              .map((b) => ({
                id: `synthetic-deposit-${(b.currency || 'USD').toUpperCase()}-${Date.now()}`,
                type: 'deposit',
                amount: Math.abs(Number(b.balance) || 0),
                currency: (b.currency || 'USD').toUpperCase(),
                description: `Deposit credited (${(b.currency || 'USD').toUpperCase()})`,
                timestamp: new Date(),
                status: 'completed',
              }))
          : []

        this.transactions = [...mergedTransactions, ...fallbackTransactions]
        this.save(STORAGE_KEYS.wallet, this.wallet)
        this.save(STORAGE_KEYS.transactions, this.transactions)
        hadSuccess = true
      } else {
        console.warn('portfolioStore.hydrate: getWallet failed', wResult.reason)
      }

      if (tResult.status === 'fulfilled') {
        const rawTrades = Array.isArray(tResult.value?.trades) ? tResult.value.trades : []
        const apiTrades = (rawTrades as ApiTrade[])
          .filter((t) => t && typeof t.symbol === 'string')
          .map<Trade>((t) => ({
            id: t.id,
            symbol: t.symbol || 'UNKNOWN',
            name: t.symbol || 'UNKNOWN',
            side: t.side,
            type: 'market',
            price: typeof t.price === 'number' && isFinite(t.price) ? t.price : 0,
            quantity: typeof t.amount === 'number' && isFinite(t.amount) ? t.amount : 0,
            total: typeof t.total === 'number' && isFinite(t.total) ? t.total : 0,
            timestamp: new Date(t.createdAt),
          }))
        this.trades = apiTrades
        this.save(STORAGE_KEYS.trades, this.trades)
        hadSuccess = true
      } else if (!isAbortLike(tResult.reason)) {
        console.warn('portfolioStore.hydrate: listTrades failed', tResult.reason)
      }

      if (hadSuccess) {
        this.hydrated = true
        emit()
      }
    } catch (err) {
      console.warn('portfolioStore.hydrate: unexpected error', err)
    }
  }

  getHoldings(): PortfolioHolding[] { return this.holdings }

  getWallet(): WalletBalance[] { return this.wallet }

  getTrades(): Trade[] {
    return [...this.trades].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getTransactions(): WalletTransaction[] {
    return [...this.transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getTotalValue(): number {
    if (!this.holdings.length) {
      return this.wallet.reduce((s, b) => s + (b.balance || 0), 0)
    }
    let total = 0
    for (const h of this.holdings) {
      total += h.value || 0
    }
    for (const b of this.wallet) {
      if ((b.currency || '').toUpperCase() === 'USD') total += b.balance || 0
    }
    return total
  }

  recalculateAllocations() {
    const totalValue = this.holdings.reduce((s, x) => s + x.value, 0)
    this.holdings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })
    this.save(STORAGE_KEYS.holdings, this.holdings)
  }

  private mergeWalletBalances(apiBalances: WalletBalance[]): WalletBalance[] {
    const map = new Map<string, WalletBalance>()
    for (const b of DEFAULT_WALLET) {
      map.set(b.currency.toUpperCase(), { ...b })
    }
    for (const b of apiBalances) {
      map.set(b.currency.toUpperCase(), b)
    }
    return Array.from(map.values())
  }

  // Remaining methods preserved from prior good version for trade/deposit flows
  addTrade(symbol: string, name: string, side: 'buy' | 'sell', price: number, quantity: number) {
    const total = price * quantity
    const trade: Trade = {
      id: `local-${Date.now()}`,
      symbol,
      name,
      side,
      type: 'market',
      price,
      quantity,
      total,
      timestamp: new Date(),
    }
    this.trades.push(trade)
    this.save(STORAGE_KEYS.trades, this.trades)

    const existingIdx = this.holdings.findIndex((h) => h.symbol === symbol)
    if (side === 'buy') {
      if (existingIdx >= 0) {
        const h = this.holdings[existingIdx]
        const newQty = h.quantity + quantity
        const newAvg = newQty > 0 ? ((h.avgBuyPrice * h.quantity) + (price * quantity)) / newQty : price
        h.quantity = newQty
        h.avgBuyPrice = newAvg
        h.currentPrice = price
        h.value = newQty * price
      } else {
        this.holdings.push({
          id: symbol.toLowerCase(),
          symbol,
          name,
          quantity,
          avgBuyPrice: price,
          currentPrice: price,
          value: quantity * price,
          pnl: 0,
          pnlPercent: 0,
          allocation: 0,
        })
      }
    } else if (existingIdx >= 0) {
      const h = this.holdings[existingIdx]
      h.quantity = Math.max(0, h.quantity - quantity)
      h.currentPrice = price
      h.value = h.quantity * price
      if (h.quantity === 0) this.holdings.splice(existingIdx, 1)
    }
    const totalValue = this.holdings.reduce((s, h) => s + h.value, 0)
    this.holdings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })
    this.save(STORAGE_KEYS.holdings, this.holdings)
    emit()
  }

  addTransaction(type: WalletTransaction['type'], amount: number, currency: string, description: string, status: 'completed' | 'pending' = 'completed') {
    const tx: WalletTransaction = {
      id: `local-tx-${Date.now()}`,
      type,
      amount,
      currency: currency.toUpperCase(),
      description,
      timestamp: new Date(),
      status,
    }
    this.transactions.push(tx)
    this.save(STORAGE_KEYS.transactions, this.transactions)
    emit()
  }

  recordTransfer(fromCurrency: string, toCurrency: string, amount: number, description: string) {
    const debit: WalletTransaction = {
      id: `xfer-debit-${Date.now()}`,
      type: 'transfer',
      amount: -Math.abs(amount),
      currency: fromCurrency.toUpperCase(),
      description,
      timestamp: new Date(),
      status: 'completed',
    }
    const credit: WalletTransaction = {
      id: `xfer-credit-${Date.now() + 1}`,
      type: 'transfer',
      amount: Math.abs(amount),
      currency: toCurrency.toUpperCase(),
      description,
      timestamp: new Date(),
      status: 'completed',
    }
    this.transactions.push(debit, credit)
    this.save(STORAGE_KEYS.transactions, this.transactions)
    emit()
  }

  updateTransactionStatus(txId: string, status: 'completed' | 'pending') {
    const tx = this.transactions.find(t => t.id === txId)
    if (tx) {
      tx.status = status
      this.save(STORAGE_KEYS.transactions, this.transactions)
      emit()
    }
  }

  clear() {
    this.holdings = []
    this.trades = []
    this.wallet = [...DEFAULT_WALLET]
    this.transactions = []
    this.hydrated = false
    localStorage.removeItem(STORAGE_KEYS.holdings)
    localStorage.removeItem(STORAGE_KEYS.trades)
    localStorage.removeItem(STORAGE_KEYS.wallet)
    localStorage.removeItem(STORAGE_KEYS.transactions)
    emit()
  }
}

export const portfolioStore = new PortfolioStore()
