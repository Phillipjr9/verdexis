import { prisma } from '../dist/db.js'

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@verdexisgroup.com'
  console.log('Clearing suspension/holds for admin email:', email)
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('Admin not found')
    process.exit(1)
  }
  await prisma.user.update({ where: { id: user.id }, data: { suspended: false, suspendedReason: null, holdActive: false, holdType: null, holdReason: null, holdNote: null } })
  console.log('Admin cleared')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
