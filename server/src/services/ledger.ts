import type { Prisma } from '@prisma/client'

const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2,
  USDC: 6,
  USDT: 6,
  BTC: 8,
  ETH: 18,
  SOL: 9,
  BNB: 18,
}

export function getCurrencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2
}

export function toMinorUnits(amount: number, currency: string): bigint {
  const decimals = getCurrencyDecimals(currency)
  const fixed = amount.toFixed(decimals)
  // Always return the absolute minor-unit integer. The ledger stores
  // `amountMinorUnits` as a positive integer; `entryType` determines direction.
  const normalized = fixed.replace('-', '').replace('.', '')
  return BigInt(normalized)
}

const isSqlite = (process.env.DATABASE_PROVIDER || '').toLowerCase() === 'sqlite'

function ledgerEntryIdsValue(ids: string[]) {
  return (isSqlite ? JSON.stringify(ids) : ids) as any
}

export function fromMinorUnits(amountMinorUnits: bigint, currency: string): number {
  const decimals = getCurrencyDecimals(currency)
  const scale = 10n ** BigInt(decimals)
  return Number(amountMinorUnits) / Number(scale)
}

interface RecordLedgerTransactionOptions {
  tx: Prisma.TransactionClient
  userId: string
  asset: string
  amount: number
  entryType: 'debit' | 'credit'
  kind: string
  eventType: string
  sourceType: string
  sourceId: string
  externalRef: string
  idempotencyKey?: string
  description?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  reference?: string
  subType?: string
  recordTransaction?: boolean
  pending?: boolean
  createdAt?: Date
}

export async function recordLedgerTransaction({
  tx,
  userId,
  asset,
  amount,
  entryType,
  kind,
  eventType,
  sourceType,
  sourceId,
  externalRef,
  idempotencyKey,
  description,
  metadata,
  createdBy = 'system',
  reference,
  subType,
  recordTransaction = false,
  pending = false,
  createdAt,
}: RecordLedgerTransactionOptions) {
  const existingEvent = await tx.financialEvent.findUnique({
    where: { externalRef },
  })
  if (existingEvent) {
    const existingEntry = await tx.ledgerEntry.findFirst({
      where: { sourceType, sourceId, userId, asset },
      orderBy: { createdAt: 'desc' },
    })
    return { existingEvent, existingEntry }
  }

  const createdAtValue = createdAt ?? new Date()
  const amountMinorUnits = toMinorUnits(amount, asset)
  // Do not change the settled balance for pending events - only adjust
  // available/pending so the wallet reflects reserved funds. The actual
  // balance change occurs when the event is completed (pending=false).
  const balanceDeltaMinorUnits = pending ? 0n : (entryType === 'debit' ? amountMinorUnits : -amountMinorUnits)
  const availableDeltaMinorUnits = pending
    ? entryType === 'debit'
      ? 0n
      : -amountMinorUnits
    : balanceDeltaMinorUnits
  const pendingDeltaMinorUnits = pending ? amountMinorUnits : 0n

  const event = await tx.financialEvent.create({
    data: {
      userId,
      eventType,
      eventStatus: pending ? 'pending' : 'completed',
      ledgerEntryIds: ledgerEntryIdsValue([]),
      details: metadata ? JSON.stringify(metadata) : undefined,
      externalRef,
      idempotencyKey: idempotencyKey ?? externalRef,
      completedAt: pending ? undefined : createdAtValue,
      createdAt: createdAtValue,
    },
  })

  const entry = await tx.ledgerEntry.create({
    data: {
      correlationId: `${event.id}:${sourceType}:${sourceId}`,
      userId,
      asset,
      amountMinorUnits,
      entryType,
      kind,
      status: pending ? 'pending' : 'completed',
      sourceType,
      sourceId,
      description,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      idempotencyKey: idempotencyKey ?? externalRef,
      createdBy,
      createdAt: createdAtValue,
    },
  })

  await tx.financialEvent.update({
    where: { id: event.id },
    data: { ledgerEntryIds: ledgerEntryIdsValue([entry.id]) },
  })

  const accountBalance = await tx.accountBalance.upsert({
    where: { userId_asset: { userId, asset } },
    create: {
      userId,
      asset,
      balanceMinorUnits: balanceDeltaMinorUnits,
      availableMinorUnits: availableDeltaMinorUnits,
      lockedMinorUnits: 0n,
      pendingMinorUnits: pendingDeltaMinorUnits,
      reconciliationStatus: 'pending',
      lastReconciled: createdAtValue,
    },
    update: {
      balanceMinorUnits: { increment: balanceDeltaMinorUnits },
      availableMinorUnits: { increment: availableDeltaMinorUnits },
      pendingMinorUnits: { increment: pendingDeltaMinorUnits },
      reconciliationStatus: 'pending',
      lastReconciled: createdAtValue,
    },
  })

  const walletBalance = await tx.walletBalance.upsert({
    where: { userId_currency: { userId, currency: asset } },
    create: {
      userId,
      currency: asset,
      symbol: asset === 'USD' ? '$' : asset,
      balance: fromMinorUnits(accountBalance.balanceMinorUnits, asset),
      available: fromMinorUnits(accountBalance.availableMinorUnits, asset),
      balanceMinorUnits: accountBalance.balanceMinorUnits,
      availableMinorUnits: accountBalance.availableMinorUnits,
    },
    update: {
      balance: fromMinorUnits(accountBalance.balanceMinorUnits, asset),
      available: fromMinorUnits(accountBalance.availableMinorUnits, asset),
      balanceMinorUnits: accountBalance.balanceMinorUnits,
      availableMinorUnits: accountBalance.availableMinorUnits,
      symbol: asset === 'USD' ? '$' : asset,
    },
  })

  let transaction
  if (recordTransaction) {
    transaction = await tx.transaction.create({
      data: {
        userId,
        kind,
        currency: asset,
        amount: entryType === 'debit' ? amount : -amount,
        status: pending ? 'pending' : 'completed',
        reference: reference ?? description,
        subType,
        ...(createdAt ? { createdAt: createdAtValue } : {}),
      },
    })
  }

  return { event, entry, accountBalance, walletBalance, transaction }
}

export type BalanceReservationAction = 'lock' | 'unlock'

interface RecordLedgerBalanceReservationOptions {
  tx: Prisma.TransactionClient
  userId: string
  asset: string
  amount: number
  action: BalanceReservationAction
  kind: string
  eventType: string
  sourceType: string
  sourceId: string
  externalRef: string
  idempotencyKey?: string
  description?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  reference?: string
  createdAt?: Date
}

export async function recordLedgerBalanceReservation({
  tx,
  userId,
  asset,
  amount,
  action,
  kind,
  eventType,
  sourceType,
  sourceId,
  externalRef,
  idempotencyKey,
  description,
  metadata,
  createdBy = 'system',
  reference,
  createdAt,
}: RecordLedgerBalanceReservationOptions) {
  const existingEvent = await tx.financialEvent.findUnique({ where: { externalRef } })
  if (existingEvent) {
    const existingEntry = await tx.ledgerEntry.findFirst({
      where: { sourceType, sourceId, userId, asset },
      orderBy: { createdAt: 'desc' },
    })
    return { existingEvent, existingEntry }
  }

  const createdAtValue = createdAt ?? new Date()
  const amountMinorUnits = toMinorUnits(amount, asset)
  const lockedDeltaMinorUnits = action === 'lock' ? amountMinorUnits : -amountMinorUnits
  const availableDeltaMinorUnits = action === 'lock' ? -amountMinorUnits : amountMinorUnits

  const event = await tx.financialEvent.create({
    data: {
      userId,
      eventType,
      eventStatus: 'completed',
      ledgerEntryIds: ledgerEntryIdsValue([]),
      details: metadata ? JSON.stringify(metadata) : undefined,
      externalRef,
      idempotencyKey: idempotencyKey ?? externalRef,
      completedAt: createdAtValue,
      createdAt: createdAtValue,
    },
  })

  const entry = await tx.ledgerEntry.create({
    data: {
      correlationId: `${event.id}:${sourceType}:${sourceId}`,
      userId,
      asset,
      amountMinorUnits,
      entryType: action === 'lock' ? 'credit' : 'debit',
      kind,
      status: 'completed',
      sourceType,
      sourceId,
      description,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      idempotencyKey: idempotencyKey ?? externalRef,
      createdBy,
      createdAt: createdAtValue,
    },
  })

  await tx.financialEvent.update({
    where: { id: event.id },
    data: { ledgerEntryIds: ledgerEntryIdsValue([entry.id]) },
  })

  const existingWalletBalance = await tx.walletBalance.findUnique({
    where: { userId_currency: { userId, currency: asset } },
  })
  const existingAccountBalance = await tx.accountBalance.findUnique({
    where: { userId_asset: { userId, asset } },
  })

  const accountBalance = await tx.accountBalance.upsert({
    where: { userId_asset: { userId, asset } },
    create: {
      userId,
      asset,
      balanceMinorUnits: existingAccountBalance
        ? existingAccountBalance.balanceMinorUnits
        : existingWalletBalance
          ? toMinorUnits(existingWalletBalance.balance, asset)
          : 0n,
      availableMinorUnits: existingAccountBalance
        ? existingAccountBalance.availableMinorUnits
        : existingWalletBalance
          ? toMinorUnits(existingWalletBalance.available, asset)
          : 0n,
      lockedMinorUnits: existingAccountBalance ? existingAccountBalance.lockedMinorUnits : 0n,
      pendingMinorUnits: existingAccountBalance ? existingAccountBalance.pendingMinorUnits : 0n,
      reconciliationStatus: 'pending',
      lastReconciled: createdAtValue,
    },
    update: {
      availableMinorUnits: { increment: availableDeltaMinorUnits },
      lockedMinorUnits: { increment: lockedDeltaMinorUnits },
      reconciliationStatus: 'pending',
      lastReconciled: createdAtValue,
    },
  })

  const walletBalance = await tx.walletBalance.upsert({
    where: { userId_currency: { userId, currency: asset } },
    create: {
      userId,
      currency: asset,
      symbol: asset === 'USD' ? '$' : asset,
      balance: fromMinorUnits(accountBalance.balanceMinorUnits, asset),
      available: fromMinorUnits(accountBalance.availableMinorUnits, asset),
    },
    update: {
      balance: fromMinorUnits(accountBalance.balanceMinorUnits, asset),
      available: fromMinorUnits(accountBalance.availableMinorUnits, asset),
      symbol: asset === 'USD' ? '$' : asset,
    },
  })

  return { event, entry, accountBalance, walletBalance }
}
