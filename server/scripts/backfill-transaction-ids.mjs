import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Backfill transactionId for all existing transactions
 * Each transaction gets a unique ID based on its creation date and a hash
 */
async function backfillTransactionIds() {
  console.log('🔄 Backfilling transaction IDs...\n')

  try {
    // Get all transactions that don't have a transactionId
    const transactions = await prisma.transaction.findMany({
      where: {
        transactionId: null,
      },
      orderBy: { createdAt: 'asc' },
    })

    console.log(`Found ${transactions.length} transactions to update\n`)

    let updated = 0
    let duplicates = 0
    const generatedIds = new Set()

    for (const tx of transactions) {
      // Generate ID based on transaction date and a hash of the database ID
      const date = tx.createdAt.toISOString().split('T')[0].replace(/-/g, '')
      
      // Create a simple hash from the transaction ID
      let hash = ''
      for (let i = 0; i < tx.id.length; i++) {
        hash += tx.id.charCodeAt(i).toString(16)
      }
      hash = hash.substring(0, 12).toUpperCase().padEnd(12, '0')
      
      let transactionId = `TXN-${date}-${hash}`
      let attempt = 0

      // Ensure uniqueness by adding a counter if needed
      while (generatedIds.has(transactionId) && attempt < 10) {
        attempt++
        const suffix = attempt.toString().padStart(2, '0')
        transactionId = `TXN-${date}-${hash.substring(0, 10)}${suffix}`
      }

      if (generatedIds.has(transactionId)) {
        console.warn(`⚠️  Could not generate unique ID for transaction ${tx.id}`)
        duplicates++
        continue
      }

      generatedIds.add(transactionId)

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { transactionId },
      })

      updated++

      if (updated % 100 === 0) {
        console.log(`✓ Updated ${updated} transactions...`)
      }
    }

    console.log(`\n═══════════════════════════════════════════════════════════════`)
    console.log(`✅ Backfill Complete`)
    console.log(`═══════════════════════════════════════════════════════════════`)
    console.log(`Total updated: ${updated}`)
    console.log(`Failed (duplicates): ${duplicates}`)
    console.log(``)
    console.log(`Transactions now have unique IDs like: TXN-20260815-ABC123DEF456`)
    console.log(`Users can use these IDs to search and track their transactions`)
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backfillTransactionIds()
