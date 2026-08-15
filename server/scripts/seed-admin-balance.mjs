import { PrismaClient } from '@prisma/client'

const TREASURY = 1_000_000_000_000

const prisma = new PrismaClient({
  errorFormat: 'pretty',
})

// Generate transaction ID
function generateTransactionId() {
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD
  const random = Math.random().toString(36).substring(2, 8) + 
                 Math.random().toString(36).substring(2, 8)
  return `TXN-${date}-${random.toUpperCase()}`
}

try {
  // Find all admin users
  const admins = await prisma.user.findMany({ where: { role: 'admin' } })

  if (admins.length === 0) {
    console.log('No admin users found. Creating super admin...')
    // Create super admin if doesn't exist
    const existing = await prisma.user.findFirst({ where: { email: 'admin@verdexisgroup.com' } })
    if (!existing) {
      const superAdmin = await prisma.user.create({
        data: {
          email: 'admin@verdexisgroup.com',
          name: 'Super Admin',
          username: 'superadmin',
          passwordHash: '$2a$12$y5i6dfgqA0.4wL3Ylf2W2efUQqowc1L9yL7MJfefQaD1m5zJvQZXm', // password: admin123
          role: 'admin',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
      admins.push(superAdmin)
      console.log('Created super admin:', superAdmin.email)
    }
  }

  // Seed wallets and transactions for all admins
  for (const admin of admins) {
    try {
      const existing = await prisma.walletBalance.findFirst({
        where: { userId: admin.id, currency: 'USD' },
      })

      if (!existing) {
        await prisma.walletBalance.create({
          data: {
            userId: admin.id,
            currency: 'USD',
            symbol: '$',
            balance: TREASURY,
            available: TREASURY,
          },
        })
        console.log(`✓ Created wallet for ${admin.email}: USD = ${TREASURY.toLocaleString()}`)
      } else if (existing.balance < TREASURY) {
        await prisma.walletBalance.update({
          where: { id: existing.id },
          data: { balance: TREASURY, available: TREASURY },
        })
        console.log(`✓ Updated wallet for ${admin.email}: USD = ${TREASURY.toLocaleString()}`)
      } else {
        console.log(`✓ ${admin.email} already has sufficient balance: ${existing.balance.toLocaleString()}`)
      }

      // Ensure transaction record exists
      const txExists = await prisma.transaction.findFirst({
        where: {
          userId: admin.id,
          kind: 'deposit',
          currency: 'USD',
          amount: TREASURY,
          reference: 'super-admin-initial-balance',
        },
      })

      if (!txExists) {
        await prisma.transaction.create({
          data: {
            transactionId: generateTransactionId(),
            userId: admin.id,
            kind: 'deposit',
            currency: 'USD',
            amount: TREASURY,
            status: 'completed',
            reference: 'super-admin-initial-balance',
            subType: 'system_allocation',
          },
        })
        console.log(`✓ Created transaction record for ${admin.email}: ${TREASURY.toLocaleString()} USD`)
      } else {
        console.log(`✓ Transaction record already exists for ${admin.email}`)
      }
    } catch (err) {
      // Handle case where balanceMinorUnits doesn't exist
      if (err.message.includes('balanceMinorUnits')) {
        console.log(`ℹ Updating ${admin.email} without balanceMinorUnits field...`)
        try {
          const existing = await prisma.walletBalance.findFirst({
            where: { userId: admin.id, currency: 'USD' },
            select: { id: true, balance: true },
          })

          if (!existing) {
            // Use raw SQL to insert without the missing field
            await prisma.$executeRawUnsafe(
              `INSERT INTO "WalletBalance" (id, "userId", currency, symbol, balance, available, "updatedAt")
               VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $4, now())
               ON CONFLICT ("userId", currency) DO UPDATE SET
                 balance = $4, available = $4, "updatedAt" = now()`,
              admin.id,
              'USD',
              '$',
              TREASURY
            )
            console.log(`✓ Created wallet for ${admin.email}: USD = ${TREASURY.toLocaleString()}`)
          } else if (existing.balance < TREASURY) {
            await prisma.$executeRawUnsafe(
              `UPDATE "WalletBalance" SET balance = $1, available = $1, "updatedAt" = now()
               WHERE id = $2`,
              TREASURY,
              existing.id
            )
            console.log(`✓ Updated wallet for ${admin.email}: USD = ${TREASURY.toLocaleString()}`)
          } else {
            console.log(`✓ ${admin.email} already has sufficient balance: ${existing.balance.toLocaleString()}`)
          }

          // Ensure transaction record exists
          const txExists = await prisma.transaction.findFirst({
            where: {
              userId: admin.id,
              kind: 'deposit',
              currency: 'USD',
              amount: TREASURY,
              reference: 'super-admin-initial-balance',
            },
          })

          if (!txExists) {
            await prisma.transaction.create({
              data: {
                userId: admin.id,
                kind: 'deposit',
                currency: 'USD',
                amount: TREASURY,
                status: 'completed',
                reference: 'super-admin-initial-balance',
                subType: 'system_allocation',
              },
            })
            console.log(`✓ Created transaction record for ${admin.email}: ${TREASURY.toLocaleString()} USD`)
          }
        } catch (sqlErr) {
          console.error(`✗ Failed to seed ${admin.email}:`, sqlErr.message)
        }
      } else {
        throw err
      }
    }
  }

  console.log('\n✓ Admin treasury seeding completed!')
} catch (e) {
  console.error('✗ Failed:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
