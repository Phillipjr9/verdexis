/** /api/auth/me returns the user at the top level, not { user }. */

export type MeUser = {
  id: string
  email: string
  name?: string
  role?: string
  suspended?: boolean
  prefs?: Record<string, unknown>
}

export function userFromMe(me: unknown): MeUser | undefined {
  if (!me || typeof me !== 'object') return undefined
  const rec = me as { user?: MeUser } & MeUser
  if (rec.user && typeof rec.user === 'object' && (rec.user.id || rec.user.role || rec.user.email)) {
    return rec.user
  }
  if (rec.id || rec.role || rec.email) return rec
  return undefined
}
