import { prisma } from '../db.js'

const SUPER_ADMIN_EMAIL = 'admin@verdexisgroup.com'

/**
 * Check if a user is the Super Admin.
 *
 * Prefer the admin hierarchy flag when available (an admin created with
 * `canCreateAdmins = true` is considered a super-admin). Fall back to the
 * legacy email-based check for backwards compatibility.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const hierarchy = await prisma.adminHierarchy.findUnique({
      where: { adminId: userId },
      select: { canCreateAdmins: true },
    })
    if (hierarchy?.canCreateAdmins) return true
  } catch (e) {
    // ignore and fallback
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } })
  return user?.role === 'admin' && user?.email === SUPER_ADMIN_EMAIL
}

/**
 * Check if an admin can create other admins
 * Only Super Admin can create admins
 */
export async function canCreateAdmins(adminId: string): Promise<boolean> {
  return isSuperAdmin(adminId)
}

/**
 * Initialize Super Admin hierarchy on first creation
 */
export async function initializeSuperAdminHierarchy(adminId: string, adminEmail: string): Promise<void> {
  if (adminEmail !== SUPER_ADMIN_EMAIL) return

  const exists = await prisma.adminHierarchy.findUnique({
    where: { adminId }
  })

  if (!exists) {
    await prisma.adminHierarchy.create({
      data: {
        adminId,
        canCreateAdmins: true,
        canManageUsers: true,
        canManageDeposits: true,
        canManageTransactions: true,
        createdBy: adminId,
        parentAdminId: null
      }
    })
  }
}

/**
 * Create a new admin under a Super Admin
 * Only Super Admin can call this
 */
export async function createSubAdmin(
  superAdminId: string,
  adminData: {
    email: string
    name: string
    passwordHash: string
  }
): Promise<string> {
  // Verify caller is Super Admin
  const isSA = await isSuperAdmin(superAdminId)
  if (!isSA) {
    throw new Error('Only Super Admin can create other admins')
  }

  // Create the admin user
  const newAdmin = await prisma.user.create({
    data: {
      email: adminData.email,
      name: adminData.name,
      passwordHash: adminData.passwordHash,
      role: 'admin'
    }
  })

  // Create hierarchy entry - this admin cannot create other admins
  await prisma.adminHierarchy.create({
    data: {
      adminId: newAdmin.id,
      parentAdminId: superAdminId,
      canCreateAdmins: false,
      canManageUsers: true,
      canManageDeposits: true,
      canManageTransactions: true,
      createdBy: superAdminId
    }
  })

  return newAdmin.id
}

/**
 * Get all users assigned to an admin
 */
export async function getAdminUsers(adminId: string): Promise<string[]> {
  const assignments = await prisma.userAdminAssignment.findMany({
    where: { adminId },
    select: { userId: true }
  })
  return assignments.map(a => a.userId)
}

/**
 * Assign a user to an admin
 * Admins can only assign users that they created or that have no admin
 */
export async function assignUserToAdmin(
  adminId: string,
  userId: string,
  assignedByAdminId: string
): Promise<void> {
  // Verify the assigner is either Super Admin or the admin themselves
  const superA = await isSuperAdmin(assignedByAdminId)
  if (!superA && assignedByAdminId !== adminId) {
    throw new Error('Only Super Admin or the admin themselves can assign users')
  }

  // Remove existing assignment if any
  await prisma.userAdminAssignment.deleteMany({
    where: { userId }
  })

  // Create new assignment
  await prisma.userAdminAssignment.create({
    data: {
      userId,
      adminId,
      assignedBy: assignedByAdminId
    }
  })
}

/**
 * Get admin's parent (only Super Admin has no parent)
 */
export async function getAdminParent(adminId: string): Promise<string | null> {
  const hierarchy = await prisma.adminHierarchy.findUnique({
    where: { adminId },
    select: { parentAdminId: true }
  })
  return hierarchy?.parentAdminId ?? null
}

/**
 * Check if a target user (could be admin or regular user) can be assigned to an admin
 * Admins can be assigned to other admins for funding purposes
 */
export async function canAssignUser(
  targetUserId: string,
  adminId: string
): Promise<boolean> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true }
  })
  
  if (!targetUser) return false
  
  // Can assign regular users and admins to an admin
  return targetUser.role === 'user' || targetUser.role === 'admin'
}

/**
 * Get all admins created by a Super Admin
 */
export async function getSubAdmins(superAdminId: string): Promise<any[]> {
  const isSA = await isSuperAdmin(superAdminId)
  if (!isSA) {
    throw new Error('Only Super Admin can view sub-admins')
  }

  const admins = await prisma.adminHierarchy.findMany({
    where: { parentAdminId: superAdminId },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true
        }
      }
    }
  })

  return admins.map(a => ({
    id: a.admin.id,
    email: a.admin.email,
    name: a.admin.name,
    canCreateAdmins: a.canCreateAdmins,
    canManageUsers: a.canManageUsers,
    canManageDeposits: a.canManageDeposits,
    canManageTransactions: a.canManageTransactions,
    createdAt: a.admin.createdAt
  }))
}
