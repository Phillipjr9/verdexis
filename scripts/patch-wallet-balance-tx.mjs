/**
 * Build-time patch for Wallet.tsx:
 * 1. Total Balance never stuck on "Loading…"
 * 2. Mask Total Balance + Cash/Crypto when eye is toggled
 * 3. Transaction history uses proper +/− signed amounts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(__dirname, '..', 'app/src/pages/Wallet.tsx')

function main() {
  if (!fs.existsSync(TARGET)) {
    console.warn('patch-wallet-balance-tx: Wallet.tsx missing — skip')
    return
  }
  let src = fs.readFileSync(TARGET, 'utf8')
  let n = 0

  // 1) Remove Loading… gate on Total Balance (simple string replace)
  if (src.includes("? 'Loading…'")) {
    const before = src
    src = src.replace(
      /const hasUnpricedHoldings = holdings\.length > 0 && !isMarketReady\s*\n\s*const formatted = hasUnpricedHoldings\s*\n\s*\? 'Loading…'\s*\n\s*: /,
      'const formatted = ',
    )
    if (src !== before) {
      n++
      console.log('patched: Total Balance Loading gate removed')
    }
  } else {
    console.log('skip: Total Balance Loading gate already gone')
  }

  // 2) Mask Cash / Crypto lines when showBalance is false
  if (src.includes('${cashUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>')
      && !src.includes('const v = `$${cashUsd.toLocaleString')) {
    src = src.replace(
      'Cash <span className="text-[#A0A0A0]">${cashUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>',
      'Cash <span className="text-[#A0A0A0]">{(() => { const v = `$${cashUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`; return showBalance ? v : v.replace(/\\d/g, \'*\') })()}</span></span>',
    )
    src = src.replace(
      'Crypto <span className="text-[#A0A0A0]">${holdingsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>',
      'Crypto <span className="text-[#A0A0A0]">{(() => { const v = `$${holdingsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`; return showBalance ? v : v.replace(/\\d/g, \'*\') })()}</span></span>',
    )
    n++
    console.log('patched: Cash/Crypto mask')
  } else {
    console.log('skip: Cash/Crypto mask')
  }

  // 3) signedTxAmount helper
  if (!src.includes('const signedTxAmount =')) {
    const anchor = '  const getTransactionIcon = (type: string) => {'
    if (src.includes(anchor)) {
      const helper =
        '  // Normalize amount sign for history: deposits/credits positive, withdraw/fee\n' +
        '  // negative. Transfer keeps stored sign (out = negative, in = positive).\n' +
        '  const signedTxAmount = (tx: WalletTransaction): number => {\n' +
        "    const abs = Math.abs(typeof tx.amount === 'number' && isFinite(tx.amount) ? tx.amount : 0)\n" +
        "    if (tx.type === 'withdraw' || (tx.type as string) === 'fee') return -abs\n" +
        "    if (tx.type === 'deposit' || tx.type === 'dividend' || tx.type === 'interest') return abs\n" +
        "    return typeof tx.amount === 'number' && isFinite(tx.amount) ? tx.amount : 0\n" +
        '  }\n\n'
      src = src.replace(anchor, helper + anchor)
      n++
      console.log('patched: signedTxAmount helper')
    }
  } else {
    console.log('skip: signedTxAmount helper')
  }

  // 3b) list row amounts
  if (src.includes("tx.amount > 0 ? 'text-[#4CAF50]' : tx.amount < 0 ? 'text-[#f44336]'")
      && !src.includes('signedTxAmount(tx) > 0')) {
    src = src.replace(
      "tx.amount > 0 ? 'text-[#4CAF50]' : tx.amount < 0 ? 'text-[#f44336]' : 'text-[#E5E5E5]'`}>\n                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, {\n                          minimumFractionDigits: tx.currency === 'USD' ? 2 : 0,\n                          maximumFractionDigits: tx.currency === 'USD' ? 2 : 8,\n                        })} {tx.currency}",
      "signedTxAmount(tx) > 0 ? 'text-[#4CAF50]' : signedTxAmount(tx) < 0 ? 'text-[#f44336]' : 'text-[#E5E5E5]'`}>\n                        {(() => {\n                          const signed = signedTxAmount(tx)\n                          const body = Math.abs(signed).toLocaleString(undefined, {\n                            minimumFractionDigits: tx.currency === 'USD' ? 2 : 0,\n                            maximumFractionDigits: tx.currency === 'USD' ? 2 : 8,\n                          })\n                          return `${signed > 0 ? '+' : signed < 0 ? '−' : ''}${body} ${tx.currency}`\n                        })()}",
    )
    n++
    console.log('patched: list signed amounts')
  } else {
    console.log('skip: list signed amounts')
  }

  // 3c) modal amounts
  if (src.includes("selectedTx.amount > 0 ? 'text-[#4CAF50]' : selectedTx.amount < 0")
      && !src.includes('signedTxAmount(selectedTx)')) {
    src = src.replace(
      "selectedTx.amount > 0 ? 'text-[#4CAF50]' : selectedTx.amount < 0 ? 'text-[#f44336]' : 'text-[#E5E5E5]'`}>\n                  {selectedTx.amount > 0 ? '+' : ''}\n                  {selectedTx.amount.toLocaleString(undefined, {\n                    minimumFractionDigits: selectedTx.currency === 'USD' ? 2 : 0,\n                    maximumFractionDigits: selectedTx.currency === 'USD' ? 2 : 8,\n                  })}",
      "signedTxAmount(selectedTx) > 0 ? 'text-[#4CAF50]' : signedTxAmount(selectedTx) < 0 ? 'text-[#f44336]' : 'text-[#E5E5E5]'`}>\n                  {(() => {\n                    const signed = signedTxAmount(selectedTx)\n                    const body = Math.abs(signed).toLocaleString(undefined, {\n                      minimumFractionDigits: selectedTx.currency === 'USD' ? 2 : 0,\n                      maximumFractionDigits: selectedTx.currency === 'USD' ? 2 : 8,\n                    })\n                    return `${signed > 0 ? '+' : signed < 0 ? '−' : ''}${body}`\n                  })()}",
    )
    n++
    console.log('patched: modal signed amounts')
  } else {
    console.log('skip: modal signed amounts')
  }

  // 4) Hydrate on mount
  if (!src.includes('setTimeout(() => setIsMarketReady(true), 2500)')) {
    const mount = '  useEffect(() => { void hydrateFromServer() }, [])'
    if (src.includes(mount)) {
      src = src.replace(
        mount,
        `  useEffect(() => { void hydrateFromServer() }, [])
  // Pull wallet + transactions promptly so Total Balance is not waiting on the 15s poll.
  useEffect(() => {
    void portfolioStore.hydrate(true)
    const t = window.setTimeout(() => setIsMarketReady(true), 2500)
    return () => window.clearTimeout(t)
  }, [])`,
        1,
      )
      n++
      console.log('patched: hydrate on mount')
    }
  } else {
    console.log('skip: hydrate on mount')
  }

  if (n === 0) {
    console.log('patch-wallet-balance-tx: nothing to change')
    return
  }
  fs.writeFileSync(TARGET, src)
  console.log('Wrote', TARGET, 'patches=', n)
}

main()
