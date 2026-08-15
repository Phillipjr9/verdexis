import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const targetAmount = 10000
  const cents = BigInt(Math.round(targetAmount * 100))

  console.log('Searching for records matching amount:', targetAmount, '→ minor units:', cents.toString())

  const pending = await prisma.pendingDeposit.findMany({ where: { amount: targetAmount }, take: 50 })
  const txs = await prisma.transaction.findMany({ where: { amount: targetAmount }, take: 50 })
  const abAll = await prisma.accountBalance.findMany({ where: { asset: { in: ['USD', 'USDC'] } }, take: 200 })
  const abMatches = abAll.filter((ab) => BigInt(ab.balanceMinorUnits) === cents)

  console.log('\nPendingDeposits matching amount=10000:', pending.length)
  console.log(JSON.stringify(pending, null, 2))

  console.log('\nTransactions matching amount=10000:', txs.length)
  console.log(JSON.stringify(txs, null, 2))

  console.log('\nAccountBalances with balanceMinorUnits=1000000:', abMatches.length)
  console.log(JSON.stringify(abMatches, null, 2))

  // Also show latest ledger entries around deposits
  const recentLedger = await prisma.ledgerEntry.findMany({ where: { kind: 'deposit' }, orderBy: { createdAt: 'desc' }, take: 10 })
  console.log('\nRecent ledger deposit entries (last 10):')
  const safeLedger = recentLedger.map((l) => {
    const obj = { ...l }
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'bigint') obj[k] = obj[k].toString()
    }
    return obj
  })
  console.log(JSON.stringify(safeLedger, null, 2))

  if (txs.length > 0) {
    const tx = txs[0]
    console.log('\nInspecting user and balances for transaction id:', tx.id, 'userId:', tx.userId)
    const userLedger = await prisma.ledgerEntry.findMany({ where: { userId: tx.userId }, orderBy: { createdAt: 'desc' }, take: 20 })
    const safeUserLedger = userLedger.map((l) => {
      const obj = { ...l }
      for (const k of Object.keys(obj)) if (typeof obj[k] === 'bigint') obj[k] = obj[k].toString()
      return obj
    })
    console.log('Recent ledger entries for user:', JSON.stringify(safeUserLedger, null, 2))

    const ab = await prisma.accountBalance.findUnique({ where: { userId_asset: { userId: tx.userId, asset: 'USD' } } })
    const wb = await prisma.walletBalance.findUnique({ where: { userId_currency: { userId: tx.userId, currency: 'USD' } } })
    console.log('AccountBalance for user (raw):', ab ? { ...ab, balanceMinorUnits: ab.balanceMinorUnits?.toString?.() ?? ab.balanceMinorUnits } : null)
    console.log('WalletBalance for user (raw):', wb)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error('Query failed', e); prisma.$disconnect(); process.exit(1) })
