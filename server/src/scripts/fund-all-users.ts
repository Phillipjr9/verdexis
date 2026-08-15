import { prisma } from '../db.js'

async function main() {
  console.log('Finding users without USD balance...\n')
  
  const users = await prisma.user.findMany({
    where: { role: 'user', suspended: false },
    include: { walletBalances: { where: { currency: 'USD' } } },
  })
  
  let funded = 0
  let skipped = 0
  
  for (const user of users) {
    const usdBalance = user.walletBalances[0]
    
    if (usdBalance && usdBalance.balance >= 1000) {
      console.log(`Skipped ${user.email} (already has $${usdBalance.balance.toFixed(2)})`)
      skipped++
      continue
    }
    
    const amount = 10000
    
    try {
      await prisma.walletBalance.upsert({
        where: { userId_currency: { userId: user.id, currency: 'USD' } },
        create: { userId: user.id, currency: 'USD', symbol: '$', balance: amount, available: amount },
        update: { balance: { increment: amount }, available: { increment: amount } },
      })
      
      await prisma.transaction.create({
        data: { userId: user.id, kind: 'deposit', currency: 'USD', amount, reference: 'Welcome bonus - demo funds', status: 'completed' } as any,
      })
      
      console.log(`Funded ${user.email} with $${amount.toLocaleString()} USD`)
      funded++
    } catch (error) {
      console.error(`Failed to fund ${user.email}:`, error instanceof Error ? error.message : String(error))
    }
  }
  
  console.log(`\nSummary: Funded ${funded} users, Skipped ${skipped} users`)
  console.log(`Total distributed: $${(funded * 10000).toLocaleString()} USD\n`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
