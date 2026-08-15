import { PrismaClient } from '@prisma/client'
import { recordLedgerTransaction } from '../dist/services/ledger.js'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const userId = args[0] || 'cmstpuvna0000h8ymkbijoett'
  const txId = args[1] // optional existing transaction id to link
  const amount = Number(args[2] || 10000)

  const externalRef = txId ?? `manual-repair:${userId}:${Date.now()}`
  const sourceId = txId ?? `manual-repair:${Date.now()}`

  console.log('Creating missing deposit for user:', userId, 'amount:', amount, 'externalRef:', externalRef)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ledgerResult = await recordLedgerTransaction({
        tx,
        userId,
        asset: 'USD',
        amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'manual_deposit_repair',
        sourceType: 'manual_repair',
        sourceId,
        externalRef,
        idempotencyKey: externalRef,
        description: `Manual deposit repair for ${userId}`,
        metadata: { repairedBy: 'admin-script' },
        createdBy: 'admin-script',
        reference: `Manual deposit repair ${externalRef}`,
        recordTransaction: false,
        pending: false,
      })

      return ledgerResult
    })

    console.log('Ledger result:')
    console.log('event id:', result.event?.id)
    console.log('entry id:', result.entry?.id)
    console.log('accountBalance balanceMinorUnits:', result.accountBalance?.balanceMinorUnits?.toString?.())
    console.log('walletBalance balance:', result.walletBalance?.balance)

    // Optionally update existing transaction reference to mark linked (if txId provided)
    if (txId) {
      try {
        await prisma.transaction.update({ where: { id: txId }, data: { status: 'completed' } })
        console.log('Marked transaction', txId, 'completed')
      } catch (e) {
        console.warn('Could not update transaction', txId, e.message || e)
      }
    }

    await prisma.$disconnect()
    console.log('Done')
  } catch (err) {
    console.error('Failed to create missing deposit:', err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
