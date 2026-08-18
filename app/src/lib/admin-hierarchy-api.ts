import { api } from './api'

const BASE = '/api/admin/hierarchy'

export interface HierarchyAdmin {
  id: string
  email: string
  name: string
  canCreateAdmins?: boolean
  canManageUsers?: boolean
  canManageDeposits?: boolean
  canManageTransactions?: boolean
  createdAt?: string
}

export interface AssignedUser {
  id: string
  email: string
  name: string
  role?: string
  suspended?: boolean
  kycStatus?: string
  createdAt: string
  assignedAt?: string
  type?: 'admin' | 'user'
}

export const adminHierarchy = {
  listSubAdmins: () =>
    api.get<{ admins: HierarchyAdmin[]; count: number }>(`${BASE}/admins`),

  getAdmin: (adminId: string) =>
    api.get<{
      admin: HierarchyAdmin
      hierarchy: {
        canCreateAdmins?: boolean
        canManageUsers?: boolean
        canManageDeposits?: boolean
        canManageTransactions?: boolean
        parentAdmin: { id: string; email: string; name: string } | null
        isSuperAdmin?: boolean
      }
      assignedUsersAndAdmins: AssignedUser[]
      assignedCount: number
    }>(`${BASE}/admins/${encodeURIComponent(adminId)}`),

  createSubAdmin: (payload: { email: string; name: string; password: string }) =>
    api.post<{
      ok: boolean
      admin: { id: string; email: string; name: string; role: string; createdAt: string }
      message: string
    }>(`${BASE}/admins`, payload),

  assignUserToAdmin: (userId: string, adminId: string) =>
    api.post<{ ok: boolean; message: string }>(`${BASE}/assign-user`, { userId, adminId }),

  getUsersForAdmin: (adminId: string) =>
    api.get<{ usersAndAdmins: AssignedUser[]; count: number }>(
      `${BASE}/admins/${encodeURIComponent(adminId)}/users`,
    ),

  removeAssignment: (userId: string, adminId: string) =>
    api.post<{ ok: boolean; message: string }>(`${BASE}/remove-assignment`, { userId, adminId }),
}
