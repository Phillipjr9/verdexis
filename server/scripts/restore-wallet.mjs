/**
 * Restores server/src/routes/wallet.ts if corrupted (PLACEHOLDER / empty).
 * Then applies transactionId + alertAdminsOfDeposit for fiat pending deposits.
 * Also restores/hardens admin-pending-deposits.ts.
 * Runs as part of `npm run build`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const walletPath = path.join(__dirname, '../src/routes/wallet.ts')
const apdPath = path.join(__dirname, '../src/routes/admin-pending-deposits.ts')

function isUsable(text, min = 500) {
  if (!text || text.length < min) return false
  if (/PLACEHOLDER/i.test(text)) return false
  if (text.trim() === 'SEE_FILE') return false
  return text.includes('export default') || text.includes('Router')
}

const GOOD_WALLET =
  'https://raw.githubusercontent.com/Phillipjr9/verdexis/934cfb2a1eea22a4ef5194ad672b6a86c1e11d1f/server/src/routes/wallet.ts'
const GOOD_APD =
  'https://raw.githubusercontent.com/Phillipjr9/verdexis/934cfb2a1eea22a4ef5194ad672b6a86c1e11d1f/server/src/routes/admin-pending-deposits.ts'

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function patchWallet(wt) {
  let changed = false
  if (!wt.includes("from '../utils/transactionIdGenerator.js'")) {
    if (wt.includes("from '../services/depositAlerts.js'")) {
      wt = wt.replace(
        "import { alertAdminsOfDeposit } from '../services/depositAlerts.js'",
        "import { alertAdminsOfDeposit } from '../services/depositAlerts.js'\nimport { generateTransactionId } from '../utils/transactionIdGenerator.js'",
      )
      changed = true
    }
  }

  const oldCreate = `      const transaction = await tx.transaction.create({
        data: {
          userId: req.userId!,
          kind,
          currency,
          amount,
          reference: reference ? \`\${reference} (pending review)\` : 'Deposit request (pending review)',
          status: 'pending',
        } as any,
      })`

  const newCreate = `      const transaction = await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(),
          userId: req.userId!,
          kind,
          currency,
          amount,
          reference: reference ? \`\${reference} (pending review)\` : 'Deposit request (pending review)',
          status: 'pending',
        } as any,
      })`

  if (wt.includes(oldCreate) && !wt.includes('transactionId: generateTransactionId()')) {
    wt = wt.replace(oldCreate, newCreate)
    changed = true
  }

  const oldAlert = `  if ('pendingApproval' in result && result.pendingApproval) {
    // Regular transaction deposits use the existing admin deposit queue. The
    // email action route is reserved for pending on-chain deposit records.
  }
  res.status(201).json(result)`

  const newAlert = `  if ('pendingApproval' in result && result.pendingApproval) {
    const txRow = (result as { transaction?: { id?: string } }).transaction
    try {
      await alertAdminsOfDeposit(
        req.userId!,
        amount,
        currency,
        txRow?.id || 'pending',
        \`Fiat/manual deposit request \${txRow?.id || ''}; amount \${amount} \${currency}. Open /admin/queues to approve.\`,
      )
    } catch (e) {
      console.error('[wallet] alertAdminsOfDeposit failed', e)
    }
  }
  res.status(201).json(result)`

  if (wt.includes(oldAlert)) {
    wt = wt.replace(oldAlert, newAlert)
    changed = true
  }

  return { wt, changed }
}

function hardenApd(text) {
  if (text.includes('byKind') && text.includes("kind: { in: ['deposit'")) {
    return { text, changed: false }
  }
  const oldList = `      const candidates = await prisma.transaction.findMany({
        where: { status: { in: pendingStatuses } },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      txRows = candidates.filter((t) => String(t.kind || '').toLowerCase().includes('deposit'))`

  const newList = `      const byKind = await prisma.transaction.findMany({
        where: {
          status: { in: pendingStatuses },
          kind: { in: ['deposit', 'Deposit', 'DEPOSIT'] },
        },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      const candidates = await prisma.transaction.findMany({
        where: { status: { in: pendingStatuses } },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      const seen = new Set(byKind.map((t) => t.id))
      const extra = candidates.filter((t) => {
        if (seen.has(t.id)) return false
        const k = String(t.kind || '').toLowerCase()
        const r = String(t.reference || '').toLowerCase()
        return k.includes('deposit') || r.includes('deposit') || r.includes('pending review')
      })
      txRows = [...byKind, ...extra]`

  if (text.includes(oldList)) {
    return { text: text.replace(oldList, newList), changed: true }
  }
  return { text, changed: false }
}

async function main() {
  let wallet = fs.existsSync(walletPath) ? fs.readFileSync(walletPath, 'utf8') : ''
  if (!isUsable(wallet)) {
    console.warn('[restore-wallet] wallet.ts unusable; downloading good copy')
    wallet = await download(GOOD_WALLET)
    if (!isUsable(wallet)) throw new Error('Downloaded wallet.ts still unusable')
    fs.writeFileSync(walletPath, wallet)
    console.log('[restore-wallet] restored wallet.ts', wallet.length, 'bytes')
  } else {
    console.log('[restore-wallet] wallet.ts OK', wallet.length, 'bytes')
  }

  const { wt, changed } = patchWallet(wallet)
  if (changed) {
    fs.writeFileSync(walletPath, wt)
    console.log('[restore-wallet] applied transactionId + admin alert patch')
  } else {
    console.log('[restore-wallet] wallet patches already present or patterns not found')
  }

  let apd = fs.existsSync(apdPath) ? fs.readFileSync(apdPath, 'utf8') : ''
  if (!isUsable(apd, 200)) {
    console.warn('[restore-wallet] admin-pending-deposits.ts unusable; downloading')
    apd = await download(GOOD_APD)
    fs.writeFileSync(apdPath, apd)
    console.log('[restore-wallet] restored admin-pending-deposits.ts', apd.length, 'bytes')
  }
  const { text: apd2, changed: apdChanged } = hardenApd(apd)
  if (apdChanged) {
    fs.writeFileSync(apdPath, apd2)
    console.log('[restore-wallet] hardened pending-deposits list query')
  }
}

main().catch((err) => {
  console.error('[restore-wallet] failed', err)
  process.exit(1)
})
