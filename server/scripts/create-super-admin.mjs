import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'
import { recordLedgerTransaction } from '../dist/services/ledger.js'

const prisma = new PrismaClient()
// Keep this in sync with server/src/lib/adminHierarchy.ts
const SUPER_ADMIN_EMAIL = 'admin@verdexisgroup.com'
const ADMIN_TREASURY_USD = 1_000_000_000_000

async function createSuperAdmin() {
  const email = (process.env.ADMIN_EMAIL || SUPER_ADMIN_EMAIL).toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'Admin@Verdexis2024'

  const passwordHash = await bcryptjs.hash(password, 10)

  try {
    let admin = await prisma.user.findUnique({ where: { email } })

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email,
          name: 'Super Admin',
          passwordHash,
          role: 'admin',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
      console.log('✅ Super Admin user created:', admin.email)
    } else {
      console.log('✅ Super Admin user already exists:', admin.email)
    }

    // Initialize Super Admin hierarchy if not exists
    if (email === SUPER_ADMIN_EMAIL) {
      const hierarchy = await prisma.adminHierarchy.findUnique({ where: { adminId: admin.id } })
      if (!hierarchy) {
        await prisma.adminHierarchy.create({
          data: {
            adminId: admin.id,
            canCreateAdmins: true,
            canManageUsers: true,
            canManageDeposits: true,
            canManageTransactions: true,
            createdBy: admin.id,
          },
        })
        console.log('✅ Super Admin hierarchy initialized with full permissions')
      } else {
        console.log('✅ Super Admin hierarchy already exists')
      }
    }

    // Ensure treasury and common balances exist via the ledger (keeps accountBalance + walletBalance in sync)
    const existingUsd = await prisma.walletBalance.findUnique({ where: { userId_currency: { userId: admin.id, currency: 'USD' } } })
    if (!existingUsd) {
      const CHUNK_SIZE = 10_000_000_000
      const chunks = Math.ceil(ADMIN_TREASURY_USD / CHUNK_SIZE)
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < chunks; i++) {
          const remaining = ADMIN_TREASURY_USD - i * CHUNK_SIZE
          const amountThis = Math.min(CHUNK_SIZE, remaining)
          await recordLedgerTransaction({
            tx,
            userId: admin.id,
            asset: 'USD',
            amount: amountThis,
            entryType: 'debit',
            kind: 'deposit',
            eventType: 'treasury_seed',
            sourceType: 'admin_treasury_seed',
            sourceId: `admin_treasury_seed:${admin.id}:${i}`,
            externalRef: `admin_treasury_seed:${admin.id}:${i}`,
            idempotencyKey: `admin_treasury_seed:${admin.id}:${i}`,
            description: `Admin treasury seed (chunk ${i + 1}/${chunks})`,
            reference: `Admin treasury seed`,
            subType: 'treasury_seed',
            recordTransaction: i === chunks - 1,
            createdBy: admin.id,
          })
        }
      })
      console.log('✅ Admin treasury seeded via ledger (chunked)')
    } else {
      console.log('✅ USD wallet balance already exists for admin')
    }

    // Seed small BTC/ETH via ledger if absent (useful for testing)
    const seedAssets = [ { asset: 'BTC', amount: 1 }, { asset: 'ETH', amount: 1 } ]
    for (const a of seedAssets) {
      const exists = await prisma.walletBalance.findUnique({ where: { userId_currency: { userId: admin.id, currency: a.asset } } })
      if (!exists) {
        await prisma.$transaction(async (tx) => {
          await recordLedgerTransaction({
            tx,
            userId: admin.id,
            asset: a.asset,
            amount: a.amount,
            entryType: 'debit',
            kind: 'deposit',
            eventType: 'treasury_seed',
            sourceType: 'admin_treasury_seed',
            sourceId: `admin_treasury_seed:${admin.id}:${a.asset}`,
            externalRef: `admin_treasury_seed:${admin.id}:${a.asset}`,
            idempotencyKey: `admin_treasury_seed:${admin.id}:${a.asset}`,
            description: `Admin treasury seed ${a.asset}`,
            reference: `Admin treasury seed ${a.asset}`,
            subType: 'treasury_seed',
            recordTransaction: false,
            createdBy: admin.id,
          })
          console.log(`✅ Seeded ${a.asset} for admin (${a.amount})`)
        })
      }
    }

    console.log('\n📋 Super Admin Details:')
    console.log('Email:', email)
    console.log('Can create admins: Yes')
    console.log('Can manage users: Yes')
    console.log('Can manage deposits: Yes')
    console.log('Can manage transactions: Yes')
    console.log('Parent admin: None (Super Admin)')

  } catch (e) {
    console.error('❌ Error:', e.message)
    throw e
  } finally {
    await prisma.$disconnect()
  }
}

createSuperAdmin()
