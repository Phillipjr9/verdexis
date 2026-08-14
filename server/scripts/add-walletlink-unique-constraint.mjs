import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
  try {
    console.log('Adding unique constraint on WalletLink(userId, address)')
    const res = await prisma.$executeRawUnsafe(`
      ALTER TABLE "WalletLink"
      ADD CONSTRAINT "WalletLink_userid_address_unique" UNIQUE ("userId", "address");
    `)
    console.log('Result:', res)
  } catch (e) {
    console.error('Error adding constraint', e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
run()
