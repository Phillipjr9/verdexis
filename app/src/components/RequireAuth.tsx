import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../lib/api'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
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
    if (!isFirebaseConfigured || !auth) {
      const token = getToken()
      setIsAuthenticated(Boolean(token))
      setIsChecking(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(Boolean(user))
      setIsChecking(false)
    })

    return () => unsubscribe()
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
