#!/usr/bin/env node
/**
 * Restores server/src/routes/admin.ts before tsc.
 * Prefers a full known-good file from GitHub history (always reliable on Vercel).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/routes/admin.ts')

const GOOD_COMMIT = 'e1e23e8f1389dde275cbe8ac196993d61e59c883'
const RAW_URL = `https://raw.githubusercontent.com/Phillipjr9/verdexis/${GOOD_COMMIT}/server/src/routes/admin.ts`
const MIN_BYTES = 10000

function applyNeverTypeFix(src) {
  const oldBlock = `    const referrals = await prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        referrer: { select: { id: true, email: true, name: true, referralCode: true } },
        referee: { select: { id: true, email: true, name: true } },
      },
    })
    res.json({
      referrals: referrals.map((r) => ({`

  const newBlock = `    const referrals = (await prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        referrer: { select: { id: true, email: true, name: true, referralCode: true } },
        referee: { select: { id: true, email: true, name: true } },
      },
    })) as any[]
    res.json({
      referrals: referrals.map((r: any) => ({`

  if (src.includes(oldBlock)) return src.replace(oldBlock, newBlock)
  if (src.includes('map((r: any)') || src.includes('as any[]')) return src
  return src.replace('referrals.map((r) => ({', 'referrals.map((r: any) => ({')
}

function tryLocalParts() {
  const partsDir = path.join(__dirname, 'admin_ts_parts')
  if (fs.existsSync(partsDir)) {
    const parts = fs
      .readdirSync(partsDir)
      .filter((f) => f.endsWith('.ts.part'))
      .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))
    if (parts.length) {
      const src = parts.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('')
      if (src.length >= MIN_BYTES) return src
    }
  }
  const p1 = path.join(__dirname, 'admin.ts.b64.1')
  const p2 = path.join(__dirname, 'admin.ts.b64.2')
  if (fs.existsSync(p1) && fs.existsSync(p2)) {
    const b64 = fs.readFileSync(p1, 'utf8') + fs.readFileSync(p2, 'utf8')
    const src = Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')
    if (src.length >= MIN_BYTES) return src
  }
  const dir = path.join(__dirname, 'admin_ts_b64')
  if (fs.existsSync(dir)) {
    const parts = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))
    if (parts.length) {
      const b64 = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('')
      try {
        const src = Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')
        if (src.length >= MIN_BYTES) return src
      } catch {
        /* incomplete chunks */
      }
    }
  }
  return null
}

async function fetchGood() {
  const res = await fetch(RAW_URL)
  if (!res.ok) throw new Error(`fetch ${RAW_URL} => ${res.status}`)
  const text = await res.text()
  if (!text.includes('export default router') || text.length < MIN_BYTES) {
    throw new Error(`unexpected admin.ts content length=${text.length}`)
  }
  return text
}

async function main() {
  let src = tryLocalParts()
  if (!src) {
    console.log('[restore-admin] fetching known-good admin.ts from', GOOD_COMMIT)
    src = await fetchGood()
  } else {
    console.log('[restore-admin] using local parts/b64', src.length, 'chars')
  }
  src = applyNeverTypeFix(src)
  fs.writeFileSync(out, src)
  console.log('[restore-admin] wrote', out, src.length, 'chars')
}

main().catch((e) => {
  console.error('[restore-admin] failed', e)
  process.exit(1)
})
