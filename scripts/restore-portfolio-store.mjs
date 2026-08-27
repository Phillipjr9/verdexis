#!/usr/bin/env node
/**
 * Restores app/src/lib/portfolioStore.ts from known-good commit 5235f3b
 * and applies only Array.isArray guards in hydrate().
 * Prevents accidental wipe (see 3377eb8) from breaking the wallet page.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGET = join(ROOT, 'app/src/lib/portfolioStore.ts')
const GOOD_COMMIT = '5235f3b25a5d8bb7002cbee772d114c5a63c373f'
const RAW_URL = `https://raw.githubusercontent.com/Phillipjr9/verdexis/${GOOD_COMMIT}/app/src/lib/portfolioStore.ts`

function applyGuards(src) {
  let text = src

  const hOld = `      if (hResult.status === 'fulfilled') {
        const apiHoldings = (hResult.value.holdings as ApiHolding[])
          .filter((h) => h && (typeof h.symbol === 'string' || typeof h.id === 'string'))
          .map<PortfolioHolding>((h) => {`
  const hNew = `      if (hResult.status === 'fulfilled') {
        const rawHoldings = Array.isArray(hResult.value?.holdings) ? hResult.value.holdings : []
        const apiHoldings = (rawHoldings as ApiHolding[])
          .filter((h) => h && (typeof h.symbol === 'string' || typeof h.id === 'string'))
          .map<PortfolioHolding>((h) => {`
  if (!text.includes(hOld)) {
    if (text.includes('Array.isArray(hResult.value?.holdings)')) {
      console.log('portfolioStore: holdings guard already present')
    } else {
      throw new Error('holdings pattern not found — file shape changed')
    }
  } else {
    text = text.replace(hOld, hNew)
  }

  const wOld = `      if (wResult.status === 'fulfilled') {
        const wRes = wResult.value
        const apiBalances = (wRes.balances as ApiBalance[])
          .filter((b) => b && typeof b.currency === 'string' && b.currency)
          .map<WalletBalance>((b) => ({
            currency: b.currency,
            symbol: (typeof b.symbol === 'string' && b.symbol) || symbolFor(b.currency),
            balance: typeof b.balance === 'number' && isFinite(b.balance) ? b.balance : 0,
            available: typeof b.available === 'number' && isFinite(b.available) ? b.available : 0,
          }))

        const apiTransactions = (wRes.transactions as ApiTransaction[])
          .filter((tx) => tx && typeof tx.kind === 'string')
          .map<WalletTransaction>((tx) => {`
  const wNew = `      if (wResult.status === 'fulfilled') {
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
          .map<WalletTransaction>((tx) => {`
  if (!text.includes(wOld) && !text.includes('Array.isArray(wRes?.balances)')) {
    throw new Error('wallet balances/transactions pattern not found')
  }
  if (text.includes(wOld)) text = text.replace(wOld, wNew)

  const tOld = `      if (tResult.status === 'fulfilled') {
        const apiTrades = (tResult.value.trades as ApiTrade[])
          .filter((t) => t && typeof t.symbol === 'string')
          .map<Trade>((t) => ({`
  const tNew = `      if (tResult.status === 'fulfilled') {
        const rawTrades = Array.isArray(tResult.value?.trades) ? tResult.value.trades : []
        const apiTrades = (rawTrades as ApiTrade[])
          .filter((t) => t && typeof t.symbol === 'string')
          .map<Trade>((t) => ({`
  if (!text.includes(tOld) && !text.includes('Array.isArray(tResult.value?.trades)')) {
    throw new Error('trades pattern not found')
  }
  if (text.includes(tOld)) text = text.replace(tOld, tNew)

  return text
}

async function main() {
  // Prefer local complete file if already restored (>10KB and has guards)
  if (existsSync(TARGET)) {
    const local = readFileSync(TARGET, 'utf8')
    if (local.length > 10000 && local.includes('Array.isArray(hResult.value?.holdings)')) {
      console.log('portfolioStore.ts already complete with guards — skip restore')
      return
    }
  }

  console.log(`Fetching portfolioStore.ts from ${GOOD_COMMIT}...`)
  const res = await fetch(RAW_URL)
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
  const raw = await res.text()
  if (raw.length < 10000) throw new Error(`fetched file too small (${raw.length} bytes)`)

  const restored = applyGuards(raw)
  writeFileSync(TARGET, restored, 'utf8')
  console.log(`Wrote ${TARGET} (${restored.length} bytes) with Array.isArray guards`)
}

main().catch((err) => {
  console.error('restore-portfolio-store failed:', err.message)
  process.exit(1)
})
