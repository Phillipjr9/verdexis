import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { getToken, api } from '../lib/api'

/**
 * Gates a route to authenticated *admin* users. We re-validate against the
 * server (`/api/auth/me`) on mount so the role check can't be spoofed by
 * editing localStorage. While the check is in flight we render a spinner.
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [check, setCheck] = useState<'pending' | 'ok' | 'redirect'>(() => (getToken() ? 'pending' : 'redirect'))
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (check !== 'pending') return
    let cancelled = false

    const validateAdmin = async (attempt = 0) => {
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
        if (cancelled) return
        const error = err as { error?: string; status?: number }
        
        // Retry once on network errors
        if (attempt === 0 && (error.status === 0 || error.status === 503)) {
          setRetrying(true)
          setTimeout(() => {
            if (!cancelled) {
              setRetrying(false)
              validateAdmin(1)
            }
          }, 500)
          return
        }
        
        console.warn('Admin validation failed:', error.error)
        setCheck('redirect')
      }
    }

    validateAdmin()
    return () => { cancelled = true }
  }, [check])

  if (check === 'pending') {
    return (
      <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
        {retrying && <p className="text-xs text-[#A0A0A0] absolute bottom-8">Retrying...</p>}
      </div>
    )
  }
  if (check === 'redirect') {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
