import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const userId = process.argv[2]
if (!userId) { console.error('usage: node restore-bonus-lock.mjs <userId>'); process.exit(1) }
const u = await p.user.findUnique({ where: { id: userId } })
if (!u) { console.error('no user'); process.exit(1) }
const prefs = JSON.parse(u.prefs || '{}')
prefs.bonusLocked = true
await p.user.update({ where: { id: u.id }, data: { prefs: JSON.stringify(prefs) } })
console.log('restored', prefs)
await p.$disconnect()
