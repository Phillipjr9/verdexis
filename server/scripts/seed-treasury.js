// Seed admin treasury directly
// Run: node server/scripts/seed-treasury.js

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'admin@verdexis.com'
const TREASURY_AMOUNT = 1_000_000_000_000 // $1 trillion

async function main() {
  console.log('🏦 Seeding admin treasury...')
  
  // Find admin user
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, name: true, role: true }
  })
  
  if (!admin) {
    console.error(`❌ Admin user not found: ${ADMIN_EMAIL}`)
    process.exit(1)
  }
  
  if (admin.role !== 'admin') {
    console.error(`❌ User ${ADMIN_EMAIL} is not an admin`)
    process.exit(1)
  }
  
  console.log(`✓ Found admin: ${admin.name} (${admin.email})`)
  
  // Upsert USD wallet with $1 trillion
  const wallet = await prisma.walletBalance.upsert({
    where: {
      userId_currency: {
        userId: admin.id,
        currency: 'USD'
      }
    },
    create: {
      userId: admin.id,
      currency: 'USD',
      symbol: '$',
      balance: TREASURY_AMOUNT,
      available: TREASURY_AMOUNT
    },
    update: {
      balance: TREASURY_AMOUNT,
      available: TREASURY_AMOUNT,
      symbol: '$'
    }
  })
  
  console.log(`✓ Treasury seeded successfully!`)
  console.log(`  Admin: ${admin.email}`)
  console.log(`  Balance: $${wallet.balance.toLocaleString()}`)
  console.log(`  Available: $${wallet.available.toLocaleString()}`)
  console.log('')
  console.log('🎉 Admin can now transfer funds to users!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
