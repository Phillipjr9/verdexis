import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const userId = process.argv[2] || 'cmst1kbjt0000dm9qiahrmjgg'

async function run() {
  try {
    const links = await prisma.walletLink.findMany({ where: { userId } })
    console.log(JSON.stringify(links, null, 2))
  } catch (e) {
    console.error('Error', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}
run()
