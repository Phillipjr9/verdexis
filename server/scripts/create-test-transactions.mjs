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

async function ensureAccountBalance(tx, userId, asset) {
  const where = { userId_asset: { userId, asset } }
  const existing = await tx.accountBalance.findUnique({ where })
  if (!existing) {
    return tx.accountBalance.create({ data: {
      userId, asset, balanceMinorUnits: 0n, availableMinorUnits: 0n, lockedMinorUnits: 0n, pendingMinorUnits: 0n, reconciliationStatus: 'pending', lastReconciled: new Date()
    }})
  }
  return existing
}

async function upsertWalletBalanceFromAccount(tx, userId, asset) {
  const acc = await tx.accountBalance.findUnique({ where: { userId_asset: { userId, asset } } })
  const bal = acc ? fromMinorUnits(acc.balanceMinorUnits, asset) : 0
  const avail = acc ? fromMinorUnits(acc.availableMinorUnits, asset) : 0
  return tx.walletBalance.upsert({
    where: { userId_currency: { userId, currency: asset } },
    create: { userId, currency: asset, symbol: asset === 'USD' ? '$' : asset, balance: bal, available: avail, balanceMinorUnits: acc?.balanceMinorUnits ?? 0n, availableMinorUnits: acc?.availableMinorUnits ?? 0n },
    update: { balance: bal, available: avail, balanceMinorUnits: acc?.balanceMinorUnits ?? 0n, availableMinorUnits: acc?.availableMinorUnits ?? 0n, symbol: asset === 'USD' ? '$' : asset }
  })
}

async function createLedgerEntry(tx, { userId, asset = 'USD', amount, entryType, kind, description, recordTransaction = true, idempotencyKey = undefined, pending = false }) {
  const createdAt = new Date()
  const amountMinor = toMinorUnits(amount, asset)
  const balanceDelta = pending ? 0n : (entryType === 'debit' ? amountMinor : -amountMinor)
  const availableDelta = pending ? (entryType === 'debit' ? 0n : -amountMinor) : balanceDelta
  const pendingDelta = pending ? amountMinor : 0n

  const ev = await tx.financialEvent.create({ data: {
    userId, eventType: `test:${kind}`, eventStatus: pending ? 'pending' : 'completed', ledgerEntryIds: JSON.stringify([]), externalRef: idempotencyKey ?? `test:${kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`, idempotencyKey: idempotencyKey ?? undefined, completedAt: pending ? null : createdAt, createdAt
  }})

  const entry = await tx.ledgerEntry.create({ data: {
    correlationId: `${ev.id}:test`, userId, asset, amountMinorUnits: amountMinor, entryType, kind, status: pending ? 'pending' : 'completed', sourceType: 'test_script', sourceId: ev.id, description, idempotencyKey: idempotencyKey ?? undefined, createdBy: 'dev', createdAt
  }})

  await tx.financialEvent.update({ where: { id: ev.id }, data: { ledgerEntryIds: JSON.stringify([entry.id]) } })

  await tx.accountBalance.upsert({ where: { userId_asset: { userId, asset } }, create: {
    userId, asset, balanceMinorUnits: balanceDelta, availableMinorUnits: availableDelta, lockedMinorUnits: 0n, pendingMinorUnits: pendingDelta, reconciliationStatus: 'pending', lastReconciled: new Date()
  }, update: {
    balanceMinorUnits: { increment: balanceDelta }, availableMinorUnits: { increment: availableDelta }, pendingMinorUnits: { increment: pendingDelta }, reconciliationStatus: 'pending', lastReconciled: new Date()
  }})

  await upsertWalletBalanceFromAccount(tx, userId, asset)

  if (recordTransaction) {
    await tx.transaction.create({ data: { userId, kind, currency: asset, amount: entryType === 'debit' ? amount : -amount, status: pending ? 'pending' : 'completed', reference: description } })
  }
  return entry
}

async function main() {
  const senderEmail = process.env.SENDER_EMAIL || 'admin@verdexisgroup.com'
  const recipientEmail = process.env.RECIPIENT_EMAIL || 'local.test+1@example.com'
  const sender = await prisma.user.findUnique({ where: { email: senderEmail } })
  const recipient = await prisma.user.findUnique({ where: { email: recipientEmail } })
  if (!sender || !recipient) {
    console.error('Sender or recipient not found in DB:', { sender: !!sender, recipient: !!recipient })
    process.exit(1)
  }

  await prisma.$transaction(async (tx) => {
    // 1) Transfer 100 USD from sender -> recipient
    await ensureAccountBalance(tx, sender.id, 'USD')
    await ensureAccountBalance(tx, recipient.id, 'USD')

    await createLedgerEntry(tx, { userId: sender.id, amount: 100, entryType: 'credit', kind: 'transfer', description: `Transfer to ${recipient.email}`, idempotencyKey: `test_transfer_out:${Date.now()}:${Math.random().toString(36).slice(2)}` })
    await createLedgerEntry(tx, { userId: recipient.id, amount: 100, entryType: 'debit', kind: 'deposit', description: `Transfer from ${sender.email}`, idempotencyKey: `test_transfer_in:${Date.now()}:${Math.random().toString(36).slice(2)}` })

    // 2) Sender withdrawal of 25 USD
    await createLedgerEntry(tx, { userId: sender.id, amount: 25, entryType: 'credit', kind: 'withdraw', description: 'Test withdraw to external wallet', idempotencyKey: `test_withdraw:${Date.now()}:${Math.random().toString(36).slice(2)}` })

    // 3) Recipient swap: USD -> BTC (simulate rate: 1 USD -> 0.00002 BTC i.e. 50 USD -> 0.001 BTC)
    const usdOut = 50
    const btcIn = 0.001
    await createLedgerEntry(tx, { userId: recipient.id, amount: usdOut, entryType: 'credit', kind: 'swap', description: `Swap USD->BTC out`, idempotencyKey: `test_swap_usd_out:${Date.now()}:${Math.random().toString(36).slice(2)}` })
    await createLedgerEntry(tx, { userId: recipient.id, asset: 'BTC', amount: btcIn, entryType: 'debit', kind: 'swap', description: `Swap USD->BTC in`, idempotencyKey: `test_swap_btc_in:${Date.now()}:${Math.random().toString(36).slice(2)}` })

    // 4) Recipient buy 0.0005 BTC using USD (buy), then sell 0.0003 BTC
    const buyUsd = 20
    const buyBtc = 0.0005
    await createLedgerEntry(tx, { userId: recipient.id, amount: buyUsd, entryType: 'credit', kind: 'trade', description: `Trade buy BTC`, idempotencyKey: `test_trade_buy_out:${Date.now()}:${Math.random().toString(36).slice(2)}` })
    // create holding record for BTC
    const holding = await tx.holding.upsert({ where: { userId_symbol: { userId: recipient.id, symbol: 'BTC' } }, create: { userId: recipient.id, symbol: 'BTC', name: 'Bitcoin', amount: buyBtc, avgPrice: buyUsd / buyBtc, type: 'crypto' }, update: { amount: { increment: buyBtc } } })

    const sellBtc = 0.0003
    const sellUsd = 12
    // reduce holding
    await tx.holding.update({ where: { id: holding.id }, data: { amount: { decrement: sellBtc } } })
    await createLedgerEntry(tx, { userId: recipient.id, asset: 'BTC', amount: sellBtc, entryType: 'credit', kind: 'trade', description: `Trade sell BTC out`, idempotencyKey: `test_trade_sell_btc:${Date.now()}:${Math.random().toString(36).slice(2)}` })
    await createLedgerEntry(tx, { userId: recipient.id, amount: sellUsd, entryType: 'debit', kind: 'trade', description: `Trade sell BTC in`, idempotencyKey: `test_trade_sell_usd:${Date.now()}:${Math.random().toString(36).slice(2)}` })
  })

  console.log('Test transactions completed: transfer, withdraw, swap, buy/sell')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
