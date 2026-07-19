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
    const checkAuth = async () => {
      const token = getToken()
      if (!token) {
        setIsAuthenticated(false)
        setIsChecking(false)
        return
      }

      try {
        // Verify token with backend to ensure it's valid
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        if (response.ok) {
          setIsAuthenticated(true)
        } else {
          // Clear invalid token
          localStorage.removeItem('verdexis_token')
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
      }
      
      setIsChecking(false)
    }

    checkAuth()
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
