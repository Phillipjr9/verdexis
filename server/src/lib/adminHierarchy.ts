import { prisma } from '../db.js'

const SUPER_ADMIN_EMAIL = 'admin@verdexisgroup.com'

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true, suspended: true },
  })
  return !!user && user.role === 'admin' && !user.deletedAt && !user.suspended
}

export async function canCreateAdmins(adminId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } })
  return u?.role === 'admin'
}

export async function initializeSuperAdminHierarchy(adminId: string, _adminEmail?: string): Promise<void> {
  const exists = await prisma.adminHierarchy.findUnique({ where: { adminId } })
  if (exists) return
  await prisma.adminHierarchy.create({
    data: {
      adminId,
      canCreateAdmins: false,
      canManageUsers: true,
      canManageDeposits: true,
      canManageTransactions: true,
      createdBy: adminId,
      parentAdminId: null,
    },
  })
}

export async function createSubAdmin(
  superAdminId: string,
  adminData: { email: string; name: string; passwordHash: string },
): Promise<string> {
  const actor = await prisma.user.findUnique({ where: { id: superAdminId }, select: { role: true } })
  if (actor?.role !== 'admin') throw new Error('Only the full admin can create sub-admins')
  const user = await prisma.user.create({
    data: {
      email: adminData.email.toLowerCase(),
      name: adminData.name,
      passwordHash: adminData.passwordHash,
      role: 'subadmin',
    },
    select: { id: true },
  })
  return user.id
}

export async function getAdminUsers(adminId: string): Promise<string[]> {
  const assignments = await prisma.userAdminAssignment.findMany({
    where: { adminId },
    select: { userId: true },
  })
  return assignments.map((a) => a.userId)
}

export async function assignUserToAdmin(
  adminId: string,
  userId: string,
  assignedByAdminId: string,
): Promise<void> {
  const superA = await isSuperAdmin(assignedByAdminId)
  if (!superA && assignedByAdminId !== adminId) {
    throw new Error('Only the admin can assign users')
  }
  await prisma.userAdminAssignment.deleteMany({ where: { userId } })
  await prisma.userAdminAssignment.create({
    data: { userId, adminId, assignedBy: assignedByAdminId },
  })
}

export async function getAdminParent(adminId: string): Promise<string | null> {
  const hierarchy = await prisma.adminHierarchy.findUnique({
    where: { adminId },
    select: { parentAdminId: true },
  })
  return hierarchy?.parentAdminId ?? null
}

export async function canAssignUser(targetUserId: string, _adminId: string): Promise<boolean> {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } })
  return !!targetUser
}

export async function getSubAdmins(_superAdminId: string) {
  return prisma.user.findMany({
    where: { role: 'subadmin', deletedAt: null },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export const CANONICAL_ADMIN_EMAIL = SUPER_ADMIN_EMAIL
