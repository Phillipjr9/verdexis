// Direct admin creation script without TypeScript dependencies
// This script assumes the environment is properly set up

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const prisma = new PrismaClient()
  
  const email = 'admin@verdexis.com'
  const password = 'Admin@Verdexis2024'
  const initialUsdBalance = 1_500_000_000_000
  
  console.log('🔧 Creating or updating admin user...')
  
  try {
    const passwordHash = await bcrypt.hash(password, 12)

    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    })

    let admin

    if (existingAdmin) {
      admin = await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          role: 'admin',
          emailVerified: true,
          emailVerifiedAt: existingAdmin.emailVerifiedAt ?? new Date(),
        },
      })

      console.log('✅ Admin already exists; account updated for login and admin access')
    } else {
      admin = await prisma.user.create({
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
    }

    console.log('📋 Admin ID:', admin.id)
    console.log('📧 Email:', admin.email)
    console.log('🔐 Password:', password)
    console.log('🎭 Role:', admin.role)
    console.log('✅ Email Verified:', admin.emailVerified)

    await prisma.walletBalance.upsert({
      where: {
        userId_currency: {
          userId: admin.id,
          currency: 'USD',
        },
      },
      update: {
        symbol: 'USD',
        balance: initialUsdBalance,
        available: initialUsdBalance,
      },
      create: {
        userId: admin.id,
        currency: 'USD',
        symbol: 'USD',
        balance: initialUsdBalance,
        available: initialUsdBalance,
      },
    })

    await prisma.transaction.create({
      data: {
        userId: admin.id,
        kind: 'deposit',
        currency: 'USD',
        amount: initialUsdBalance,
        status: 'completed',
        reference: 'super-admin-initial-balance',
        subType: 'manual_bank_wire',
      },
    })

    console.log('✅ USD wallet balance set to:', initialUsdBalance)

    console.log('\n🎉 Admin account is ready!')
    console.log('====================================')
    console.log('📋 ADMIN CREDENTIALS:')
    console.log('📧 Email: admin@verdexis.com')
    console.log('🔐 Password: Admin@Verdexis2024')
    console.log('🎭 Role: admin')
    console.log('✅ Email Verified: Yes')
    console.log('💰 USD Balance: $1,500,000,000,000')
    console.log('====================================')
    console.log('⚠️  IMPORTANT: Save these credentials securely!')
    console.log('====================================')

    return admin
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)