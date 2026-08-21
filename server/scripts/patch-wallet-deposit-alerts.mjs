/**
 * Ensures fiat pending deposits:
 *  1) get a transactionId (required by Prisma schema)
 *  2) notify admins via alertAdminsOfDeposit
 * Idempotent — safe to run every build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const walletPath = path.join(__dirname, '../src/routes/wallet.ts')

if (!fs.existsSync(walletPath)) {
  console.warn('[patch-wallet-deposit-alerts] wallet.ts not found, skip')
  process.exit(0)
}

let wt = fs.readFileSync(walletPath, 'utf8')
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

if (wt.includes(oldCreate)) {
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

if (changed) {
  fs.writeFileSync(walletPath, wt)
  console.log('[patch-wallet-deposit-alerts] patched', walletPath)
} else {
  console.log('[patch-wallet-deposit-alerts] already applied or patterns not found')
}
