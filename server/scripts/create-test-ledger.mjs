import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function toMinorUnits(amount, currency = 'USD') {
  const decimals = currency === 'USD' ? 2 : 2
  const multiplier = 10 ** decimals
  return BigInt(Math.round(amount * multiplier))
}

function fromMinorUnits(minor, currency = 'USD') {
  const decimals = currency === 'USD' ? 2 : 2
  const scale = Number(10 ** decimals)
  return Number(minor) / scale
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
    where, data: {
      balanceMinorUnits: { increment: balanceDelta },
      availableMinorUnits: { increment: availableDelta },
      pendingMinorUnits: { increment: pendingDelta },
      reconciliationStatus: 'pending',
      lastReconciled: new Date(),
    }
  })
}

async function main() {
  const testEmail = process.env.TEST_USER_EMAIL || 'local.test+1@example.com'
  const userRec = await prisma.user.findUnique({ where: { email: testEmail } })
  if (!userRec) {
    console.error('Test user not found. Run `node scripts/seed-test-user.mjs` first.')
    process.exit(1)
  }
  const userId = userRec.id

  await prisma.$transaction(async (tx) => {
    // helper to create financial event + ledger entry + account/wallet upserts + optional transaction
    async function createEntry({ amount, entryType, kind, eventType, sourceType, sourceId, externalRef, description, recordTransaction = false, pending = false }) {
      const createdAt = new Date()
      const amountMinor = toMinorUnits(amount, 'USD')
      const balanceDelta = pending ? 0n : (entryType === 'debit' ? amountMinor : -amountMinor)
      const availableDelta = pending ? (entryType === 'debit' ? 0n : -amountMinor) : balanceDelta
      const pendingDelta = pending ? amountMinor : 0n

      const event = await tx.financialEvent.create({ data: {
        userId,
        eventType,
        eventStatus: pending ? 'pending' : 'completed',
        ledgerEntryIds: JSON.stringify([]),
        externalRef,
        idempotencyKey: externalRef,
        completedAt: pending ? null : createdAt,
        createdAt,
      }})

      const entry = await tx.ledgerEntry.create({ data: {
        correlationId: `${event.id}:${sourceType}:${sourceId}`,
        userId,
        asset: 'USD',
        amountMinorUnits: amountMinor,
        entryType,
        kind,
        status: pending ? 'pending' : 'completed',
        sourceType,
        sourceId,
        description,
        idempotencyKey: externalRef,
        createdBy: 'dev',
        createdAt,
      }})

      await tx.financialEvent.update({ where: { id: event.id }, data: { ledgerEntryIds: JSON.stringify([entry.id]) } })

      const accountBalance = await ensureUpsertAccountBalance(tx, userId, 'USD', balanceDelta, availableDelta, pendingDelta)

      await tx.walletBalance.upsert({ where: { userId_currency: { userId, currency: 'USD' } }, create: {
        userId, currency: 'USD', symbol: '$', balance: fromMinorUnits(accountBalance.balanceMinorUnits, 'USD'), available: fromMinorUnits(accountBalance.availableMinorUnits, 'USD'), balanceMinorUnits: accountBalance.balanceMinorUnits, availableMinorUnits: accountBalance.availableMinorUnits
      }, update: {
        balance: fromMinorUnits(accountBalance.balanceMinorUnits, 'USD'), available: fromMinorUnits(accountBalance.availableMinorUnits, 'USD'), balanceMinorUnits: accountBalance.balanceMinorUnits, availableMinorUnits: accountBalance.availableMinorUnits, symbol: '$'
      }})

      if (recordTransaction) {
        await tx.transaction.create({ data: {
          userId, kind, currency: 'USD', amount: entryType === 'debit' ? amount : -amount, status: pending ? 'pending' : 'completed', reference: description
        }})
      }
    }

    // Opening deposit
    await createEntry({ amount: 1000, entryType: 'debit', kind: 'deposit', eventType: 'test:deposit:opening', sourceType: 'test_seed', sourceId: 'deposit:1', externalRef: `test_seed:deposit:1:${userId}`, description: 'Test opening deposit', recordTransaction: true, pending: false })

    // Fee
    await createEntry({ amount: 10, entryType: 'credit', kind: 'fee', eventType: 'test:fee:deposit', sourceType: 'test_seed', sourceId: 'fee:1', externalRef: `test_seed:fee:1:${userId}`, description: 'Test deposit fee', recordTransaction: true, pending: false })

    // Withdrawal completed
    await createEntry({ amount: 200, entryType: 'credit', kind: 'withdraw', eventType: 'test:withdrawal:completed', sourceType: 'test_seed', sourceId: 'withdraw:1', externalRef: `test_seed:withdraw:1:${userId}`, description: 'Test completed withdrawal', recordTransaction: true, pending: false })

    // Pending withdrawal
    await createEntry({ amount: 300, entryType: 'credit', kind: 'withdraw', eventType: 'test:withdrawal:pending', sourceType: 'test_seed', sourceId: 'withdraw:2', externalRef: `test_seed:withdraw:2:${userId}`, description: 'Test pending withdrawal', recordTransaction: true, pending: true })

    // Reservation (lock)
    const reserveAmountMinor = toMinorUnits(50, 'USD')
    const reserveEvent = await tx.financialEvent.create({ data: {
      userId, eventType: 'test:reserve', eventStatus: 'completed', ledgerEntryIds: JSON.stringify([]), externalRef: `test_seed:reserve:1:${userId}`, idempotencyKey: `test_seed:reserve:1:${userId}`, completedAt: new Date(), createdAt: new Date()
    }})
    const reserveEntry = await tx.ledgerEntry.create({ data: {
      correlationId: `${reserveEvent.id}:test_seed:reserve:1`, userId, asset: 'USD', amountMinorUnits: reserveAmountMinor, entryType: 'credit', kind: 'reserve', status: 'completed', sourceType: 'test_seed', sourceId: 'reserve:1', description: 'Test reserve lock', idempotencyKey: `test_seed:reserve:1:${userId}`, createdBy: 'dev', createdAt: new Date()
    }})
    await tx.financialEvent.update({ where: { id: reserveEvent.id }, data: { ledgerEntryIds: JSON.stringify([reserveEntry.id]) } })
    await ensureUpsertAccountBalance(tx, userId, 'USD', 0n, -reserveAmountMinor, 0n)

  })

  console.log('Test ledger entries created for', userId)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
