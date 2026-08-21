/** Where to send the user after successful auth. */
export function postAuthPath(user?: { role?: string } | null): string {
  const role = (user?.role || '').toLowerCase()
  if (role === 'admin' || role === 'super_admin' || role === 'superadmin') return '/admin'
  return '/dashboard'
}
