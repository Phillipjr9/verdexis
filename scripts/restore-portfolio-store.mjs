/**
 * Build-time restore of app/src/lib/portfolioStore.ts
 * Fetches known-good full file and applies only Array.isArray guards.
 * Prevents accidental wipe of the store (which caused wallet "something went wrong").
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

async function main() {
  // Always restore if missing critical methods (incomplete stub) or missing guards
  const existing = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : ''
  const hasFullApi =
    existing.includes('getWalletValueUsd') &&
    existing.includes('markToMarket') &&
    existing.includes('getQuote') &&
    existing.includes('confirmDeposit') &&
    existing.includes('Array.isArray(hResult.value?.holdings)')

  if (hasFullApi) {
    console.log('portfolioStore.ts complete with guards — skip restore')
    return
  }

  console.log(`portfolioStore incomplete/missing methods — fetching from ${GOOD_COMMIT}...`)
  const res = await fetch(RAW_URL)
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${RAW_URL}`)
  let src = await res.text()
  if (src.length < 10000) throw new Error(`fetched file too small (${src.length})`)
  src = applyGuards(src)
  fs.mkdirSync(path.dirname(TARGET), { recursive: true })
  fs.writeFileSync(TARGET, src)
  console.log(`Wrote ${TARGET} (${src.split('\n').length} lines, getWalletValueUsd=${src.includes('getWalletValueUsd')})`)
}

main().catch((e) => {
  console.error('restore-portfolio-store failed:', e)
  process.exit(1)
})
