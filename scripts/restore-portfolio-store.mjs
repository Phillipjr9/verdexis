/**
 * Build-time restore of app/src/lib/portfolioStore.ts
 * Fetches known-good full file, applies Array.isArray guards,
 * USD-only default wallet (no phantom BTC/ETH/SOL), and dedupeWallet.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TARGET = path.join(ROOT, 'app/src/lib/portfolioStore.ts')
const GOOD_COMMIT = '2bd6e85'
const RAW_URL = `https://raw.githubusercontent.com/Phillipjr9/verdexis/${GOOD_COMMIT}/app/src/lib/portfolioStore.ts`

function applyGuards(src) {
  const pairs = [
    [
      'const apiHoldings = (hResult.value.holdings as ApiHolding[])',
      'const rawHoldings = Array.isArray(hResult.value?.holdings) ? hResult.value.holdings : []\n        const apiHoldings = (rawHoldings as ApiHolding[])',
    ],
    [
      'const apiBalances = (wRes.balances as ApiBalance[])',
      'const rawBalances = Array.isArray(wRes?.balances) ? wRes.balances : []\n        const apiBalances = (rawBalances as ApiBalance[])',
    ],
    [
      'const apiTransactions = (wRes.transactions as ApiTransaction[])',
      'const rawTransactions = Array.isArray(wRes?.transactions) ? wRes.transactions : []\n        const apiTransactions = (rawTransactions as ApiTransaction[])',
    ],
    [
      'const apiTrades = (tResult.value.trades as ApiTrade[])',
      'const rawTrades = Array.isArray(tResult.value?.trades) ? tResult.value.trades : []\n        const apiTrades = (rawTrades as ApiTrade[])',
    ],
  ]
  let out = src
  for (const [old, neu] of pairs) {
    if (out.includes(old)) out = out.replace(old, neu)
  }
  return out
}

function applyUsdOnlyDefault(src) {
  const multi = `const DEFAULT_WALLET: WalletBalance[] = [
  { currency: 'USD', symbol: '$', balance: 0, available: 0 },
  { currency: 'BTC', symbol: 'B', balance: 0, available: 0 },
  { currency: 'ETH', symbol: 'E', balance: 0, available: 0 },
  { currency: 'SOL', symbol: 'S', balance: 0, available: 0 },
]`
  const usdOnly = `const DEFAULT_WALLET: WalletBalance[] = [
  { currency: 'USD', symbol: '$', balance: 0, available: 0 },
]`
  const usdBtc = `const DEFAULT_WALLET: WalletBalance[] = [
  { currency: 'USD', symbol: '$', balance: 0, available: 0 },
  { currency: 'BTC', symbol: 'B', balance: 0, available: 0 },
]`
  if (src.includes(multi)) return src.replace(multi, usdOnly)
  if (src.includes(usdBtc)) return src.replace(usdBtc, usdOnly)
  return src
}

function applyDedupe(src) {
  if (src.includes('private dedupeWallet')) return src

  const dedupeFn = `
  /** Keep one row per currency (uppercase). Prevents duplicate BTC cards. */
  private dedupeWallet(list: WalletBalance[]): WalletBalance[] {
    const map = new Map<string, WalletBalance>()
    for (const b of list || []) {
      if (!b || typeof b.currency !== 'string' || !b.currency) continue
      const currency = b.currency.toUpperCase()
      const prev = map.get(currency)
      const nextBal = typeof b.balance === 'number' && isFinite(b.balance) ? b.balance : 0
      const nextAvail = typeof b.available === 'number' && isFinite(b.available) ? b.available : 0
      if (!prev || Math.abs(nextBal) >= Math.abs(prev.balance)) {
        map.set(currency, {
          currency,
          symbol: b.symbol || (prev && prev.symbol) || symbolFor(currency),
          balance: nextBal,
          available: nextAvail,
        })
      }
    }
    if (!map.has('USD')) {
      map.set('USD', { currency: 'USD', symbol: '$', balance: 0, available: 0 })
    }
    return Array.from(map.values())
  }

`
  if (src.includes('private mergeWalletBalances(apiBalances: WalletBalance[]): WalletBalance[] {')) {
    src = src.replace(
      '  private mergeWalletBalances(apiBalances: WalletBalance[]): WalletBalance[] {',
      dedupeFn + '  private mergeWalletBalances(apiBalances: WalletBalance[]): WalletBalance[] {',
    )
  }

  src = src.replace(
    '    this.wallet = this.load(STORAGE_KEYS.wallet, DEFAULT_WALLET)',
    '    this.wallet = this.dedupeWallet(this.load(STORAGE_KEYS.wallet, DEFAULT_WALLET))',
  )
  src = src.replace(
    '  getWallet(): WalletBalance[] { return this.wallet }',
    '  getWallet(): WalletBalance[] { return this.dedupeWallet(this.wallet) }',
  )
  src = src.replace(
    '        this.wallet = this.mergeWalletBalances(apiBalances)',
    '        this.wallet = this.dedupeWallet(this.mergeWalletBalances(apiBalances))',
  )
  return src
}

async function main() {
  const existing = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : ''
  const hasFullApi =
    existing.includes('getWalletValueUsd') &&
    existing.includes('markToMarket') &&
    existing.includes('getQuote') &&
    existing.includes('confirmDeposit') &&
    existing.includes('Array.isArray(hResult.value?.holdings)') &&
    existing.includes('dedupeWallet') &&
    !/DEFAULT_WALLET[\s\S]{0,200}currency: 'BTC'/.test(existing)

  if (hasFullApi) {
    console.log('portfolioStore.ts complete (guards + dedupe + USD-only default) — skip restore')
    return
  }

  console.log(`portfolioStore needs restore — fetching from ${GOOD_COMMIT}...`)
  const res = await fetch(RAW_URL)
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${RAW_URL}`)
  let src = await res.text()
  if (src.length < 10000) throw new Error(`fetched file too small (${src.length})`)
  src = applyGuards(src)
  src = applyUsdOnlyDefault(src)
  src = applyDedupe(src)
  fs.mkdirSync(path.dirname(TARGET), { recursive: true })
  fs.writeFileSync(TARGET, src)
  console.log(`Wrote ${TARGET} (getWalletValueUsd=${src.includes('getWalletValueUsd')}, dedupe=${src.includes('dedupeWallet')})`)
}

main().catch((e) => {
  console.error('restore-portfolio-store failed:', e)
  process.exit(1)
})
