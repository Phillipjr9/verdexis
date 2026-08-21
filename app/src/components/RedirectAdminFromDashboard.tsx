import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api'
import { userFromMe } from '../lib/authMe'
import { PageSpinner } from './ui/spinner'

/**
 * When an admin lands on /dashboard (bookmark or post-login), send them to /admin.
 * Set VITE_ADMIN_STAY_ON_DASHBOARD=1 to keep the old hybrid dashboard.
 */
export default function RedirectAdminFromDashboard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'pending' | 'admin' | 'user'>('pending')

  useEffect(() => {
    if (import.meta.env.VITE_ADMIN_STAY_ON_DASHBOARD === '1') {
      setState('user')
      return
    }
    let cancelled = false
    api
      .me()
      .then((me) => {
        if (cancelled) return
        setState(userFromMe(me)?.role === 'admin' ? 'admin' : 'user')
      })
      .catch(() => {
        if (!cancelled) setState('user')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'pending') return <PageSpinner />
  if (state === 'admin') return <Navigate to="/admin" replace />
  return <>{children}</>
}
