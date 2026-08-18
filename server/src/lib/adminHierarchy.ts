import { prisma } from '../db.js'

const SUPER_ADMIN_EMAIL = 'admin@verdexisgroup.com'

/**
 * Single-admin mode.
 *
 * There is one operator role: `user.role === 'admin'`. That account can
 * manage every user (fund, deduct, transfer, KYC, etc.). Extra admin
 * accounts cannot be created.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true, suspended: true },
  })
  return !!user && user.role === 'admin' && !user.deletedAt && !user.suspended
}

export async function canCreateAdmins(_adminId: string): Promise<boolean> {
  return false
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
  _superAdminId: string,
  _adminData: { email: string; name: string; passwordHash: string },
): Promise<string> {
  throw new Error('This platform has a single admin. Additional admins cannot be created.')
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
    data: {
      userId,
      adminId,
      assignedBy: assignedByAdminId,
    },
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
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  })
  return !!targetUser
}

export async function getSubAdmins(_superAdminId: string): Promise<any[]> {
  return []
}

export const CANONICAL_ADMIN_EMAIL = SUPER_ADMIN_EMAIL
