export type AppRole = 'user' | 'subadmin' | 'admin'

export const PERMISSIONS = [
  'dashboard.self',
  'wallet.self',
  'transfer.self',
  'admin.console',
  'admin.users.read',
  'admin.users.write',
  'admin.users.create',
  'admin.transfer.others',
  'admin.fund.others',
  'admin.fund.self',
  'admin.roles.assign',
  'admin.treasury.seed',
  'admin.settings',
  'admin.impersonate',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  user: ['dashboard.self', 'wallet.self', 'transfer.self'],
  subadmin: [
    'dashboard.self',
    'wallet.self',
    'transfer.self',
    'admin.console',
    'admin.users.read',
    'admin.users.write',
    'admin.users.create',
    'admin.transfer.others',
    'admin.fund.others',
  ],
  admin: [
    'dashboard.self',
    'wallet.self',
    'transfer.self',
    'admin.console',
    'admin.users.read',
    'admin.users.write',
    'admin.users.create',
    'admin.transfer.others',
    'admin.fund.others',
    'admin.fund.self',
    'admin.roles.assign',
    'admin.treasury.seed',
    'admin.settings',
    'admin.impersonate',
  ],
}

export function normalizeRole(role: string | undefined | null): AppRole {
  if (role === 'admin' || role === 'subadmin') return role
  return 'user'
}

export function permissionsFor(role: string | undefined | null): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)]
}

export function can(role: string | undefined | null, permission: Permission): boolean {
  return permissionsFor(role).includes(permission)
}

export function rbacPayload(role: string | undefined | null) {
  const normalized = normalizeRole(role)
  return {
    role: normalized,
    permissions: permissionsFor(normalized),
    isStaff: normalized === 'admin' || normalized === 'subadmin',
    isFullAdmin: normalized === 'admin',
  }
}
