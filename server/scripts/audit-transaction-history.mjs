import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@verdexisgroup.com' },
  })

  if (!admin) {
    console.log('❌ Admin user not found')
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('📊 TRANSACTION HISTORY AUDIT - Admin Account')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Admin: ${admin.email} (ID: ${admin.id})`)
  console.log('')

  // Get wallet balance
  const wallet = await prisma.walletBalance.findFirst({
    where: { userId: admin.id, currency: 'USD' },
  })

  console.log('💰 Current Wallet State:')
  console.log(`   Balance:   ${wallet?.balance?.toLocaleString() || 0} USD`)
  console.log(`   Available: ${wallet?.available?.toLocaleString() || 0} USD`)
  console.log('')

  // Get all transactions sorted by date
  const allTransactions = await prisma.transaction.findMany({
    where: { userId: admin.id, currency: 'USD' },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`📝 All Transactions (${allTransactions.length} total):\n`)

  // Calculate running balance and track all transactions
  let runningBalance = 0
  const transactionTable = []

  allTransactions.forEach((t, idx) => {
    let amount = t.amount || 0
    
    // Determine sign based on transaction type
    let sign = 1
    if (t.kind === 'withdraw' || t.kind === 'fee') {
      sign = -1
    }
    
    const signedAmount = amount * sign
    runningBalance += signedAmount
    
    transactionTable.push({
      idx: idx + 1,
      date: new Date(t.createdAt).toISOString(),
      type: t.kind.padEnd(10),
      amount: amount.toLocaleString().padEnd(20),
      sign: sign === 1 ? '+' : '-',
      runningBalance: runningBalance.toLocaleString(),
      reference: t.reference || 'N/A',
      status: t.status,
    })
  })

  // Print transaction table
  console.log(`   # | Date & Time                | Type       | Amount               | Running Balance`)
  console.log(`   ──────────────────────────────────────────────────────────────────────────────────────────`)
  
  transactionTable.forEach((row) => {
    console.log(
      `   ${String(row.idx).padEnd(2)} | ${row.date} | ${row.type} | ${row.sign}${row.amount} | ${row.runningBalance}`
    )
  })

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('✓ AUDIT RESULTS')
  console.log('═══════════════════════════════════════════════════════════════')

  const expectedBalance = runningBalance
  const actualBalance = wallet?.balance || 0
  const balanceMatch = expectedBalance === actualBalance

  console.log(`Calculated Balance (from transactions): ${expectedBalance.toLocaleString()} USD`)
  console.log(`Actual Wallet Balance:                  ${actualBalance.toLocaleString()} USD`)
  console.log('')

  if (balanceMatch) {
    console.log('✅ PASS: Transaction history is ACCURATE')
    console.log('   All transactions properly reflected in wallet balance')
  } else {
    console.log('❌ FAIL: Transaction history MISMATCH')
    console.log(`   Difference: ${(expectedBalance - actualBalance).toLocaleString()} USD`)
    console.log('')
    console.log('   This means:')
    console.log('   - Some transactions may not be credited to the wallet')
    console.log('   - Wallet balance may have been manually adjusted')
    console.log('   - Database consistency issue detected')
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  
  // Check for any deposits without matching balance updates
  if (allTransactions.length > 0) {
    const deposits = allTransactions.filter(t => t.kind === 'deposit')
    const totalDeposits = deposits.reduce((sum, t) => sum + (t.amount || 0), 0)
    
    console.log('📋 Transaction Type Summary:')
    console.log(`   Total Deposits:  ${totalDeposits.toLocaleString()} USD`)
    console.log(`   Expected Balance: ${totalDeposits.toLocaleString()} USD`)
    
    if (totalDeposits === actualBalance) {
      console.log('   ✅ Deposit total matches wallet balance')
    } else {
      console.log('   ⚠️  Deposit total does NOT match wallet balance')
    }
  }

} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
