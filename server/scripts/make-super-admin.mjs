import { prisma } from '../dist/db.js'

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@verdexisgroup.com').toLowerCase()
  console.log('Promoting to Super Admin:', email)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, email: true } })
  if (!user) {
    console.error('User not found:', email)
    process.exit(1)
  }

  // Ensure role is admin
  if (user.role !== 'admin') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
    console.log('Role set to admin')
  }

  const exists = await prisma.adminHierarchy.findUnique({ where: { adminId: user.id } })
  if (!exists) {
    await prisma.adminHierarchy.create({ data: { adminId: user.id, canCreateAdmins: true, canManageUsers: true, canManageDeposits: true, canManageTransactions: true, createdBy: user.id, parentAdminId: null } })
    console.log('Admin hierarchy entry created with super-admin privileges')
  } else if (!exists.canCreateAdmins) {
    await prisma.adminHierarchy.update({ where: { adminId: user.id }, data: { canCreateAdmins: true, parentAdminId: null, createdBy: user.id } })
    console.log('Admin hierarchy updated to grant super-admin privileges')
  } else {
    console.log('User is already a super-admin')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
