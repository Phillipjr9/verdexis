import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Scanning users for prefs.address…')
  const users = await prisma.user.findMany({ where: { NOT: { prefs: null } }, select: { id: true, prefs: true } })
  let migrated = 0
  for (const u of users) {
    try {
      const p = JSON.parse(u.prefs || '{}')
      if (p && typeof p.address === 'string' && p.address.trim()) {
        const addr = p.address.trim()
        await prisma.user.update({ where: { id: u.id }, data: { address: addr } })
        // remove address from prefs
        delete p.address
        await prisma.user.update({ where: { id: u.id }, data: { prefs: JSON.stringify(p) } })
        migrated++
        console.log(`Migrated address for user ${u.id}`)
      }
    } catch (e) {
      console.warn('Skipping user', u.id, 'prefs parse failed')
    }
  }
  console.log(`Migration complete. Migrated ${migrated} users.`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
