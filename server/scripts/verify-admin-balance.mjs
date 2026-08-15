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

  console.log('📋 Admin Account:')
  console.log('   User ID:', admin.id)
  console.log('   Email:', admin.email)
  console.log('   Role:', admin.role)

  const wallet = await prisma.walletBalance.findFirst({
    where: { userId: admin.id, currency: 'USD' },
  })

  console.log('\n💰 Wallet Balance:')
  if (wallet) {
    console.log('   Currency:', wallet.currency)
    console.log('   Balance:', wallet.balance?.toLocaleString(), 'USD')
    console.log('   Available:', wallet.available?.toLocaleString(), 'USD')
    console.log('   Last Updated:', new Date(wallet.updatedAt).toISOString())
  } else {
    console.log('   ❌ No wallet found')
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: admin.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  console.log('\n📊 Recent Transactions:', transactions.length, 'total')
  if (transactions.length > 0) {
    transactions.forEach((t, i) => {
      console.log(
        `   ${i + 1}. ${t.kind.padEnd(10)} | ${t.amount?.toLocaleString()?.padEnd(20)} ${t.currency} | ${t.status.padEnd(10)} | ${new Date(t.createdAt).toISOString()}`
      )
    })
  } else {
    console.log('   ⚠️  No transactions recorded')
  }

  // Verify the amount is correct
  if (wallet && wallet.balance === 1000000000000) {
    console.log('\n✅ VERIFIED: Admin wallet has 1 trillion USD stored in database')
  } else {
    console.log('\n⚠️  WARNING: Balance does not match expected amount')
  }
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
