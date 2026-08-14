import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

;(async () => {
  try {
    const u = await p.user.findFirst({ where: { role: 'admin' } })
    console.log(JSON.stringify(u, null, 2))
  } catch (e) {
    console.error('err', e)
  } finally {
    await p.$disconnect()
  }
})()
