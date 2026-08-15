import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  console.log('🔧 Fixing transaction history discrepancy...\n')

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@verdexisgroup.com' },
  })

  if (!admin) {
    console.log('❌ Admin user not found')
    process.exit(1)
  }

  // Find the old $1,000 transaction that isn't reflected in balance
  const orphanedTx = await prisma.transaction.findFirst({
    where: {
      userId: admin.id,
      kind: 'deposit',
      currency: 'USD',
      amount: 1000,
      reference: { not: 'super-admin-initial-balance' },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (orphanedTx) {
    console.log('Found orphaned transaction:')
    console.log(`  ID: ${orphanedTx.id}`)
    console.log(`  Amount: $${orphanedTx.amount?.toLocaleString()}`)
    console.log(`  Date: ${new Date(orphanedTx.createdAt).toISOString()}`)
    console.log(`  Reference: ${orphanedTx.reference || '(none)'}`)
    console.log('')

    // Delete the orphaned transaction
    await prisma.transaction.delete({
      where: { id: orphanedTx.id },
    })

    console.log('✓ Removed orphaned transaction\n')
  } else {
    console.log('No orphaned transactions found\n')
  }

  // Verify the fix
  const wallet = await prisma.walletBalance.findFirst({
    where: { userId: admin.id, currency: 'USD' },
  })

  const transactions = await prisma.transaction.findMany({
    where: { userId: admin.id, currency: 'USD' },
    orderBy: { createdAt: 'asc' },
  })

  const calculatedBalance = transactions.reduce((sum, t) => {
    const sign = t.kind === 'withdraw' || t.kind === 'fee' ? -1 : 1
    return sum + (t.amount || 0) * sign
  }, 0)

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('✅ VERIFICATION AFTER FIX')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Transactions in history: ${transactions.length}`)
  console.log(`Calculated balance: ${calculatedBalance.toLocaleString()} USD`)
  console.log(`Actual wallet balance: ${wallet?.balance?.toLocaleString()} USD`)

  if (calculatedBalance === wallet?.balance) {
    console.log('')
    console.log('✅ PASS: Transaction history is now ACCURATE')
    console.log('   All transactions properly reflected in wallet balance')
  } else {
    console.log('')
    console.log('❌ Still a mismatch:')
    console.log(`   Difference: ${(calculatedBalance - (wallet?.balance || 0)).toLocaleString()} USD`)
  }

  console.log('═══════════════════════════════════════════════════════════════')
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
