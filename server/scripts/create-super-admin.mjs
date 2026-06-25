import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()
const SUPER_ADMIN_EMAIL = 'admin@verdexis.com'

async function createSuperAdmin() {
  const email = process.env.ADMIN_EMAIL || SUPER_ADMIN_EMAIL
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
      const hierarchy = await prisma.adminHierarchy.findUnique({
        where: { adminId: admin.id }
      })
      
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
    
    // Ensure wallet balances exist
    const usdBalance = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId: admin.id, currency: 'USD' } }
    })
    
    if (!usdBalance) {
      await prisma.walletBalance.createMany({
        data: [
          { userId: admin.id, currency: 'USD', symbol: 'USD', balance: 100000, available: 100000 },
          { userId: admin.id, currency: 'BTC', symbol: 'BTC', balance: 1, available: 1 },
          { userId: admin.id, currency: 'ETH', symbol: 'ETH', balance: 10, available: 10 },
        ],
      })
      console.log('✅ Initial wallet balances created')
    } else {
      console.log('✅ Wallet balances already exist')
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
