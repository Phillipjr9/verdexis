import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const userId = process.argv[2] || 'cmst1kbjt0000dm9qiahrmjgg'
const rawAddress = process.argv[3] || '0x1111111111111111111111111111111111111111'
const address = rawAddress.toLowerCase()

async function run() {
  try {
    console.log('Running non-transactional upsert for', userId, address)
    const otherCount = await prisma.walletLink.count({ where: { userId, NOT: { address } } })
    console.log('otherCount:', otherCount)
    const existingLink = await prisma.walletLink.findUnique({ where: { userId_address: { userId, address } } })
    console.log('existingLink:', existingLink)
    const makePrimary = true

    if (makePrimary) {
      await prisma.walletLink.updateMany({ where: { userId, isPrimary: true, NOT: { address } }, data: { isPrimary: false } })
      console.log('Cleared previous primaries')
    }

    let row
    try {
      row = await prisma.walletLink.upsert({
        where: { userId_address: { userId, address } },
        create: { userId, address, chainId: '0x1', provider: 'ethers', label: 'Admin added', isPrimary: makePrimary },
        update: { chainId: '0x1', provider: 'ethers', ...(makePrimary ? { isPrimary: true } : {}) },
      })
      console.log('Upsert succeeded:', row)
    } catch (e) {
      console.error('Upsert error:', e)
    }

    if (makePrimary) {
      await prisma.user.update({ where: { id: userId }, data: { walletAddress: address, walletChainId: '0x1', walletProvider: 'ethers', walletLinkedAt: new Date() } })
      console.log('Updated user wallet fields')
    }

    const links = await prisma.walletLink.findMany({ where: { userId }, orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'desc' }] })
    console.log('Links after upsert:', JSON.stringify(links, null, 2))
  } catch (e) {
    console.error('Error', e)
  } finally {
    await prisma.$disconnect()
  }
}
run()
