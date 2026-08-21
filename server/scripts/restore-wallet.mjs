/**
 * Restores wallet.ts and admin-pending-deposits.ts if corrupted (PLACEHOLDER / SEE_FILE / empty).
 * Prefers local base64 snapshot (scripts/wallet.restore.b64), then GitHub raw fallback.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const walletPath = path.join(__dirname, '../src/routes/wallet.ts')
const apdPath = path.join(__dirname, '../src/routes/admin-pending-deposits.ts')
const localB64 = path.join(__dirname, 'wallet.restore.b64')

function isUsable(text, min = 500) {
  if (!text || text.length < min) return false
  if (/PLACEHOLDER/i.test(text)) return false
  if (text.trim() === 'SEE_FILE') return false
  return text.includes('export default') || text.includes('Router')
}

const GOOD_WALLET =
  'https://raw.githubusercontent.com/Phillipjr9/verdexis/934cfb2a1eea22a4ef5194ad672b6a86c1e11d1f/server/src/routes/wallet.ts'
const GOOD_APD =
  'https://raw.githubusercontent.com/Phillipjr9/verdexis/7c46b5d005b2341eee0330c5250e2f38261cd63f/server/src/routes/admin-pending-deposits.ts'

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function fromLocalB64() {
  if (!fs.existsSync(localB64)) return null
  try {
    const b64 = fs.readFileSync(localB64, 'utf8').replace(/\s+/g, '')
    const text = Buffer.from(b64, 'base64').toString('utf8')
    return isUsable(text) ? text : null
  } catch {
    return null
  }
}

async function main() {
  let wallet = fs.existsSync(walletPath) ? fs.readFileSync(walletPath, 'utf8') : ''
  if (!isUsable(wallet)) {
    console.warn('[restore-wallet] wallet.ts unusable; trying local b64 then download')
    wallet = fromLocalB64() || ''
    if (!isUsable(wallet)) {
      wallet = await download(GOOD_WALLET)
    }
    if (!isUsable(wallet)) throw new Error('Could not restore wallet.ts')
    fs.writeFileSync(walletPath, wallet)
    console.log('[restore-wallet] restored wallet.ts', wallet.length, 'bytes')
  } else {
    console.log('[restore-wallet] wallet.ts OK', wallet.length, 'bytes')
  }

  let apd = fs.existsSync(apdPath) ? fs.readFileSync(apdPath, 'utf8') : ''
  if (!isUsable(apd, 200)) {
    console.warn('[restore-wallet] admin-pending-deposits.ts unusable; downloading')
    apd = await download(GOOD_APD)
    if (!isUsable(apd, 200)) throw new Error('Could not restore admin-pending-deposits.ts')
    fs.writeFileSync(apdPath, apd)
    console.log('[restore-wallet] restored admin-pending-deposits.ts', apd.length, 'bytes')
  } else {
    console.log('[restore-wallet] admin-pending-deposits.ts OK', apd.length, 'bytes')
  }
}

main().catch((err) => {
  console.error('[restore-wallet] failed', err)
  process.exit(1)
})
