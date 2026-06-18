import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@verdexis.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@Verdexis2024'
  
  const passwordHash = await bcryptjs.hash(password, 10)
  
  try {
    const admin = await prisma.user.create({
      data: {
        email,
        name: 'Admin',
        passwordHash,
        role: 'admin',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })
    console.log('✅ Admin user created:', admin.email)
    
    await prisma.walletBalance.createMany({
      data: [
        { userId: admin.id, currency: 'USD', symbol: 'USD', balance: 100000, available: 100000 },
        { userId: admin.id, currency: 'BTC', symbol: 'BTC', balance: 1, available: 1 },
        { userId: admin.id, currency: 'ETH', symbol: 'ETH', balance: 10, available: 10 },
      ],
    })
    console.log('✅ Initial wallet balances created')
  } catch (e) {
    if (e.code === 'P2002') {
      console.log('Admin already exists, promoting...')
      await prisma.user.update({
        where: { email },
        data: { role: 'admin', emailVerified: true },
      })
      console.log('✅ Admin promoted')
    } else {
      throw e
    }
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
