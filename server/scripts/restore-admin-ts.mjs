#!/usr/bin/env node
/**
 * Ensures server/src/routes/admin.ts is the full routes file before tsc.
 * Never applies destructive regex transforms — only keeps a complete committed
 * file or fetches the known-good full version from git history.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/routes/admin.ts')

const GOOD_COMMIT = 'aa16ccf'
const RAW_URL = `https://raw.githubusercontent.com/Phillipjr9/verdexis/${GOOD_COMMIT}/server/src/routes/admin.ts`
const MIN_BYTES = 50000

function isComplete(src) {
  return (
    src.length >= MIN_BYTES &&
    src.includes('export default router') &&
    src.includes("router.post('/users/:id/fee'") &&
    src.includes('saved-wallet') &&
    src.includes('wallet-links') &&
    src.includes("router.post('/users/:id/holdings'") &&
    src.includes("router.post('/users/:id/transactions'") &&
    src.includes('deposit-addresses') &&
    !src.includes('Placeholder overwritten')
  )
}

async function fetchGood() {
  const res = await fetch(RAW_URL)
  if (!res.ok) throw new Error(`fetch ${RAW_URL} => ${res.status}`)
  const text = await res.text()
  if (!isComplete(text)) throw new Error(`unexpected admin.ts length=${text.length}`)
  return text
}

async function main() {
  if (fs.existsSync(out)) {
    const existing = fs.readFileSync(out, 'utf8')
    if (isComplete(existing)) {
      console.log('[restore-admin] kept committed admin.ts', existing.length, 'chars')
      return
    }
    console.log('[restore-admin] committed admin.ts incomplete (', existing.length, 'chars) — restoring')
  }
  console.log('[restore-admin] fetching known-good admin.ts from', GOOD_COMMIT)
  const src = await fetchGood()
  fs.writeFileSync(out, src)
  console.log('[restore-admin] wrote', out, src.length, 'chars')
}

main().catch((e) => {
  console.error('[restore-admin] failed', e)
  process.exit(1)
})
