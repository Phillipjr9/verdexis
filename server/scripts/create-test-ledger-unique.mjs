import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function toMinorUnits(amount, currency = 'USD') {
  const decimals = currency === 'USD' ? 2 : 2
  return BigInt(Math.round(amount * 10 ** decimals))
}

function fromMinorUnits(minor, currency = 'USD') {
  const decimals = currency === 'USD' ? 2 : 2
  return Number(minor) / (10 ** decimals)
}

async function ensureUpsertAccountBalance(tx, userId, asset, balanceDelta, availableDelta, pendingDelta) {
  const where = { userId_asset: { userId, asset } }
  const existing = await tx.accountBalance.findUnique({ where })
  if (!existing) {
    return tx.accountBalance.create({
      data: {
        userId,
        asset,
        balanceMinorUnits: balanceDelta,
        availableMinorUnits: availableDelta,
        lockedMinorUnits: 0n,
        pendingMinorUnits: pendingDelta,
        reconciliationStatus: 'pending',
        lastReconciled: new Date(),
      },
    })
  }
  return tx.accountBalance.update({
    where,
    data: {
      balanceMinorUnits: { increment: balanceDelta },
      availableMinorUnits: { increment: availableDelta },
      pendingMinorUnits: { increment: pendingDelta },
      reconciliationStatus: 'pending',
      lastReconciled: new Date(),
    },
  })
}

async function createEntry(tx, userId, { amount, entryType, kind, label, pending = false, recordTransaction = true }) {
  const createdAt = new Date()
  const amountMinor = toMinorUnits(amount)
  const balanceDelta = pending ? 0n : (entryType === 'debit' ? amountMinor : -amountMinor)
  const availableDelta = pending ? (entryType === 'debit' ? 0n : -amountMinor) : balanceDelta
  const pendingDelta = pending ? amountMinor : 0n
  const uniq = `${Date.now()}-${Math.floor(Math.random()*100000)}-${kind}`
  const idemp = `test_unique:${uniq}:${userId}`
  const ev = await tx.financialEvent.create({ data: {
    userId,
    eventType: `test:${kind}`,
    eventStatus: pending ? 'pending' : 'completed',
    ledgerEntryIds: JSON.stringify([]),
    externalRef: idemp,
    idempotencyKey: idemp,
    completedAt: pending ? null : createdAt,
    createdAt,
  }})

  const entry = await tx.ledgerEntry.create({ data: {
    correlationId: `${ev.id}:test`,
    userId,
    asset: 'USD',
    amountMinorUnits: amountMinor,
    entryType,
    kind,
    status: pending ? 'pending' : 'completed',
    sourceType: 'test_unique',
    sourceId: uniq,
    description: label,
    idempotencyKey: idemp,
    createdBy: 'dev',
    createdAt,
  }})

  await tx.financialEvent.update({ where: { id: ev.id }, data: { ledgerEntryIds: JSON.stringify([entry.id]) } })

  const ab = await ensureUpsertAccountBalance(tx, userId, 'USD', balanceDelta, availableDelta, pendingDelta)
  await tx.walletBalance.upsert({ where: { userId_currency: { userId, currency: 'USD' } }, create: {
    userId, currency: 'USD', symbol: '$', balance: fromMinorUnits(ab.balanceMinorUnits), available: fromMinorUnits(ab.availableMinorUnits), balanceMinorUnits: ab.balanceMinorUnits, availableMinorUnits: ab.availableMinorUnits
  }, update: {
    balance: fromMinorUnits(ab.balanceMinorUnits), available: fromMinorUnits(ab.availableMinorUnits), balanceMinorUnits: ab.balanceMinorUnits, availableMinorUnits: ab.availableMinorUnits, symbol: '$'
  }})

  if (recordTransaction) {
    await tx.transaction.create({ data: {
      userId, kind, currency: 'USD', amount: entryType === 'debit' ? amount : -amount, status: pending ? 'pending' : 'completed', reference: label
    }})
  }
}

async function main() {
  const userId = process.env.TEST_USER_ID
  if (!userId) {
    console.error('Please set TEST_USER_ID to target existing user id (e.g., from sqlite query).')
    process.exit(1)
  }

  await prisma.$transaction(async (tx) => {
    await createEntry(tx, userId, { amount: 1000, entryType: 'debit', kind: 'deposit', label: 'Unique test deposit', pending: false })
    await createEntry(tx, userId, { amount: 10, entryType: 'credit', kind: 'fee', label: 'Unique test fee', pending: false })
    await createEntry(tx, userId, { amount: 200, entryType: 'credit', kind: 'withdraw', label: 'Unique test withdrawal', pending: false })
    await createEntry(tx, userId, { amount: 300, entryType: 'credit', kind: 'withdraw', label: 'Unique test withdrawal pending', pending: true })

    // Reservation
    const reserveAmount = toMinorUnits(50)
    const uniq = `${Date.now()}-${Math.floor(Math.random()*100000)}-reserve`
    const idemp = `test_unique:reserve:${uniq}:${userId}`
    const ev = await tx.financialEvent.create({ data: {
      userId, eventType: 'test:reserve', eventStatus: 'completed', ledgerEntryIds: JSON.stringify([]), externalRef: idemp, idempotencyKey: idemp, completedAt: new Date(), createdAt: new Date()
    }})
    const entry = await tx.ledgerEntry.create({ data: {
      correlationId: `${ev.id}:test`, userId, asset: 'USD', amountMinorUnits: reserveAmount, entryType: 'credit', kind: 'reserve', status: 'completed', sourceType: 'test_unique', sourceId: uniq, description: 'Unique test reserve', idempotencyKey: idemp, createdBy: 'dev', createdAt: new Date()
    }})
    await tx.financialEvent.update({ where: { id: ev.id }, data: { ledgerEntryIds: JSON.stringify([entry.id]) } })
    await ensureUpsertAccountBalance(tx, userId, 'USD', 0n, -reserveAmount, 0n)
  })

  console.log('Unique test ledger entries created for', userId)
}

main().catch((e) => { console.error(e); process.exit(1) })
