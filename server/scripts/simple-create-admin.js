import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const prisma = new PrismaClient()
  
  const email = 'admin@verdexis.com'
  const password = 'Admin@Verdexis2024'
  
  console.log('🔧 Creating admin user...')
  
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingAdmin) {
      console.log('✅ Admin already exists with email:', existingAdmin.email)
      
      if (existingAdmin.role !== 'admin') {
        await prisma.user.update({
          where: { email },
          data: { role: 'admin', emailVerified: true }
        })
        console.log('✅ Admin role promoted to admin')
      } else {
        console.log('✅ Admin already has admin role')
      }
      
      console.log('📋 Admin ID:', existingAdmin.id)
      console.log('📧 Email:', existingAdmin.email)
      console.log('🔐 Password:', password)
      console.log('🎭 Role:', existingAdmin.role)
      console.log('✅ Email Verified:', existingAdmin.emailVerified)
      
      const walletBalance = await prisma.walletBalance.findFirst({
        where: { userId: existingAdmin.id, currency: 'USD' }
      })
      if (walletBalance) {
        console.log('💰 Initial USD Balance:', walletBalance.balance)
      }
      
      return existingAdmin
    }
    
    const passwordHash = await bcrypt.hash(password, 12)
    
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
    
    console.log('✅ Admin user created successfully!')
    console.log('📋 Admin ID:', admin.id)
    console.log('📧 Email:', admin.email)
    console.log('🔐 Password:', password)
    console.log('🎭 Role:', admin.role)
    console.log('✅ Email Verified:', admin.emailVerified)
    
    await prisma.walletBalance.createMany({
      data: [
        { userId: admin.id, currency: 'USD', symbol: 'USD', balance: 100000, available: 100000 },
        { userId: admin.id, currency: 'BTC', symbol: 'BTC', balance: 1, available: 1 },
        { userId: admin.id, currency: 'ETH', symbol: 'ETH', balance: 10, available: 10 },
      ],
    })
    
    console.log('✅ Initial wallet balances created')
    console.log('💰 USD Balance: $100,000')
    console.log('₿ BTC Balance: 1.0')
    console.log('⟡ ETH Balance: 10.0')
    
    return admin
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)