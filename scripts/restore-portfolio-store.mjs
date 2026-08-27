/**
 * Build-time restore of app/src/lib/portfolioStore.ts
 * CRITICAL: Never pass strings containing $' to String.replace replacement —
 * in JS, $' means "text after match" and truncates DEFAULT_WALLET (unterminated string).
 * Always use .replace(search, () => replacement).
 * RESTORE_SCRIPT_VERSION=2
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(__dirname, '..', 'app/src/lib/portfolioStore.ts')
const GOOD_COMMIT = '2bd6e85'
const RAW_URL = `https://raw.githubusercontent.com/Phillipjr9/verdexis/${GOOD_COMMIT}/app/src/lib/portfolioStore.ts`

function safeReplace(src, search, replacement) {
  if (!src.includes(search)) return src
  return src.replace(search, () => replacement)
}

function isComplete(src) {
  const def = src.match(/const DEFAULT_WALLET:\s*WalletBalance\[\]\s*=\s*\[[\s\S]*?\]/)
  if (!def || !/symbol:\s*'\$'/.test(def[0]) || /currency:\s*'BTC'/.test(def[0])) return false
  if ((src.match(/export const portfolioStore/g) || []).length !== 1) return false
  return (
    src.includes('getWalletValueUsd') &&
    src.includes('markToMarket') &&
    src.includes('getQuote') &&
    src.includes('confirmDeposit') &&
    src.includes('Array.isArray(hResult.value?.holdings)') &&
    src.includes('dedupeWallet')
  )
}

function applyGuards(src) {
  const pairs = [
    ['const apiHoldings = (hResult.value.holdings as ApiHolding[])',
     'const rawHoldings = Array.isArray(hResult.value?.holdings) ? hResult.value.holdings : []\n        const apiHoldings = (rawHoldings as ApiHolding[])'],
    ['const apiBalances = (wRes.balances as ApiBalance[])',
     'const rawBalances = Array.isArray(wRes?.balances) ? wRes.balances : []\n        const apiBalances = (rawBalances as ApiBalance[])'],
    ['const apiTransactions = (wRes.transactions as ApiTransaction[])',
     'const rawTransactions = Array.isArray(wRes?.transactions) ? wRes.transactions : []\n        const apiTransactions = (rawTransactions as ApiTransaction[])'],
    ['const apiTrades = (tResult.value.trades as ApiTrade[])',
     'const rawTrades = Array.isArray(tResult.value?.trades) ? tResult.value.trades : []\n        const apiTrades = (rawTrades as ApiTrade[])'],
  ]
  for (const [a, b] of pairs) src = safeReplace(src, a, b)
  return src
}

function applyUsdOnly(src) {
  const dollar = String.fromCharCode(36)
  const usdOnly =
    'const DEFAULT_WALLET: WalletBalance[] = [\n' +
    "  { currency: 'USD', symbol: '" + dollar + "', balance: 0, available: 0 },\n" +
    ']'
  src = src.replace(
    /const DEFAULT_WALLET:\s*WalletBalance\[\]\s*=\s*\[[\s\S]*?\]/,
    () => usdOnly,
  )
  return src
}

function applyDedupe(src) {
  if (src.includes('private dedupeWallet')) return src
  const dollar = String.fromCharCode(36)
  const fn =
    '\n  /** Keep one row per currency (uppercase). Prevents duplicate BTC cards. */\n' +
    '  private dedupeWallet(list: WalletBalance[]): WalletBalance[] {\n' +
    '    const map = new Map<string, WalletBalance>()\n' +
    '    for (const b of list || []) {\n' +
    "      if (!b || typeof b.currency !== 'string' || !b.currency) continue\n" +
    '      const currency = b.currency.toUpperCase()\n' +
    '      const prev = map.get(currency)\n' +
    "      const nextBal = typeof b.balance === 'number' && isFinite(b.balance) ? b.balance : 0\n" +
    "      const nextAvail = typeof b.available === 'number' && isFinite(b.available) ? b.available : 0\n" +
    '      if (!prev || Math.abs(nextBal) >= Math.abs(prev.balance)) {\n' +
    '        map.set(currency, {\n' +
    '          currency,\n' +
    '          symbol: b.symbol || (prev && prev.symbol) || symbolFor(currency),\n' +
    '          balance: nextBal,\n' +
    '          available: nextAvail,\n' +
    '        })\n' +
    '      }\n' +
    '    }\n' +
    "    if (!map.has('USD')) {\n" +
    "      map.set('USD', { currency: 'USD', symbol: '" + dollar + "', balance: 0, available: 0 })\n" +
    '    }\n' +
    '    return Array.from(map.values())\n' +
    '  }\n\n'
  const anchor = '  private mergeWalletBalances(apiBalances: WalletBalance[]): WalletBalance[] {'
  src = safeReplace(src, anchor, fn + anchor)
  src = safeReplace(src, '    this.wallet = this.load(STORAGE_KEYS.wallet, DEFAULT_WALLET)', '    this.wallet = this.dedupeWallet(this.load(STORAGE_KEYS.wallet, DEFAULT_WALLET))')
  src = safeReplace(src, '  getWallet(): WalletBalance[] { return this.wallet }', '  getWallet(): WalletBalance[] { return this.dedupeWallet(this.wallet) }')
  src = safeReplace(src, '        this.wallet = this.mergeWalletBalances(apiBalances)', '        this.wallet = this.dedupeWallet(this.mergeWalletBalances(apiBalances))')
  return src
}

async function main() {
  const existing = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : ''
  if (existing && isComplete(existing)) {
    console.log('portfolioStore.ts complete — skip restore')
    return
  }
  console.log('portfolioStore needs restore — fetching from', GOOD_COMMIT)
  const res = await fetch(RAW_URL)
  if (!res.ok) throw new Error('fetch failed: ' + res.status)
  let src = await res.text()
  if (src.length < 10000) throw new Error('fetched file too small')
  src = applyGuards(src)
  src = applyUsdOnly(src)
  src = applyDedupe(src)
  if (!isComplete(src)) throw new Error('restore produced incomplete portfolioStore')
  fs.mkdirSync(path.dirname(TARGET), { recursive: true })
  fs.writeFileSync(TARGET, src)
  console.log('Wrote', TARGET, 'lines=' + src.split('\n').length)
}

main().catch((e) => {
  console.error('restore-portfolio-store failed:', e)
  process.exit(1)
})
