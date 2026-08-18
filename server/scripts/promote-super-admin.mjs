import { prisma } from '../dist/db.js'

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@verdexisgroup.com'
  console.log('Promoting', email, 'to Super Admin')
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('User not found')
    process.exit(1)
  }
  const existing = await prisma.adminHierarchy.findUnique({ where: { adminId: user.id } })
  if (existing) {
    await prisma.adminHierarchy.update({ where: { adminId: user.id }, data: { canCreateAdmins: true, canManageUsers: true, canManageDeposits: true, canManageTransactions: true, parentAdminId: null, createdBy: user.id } })
    console.log('Updated existing adminHierarchy to Super Admin')
  } else {
    await prisma.adminHierarchy.create({ data: { adminId: user.id, canCreateAdmins: true, canManageUsers: true, canManageDeposits: true, canManageTransactions: true, createdBy: user.id, parentAdminId: null } })
    console.log('Created adminHierarchy entry as Super Admin')
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
