import { api, setStoredUser } from './lib/api'

function readStored(): { id?: string; role?: string } {
  try {
    return JSON.parse(localStorage.getItem('verdexis_user') || localStorage.getItem('verdexis_auth') || '{}') as { id?: string; role?: string }
  } catch {
    return {}
  }
}

async function syncRole() {
  try {
    const me = await api.me()
    const user = (me as { user?: Record<string, unknown> }).user || (me as Record<string, unknown>)
    if (!user || typeof user !== 'object' || !('id' in user)) return
    setStoredUser(user as Parameters<typeof setStoredUser>[0])
    const role = String((user as { role?: string }).role || 'user')
    try {
      const authRaw = localStorage.getItem('verdexis_auth')
      if (authRaw) {
        const auth = JSON.parse(authRaw) as Record<string, unknown>
        if (auth.role !== role) {
          auth.role = role
          localStorage.setItem('verdexis_auth', JSON.stringify(auth))
        }
      }
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('verdexis:profile'))
  } catch {
    /* not signed in */
  }
}

void syncRole()
setInterval(() => { void syncRole() }, 20_000)
window.addEventListener('focus', () => { void syncRole() })
export { readStored }
