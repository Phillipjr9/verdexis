import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { api, getToken } from '../lib/api'

function roleFromMe(me: unknown): string | undefined {
  if (!me || typeof me !== 'object') return undefined
  const rec = me as { role?: string; user?: { role?: string } }
  return rec.user?.role ?? rec.role
}

/**
 * Gates a route to authenticated admin users.
 * /api/auth/me returns the user at the top level (`{ role }`), not `{ user }`.
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [check, setCheck] = useState<'pending' | 'ok' | 'redirect'>(() => (getToken() ? 'pending' : 'redirect'))

  useEffect(() => {
    if (check !== 'pending') return
    let cancelled = false

    const validateAdmin = async () => {
      try {
        const me = await api.me()
        if (cancelled) return
        if (roleFromMe(me) === 'admin') {
          setCheck('ok')
          return
        }
        toast.error('Admin access required')
        setCheck('redirect')
      } catch (err: any) {
        const status = err && typeof err.status === 'number' ? err.status : undefined
        if (status === 401) {
          if (!cancelled) setCheck('redirect')
          return
        }
        try {
          await new Promise((res) => setTimeout(res, 700))
          const me2 = await api.me()
          if (cancelled) return
          if (roleFromMe(me2) === 'admin') {
            setCheck('ok')
            return
          }
          toast.error('Admin access required')
          setCheck('redirect')
        } catch (err2) {
          console.error('[RequireAdmin] Admin validation failed after retry:', err2)
          if (!cancelled) setCheck('redirect')
        }
      }
    }

    void validateAdmin()
    return () => { cancelled = true }
  }, [check])

  if (check === 'pending') {
    return (
      <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (check === 'redirect') {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
