import { prisma } from '../db.js'
import { fromMinorUnits } from '../src/services/ledger.js'

async function backfill() {
  console.log('Starting backfill of wallet minor units from AccountBalance...')
  const accountBalances = await prisma.accountBalance.findMany({})
  let count = 0
  for (const ab of accountBalances) {
    await prisma.walletBalance.upsert({
      where: { userId_currency: { userId: ab.userId, currency: ab.asset } as any },
      create: {
        userId: ab.userId,
        currency: ab.asset,
        symbol: ab.asset === 'USD' ? '$' : ab.asset,
        balance: fromMinorUnits(ab.balanceMinorUnits, ab.asset),
        available: fromMinorUnits(ab.availableMinorUnits, ab.asset),
        balanceMinorUnits: ab.balanceMinorUnits,
        availableMinorUnits: ab.availableMinorUnits,
      },
      update: {
        balance: fromMinorUnits(ab.balanceMinorUnits, ab.asset),
        available: fromMinorUnits(ab.availableMinorUnits, ab.asset),
        balanceMinorUnits: ab.balanceMinorUnits,
        availableMinorUnits: ab.availableMinorUnits,
        symbol: ab.asset === 'USD' ? '$' : ab.asset,
      },
    })
    count++
  }
  console.log(`Backfilled ${count} wallet balances.`)
}

backfill()
  .then(() => { console.log('Done'); process.exit(0) })
  .catch((err) => { console.error('Backfill failed', err); process.exit(1) })
