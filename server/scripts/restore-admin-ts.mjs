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

function injectUsersCount(src) {
  if (src.includes('_count: {') && src.includes("router.get('/users'")) return src
  const fragile = `select: {
          id: true, email: true, name: true, role: true, suspended: true, kycStatus: true,
          createdAt: true, investmentId: true, emailVerified: true, holdActive: true,
        },`
  const robust = `select: {
          id: true, email: true, name: true, role: true, suspended: true, kycStatus: true,
          createdAt: true, investmentId: true, emailVerified: true, holdActive: true,
          holdType: true, twoFactor: true, updatedAt: true,
          _count: { select: { holdings: true, trades: true, transactions: true, alerts: true } },
        },`
  if (src.includes(fragile)) return src.replace(fragile, robust)
  const fragile2 = `id: true, email: true, name: true, role: true, suspended: true, kycStatus: true,
          createdAt: true, investmentId: true, emailVerified: true, holdActive: true,`
  const idx = src.indexOf("router.get('/users'")
  if (idx >= 0 && src.includes(fragile2) && !src.slice(idx, idx + 800).includes('_count')) {
    return src.replace(fragile2, fragile2 + '\n          holdType: true, twoFactor: true, updatedAt: true,\n          _count: { select: { holdings: true, trades: true, transactions: true, alerts: true } },')
  }
  return src
}

function injectFeeRoutes(src) {
  if (src.includes('withdrawal-fee-config')) return src
  const fee = `

const FEE_KEY = 'withdrawal_fee_percent'
router.get('/withdrawal-fee-config', async (_req, res) => {
  try {
    let row = await prisma.appSetting.findUnique({ where: { key: FEE_KEY } })
    if (!row) row = await prisma.appSetting.create({ data: { key: FEE_KEY, value: '11.8', updatedBy: 'system' } })
    const ratePct = Number(row.value)
    res.json({ ratePct: Number.isFinite(ratePct) ? ratePct : 11.8, key: FEE_KEY })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load fee' })
  }
})
router.put('/withdrawal-fee-config', async (req, res) => {
  try {
    const ratePct = Number(req.body?.ratePct ?? req.body?.value)
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      res.status(400).json({ error: 'ratePct must be a number between 0 and 100' })
      return
    }
    const value = String(ratePct)
    const adminEmail = req.userId ?? 'admin'
    const row = await prisma.appSetting.upsert({
      where: { key: FEE_KEY },
      create: { key: FEE_KEY, value, updatedBy: String(adminEmail) },
      update: { value, updatedBy: String(adminEmail) },
    })
    res.json({ ratePct: Number(row.value), key: FEE_KEY })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save fee' })
  }
})
`
  return src.replace('export default router', fee + '\nexport default router')
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
  if (fs.existsSync(out)) {
    const existing = fs.readFileSync(out, 'utf8')
    if (
      existing.length >= MIN_BYTES &&
      existing.includes('export default router') &&
      existing.includes("router.get('/users'") &&
      !existing.includes('Placeholder overwritten')
    ) {
      let src = injectUsersCount(injectFeeRoutes(applyNeverTypeFix(existing)))
      fs.writeFileSync(out, src)
      console.log('[restore-admin] kept committed admin.ts', src.length, 'chars')
      return
    }
  }
  let src = tryLocalParts()
  if (!src) {
    console.log('[restore-admin] fetching known-good admin.ts from', GOOD_COMMIT)
    src = await fetchGood()
  } else {
    console.log('[restore-admin] using local parts/b64', src.length, 'chars')
  }
  src = injectUsersCount(injectFeeRoutes(applyNeverTypeFix(src)))
  fs.writeFileSync(out, src)
  console.log('[restore-admin] wrote', out, src.length, 'chars')
}

main().catch((e) => {
  console.error('[restore-admin] failed', e)
  process.exit(1)
})
