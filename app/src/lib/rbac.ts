export type AppRole = 'user' | 'subadmin' | 'admin'

export const SUBADMIN_PERMISSIONS = [
  'dashboard.self',
  'wallet.self',
  'transfer.self',
  'admin.console',
  'admin.users.read',
  'admin.users.write',
  'admin.users.create',
  'admin.transfer.others',
  'admin.fund.others',
] as const

export function readSessionRole(): AppRole {
  try {
    const raw = localStorage.getItem('verdexis_auth')
    const role = raw ? String((JSON.parse(raw) as { role?: string }).role || 'user') : 'user'
    if (role === 'admin' || role === 'subadmin') return role
    return 'user'
  } catch {
    return 'user'
  }
}

export function isStaffRole(role = readSessionRole()) {
  return role === 'admin' || role === 'subadmin'
}

export function isFullAdmin(role = readSessionRole()) {
  return role === 'admin'
}
