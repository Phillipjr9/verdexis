import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { api, getToken } from '../lib/api'

/**
 * Gates a route to authenticated *admin* users. We re-validate against the
 * server (`/api/auth/me`) on mount so the role check can't be spoofed by
 * editing localStorage. While the check is in flight we render a spinner.
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [check, setCheck] = useState<'pending' | 'ok' | 'redirect'>(() => (getToken() ? 'pending' : 'redirect'))

  useEffect(() => {
    if (check !== 'pending') return
    let cancelled = false

    const validateAdmin = async () => {
      try {
        const { user } = await api.me()
        if (cancelled) return

        if (user.role === 'admin') {
          setCheck('ok')
        } else {
          toast.error('Admin access required')
          setCheck('redirect')
        }
      } catch (err) {
        console.warn('Admin validation failed:', err)
        if (!cancelled) setCheck('redirect')
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
