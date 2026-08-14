import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../lib/api'
import { useEffect, useState } from 'react'

/**
 * Wraps a route element. Redirects to '/' if no valid auth token is present.
 * Demo mode is handled separately via API health check.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (token) {
      setIsAuthenticated(true)
      setIsChecking(false)
      return
    }

    // Allow immediate access if the user just verified their email and the
    // client has their profile stored. This lets users continue to protected
    // pages after clicking a verification link without forcing a full login.
    try {
      const raw = localStorage.getItem('verdexis_auth')
      const justVerified = localStorage.getItem('verdexis_just_verified')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.emailVerified || justVerified === '1') {
          setIsAuthenticated(true)
          // clear the transient flag so it doesn't persist beyond the session
          if (justVerified === '1') localStorage.removeItem('verdexis_just_verified')
          setIsChecking(false)
          return
        }
      }
    } catch {
      // fall through to default
    }
    setIsAuthenticated(false)
    setIsChecking(false)
  }, [])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
