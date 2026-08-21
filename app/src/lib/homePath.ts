/** Post-login home path by role. Admins use the dedicated admin console. */
export function homePathForUser(user: { role?: string } | null | undefined): string {
  return user?.role === 'admin' ? '/admin' : '/dashboard'
}
