import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
  try {
    const res = await prisma.$queryRawUnsafe(`
      SELECT "userId", "address", COUNT(*) as cnt
      FROM "WalletLink"
      GROUP BY "userId", "address"
      HAVING COUNT(*) > 1
    `)
    console.log(JSON.stringify(res, null, 2))
  } catch (e) {
    console.error('Error', e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
run()
