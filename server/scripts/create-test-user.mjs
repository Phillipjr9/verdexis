import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.TEST_USER_EMAIL || 'testuser@verdexis.local'
  const username = process.env.TEST_USER_USERNAME || 'testuser'
  const name = process.env.TEST_USER_NAME || 'Local Test User'
  const password = process.env.TEST_USER_PASSWORD || 'TestUser@10000'
  const usdBalance = Number(process.env.TEST_USER_USD_BALANCE || '10000')

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set or defaulted')
  }
  if (Number.isNaN(usdBalance) || usdBalance < 0) {
    throw new Error('TEST_USER_USD_BALANCE must be a non-negative number')
  }

  const passwordHash = await bcryptjs.hash(password, 12)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✅ User already exists: ${email}`)
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, username, name, emailVerified: true, emailVerifiedAt: new Date() } })

    const usdWallet = await prisma.walletBalance.findFirst({ where: { userId: existing.id, currency: 'USD' } })
    if (usdWallet) {
      await prisma.walletBalance.update({ where: { id: usdWallet.id }, data: { balance: usdBalance, available: usdBalance } })
      console.log(`✅ Updated USD wallet balance to ${usdBalance}`)
    } else {
      await prisma.walletBalance.create({ data: { userId: existing.id, currency: 'USD', symbol: '$', balance: usdBalance, available: usdBalance } })
      console.log(`✅ Created USD wallet balance ${usdBalance}`)
    }

    const txnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 90000) + 10000}`
    await prisma.transaction.create({ data: { transactionId: txnId, userId: existing.id, kind: 'deposit', currency: 'USD', amount: usdBalance, status: 'completed', reference: 'Local test account funding' } })
    console.log(`✅ Created deposit transaction for ${usdBalance} USD`)
    return
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      name,
      passwordHash,
      role: 'user',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  // Create wallet balance and opening transaction separately to satisfy schema constraints
  await prisma.walletBalance.create({ data: { userId: user.id, currency: 'USD', symbol: '$', balance: usdBalance, available: usdBalance } })
  const txnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 90000) + 10000}`
  await prisma.transaction.create({ data: { transactionId: txnId, userId: user.id, kind: 'deposit', currency: 'USD', amount: usdBalance, status: 'completed', reference: 'Opening balance' } })

  console.log(`✅ Created test user ${user.email}`)
  console.log(`   email: ${email}`)
  console.log(`   password: ${password}`)
  console.log(`   USD balance: ${usdBalance}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
