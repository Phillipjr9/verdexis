import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const userId = process.argv[2] || 'cmst1kbjt0000dm9qiahrmjgg'
const rawAddress = process.argv[3] || '0x1111111111111111111111111111111111111111'
const parsedAddress = rawAddress.toLowerCase()

async function run() {
  try {
    console.log('Starting transaction for user', userId, 'address', parsedAddress)
    const result = await prisma.$transaction(async (tx) => {
      const otherCount = await tx.walletLink.count({ where: { userId, NOT: { address: parsedAddress } } })
      console.log('otherCount:', otherCount)
      const existingLink = await tx.walletLink.findUnique({ where: { userId_address: { userId, address: parsedAddress } } })
      console.log('existingLink:', existingLink)
      const makePrimary = true
      if (makePrimary) {
        console.log('Clearing previous primary links (if any)')
        await tx.walletLink.updateMany({ where: { userId, isPrimary: true, NOT: { address: parsedAddress } }, data: { isPrimary: false } })
      }

      const row = await tx.walletLink.upsert({
        where: { userId_address: { userId, address: parsedAddress } },
        create: { userId, address: parsedAddress, chainId: '0x1', provider: 'ethers', label: 'Admin added', isPrimary: makePrimary },
        update: { chainId: '0x1', provider: 'ethers', label: 'Admin added', ...(makePrimary ? { isPrimary: true } : {}) },
      })

      if (makePrimary) {
        await tx.user.update({ where: { id: userId }, data: { walletAddress: parsedAddress, walletChainId: '0x1', walletProvider: 'ethers', walletLinkedAt: new Date() } })
      }

      return row
    })

    console.log('Upsert result:', JSON.stringify(result, null, 2))
  } catch (e) {
    console.error('Transaction error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

run()
