import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../lib/api'
import { PageSpinner } from './ui/spinner'
import { useEffect, useState } from 'react'

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

    try {
      const raw = localStorage.getItem('verdexis_auth')
      const justVerified = localStorage.getItem('verdexis_just_verified')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.emailVerified || justVerified === '1') {
          setIsAuthenticated(true)
          if (justVerified === '1') localStorage.removeItem('verdexis_just_verified')
          setIsChecking(false)
          return
        }
      }
    } catch {
      // fall through
    }
    setIsAuthenticated(false)
    setIsChecking(false)
  }, [])

  if (isChecking) return <PageSpinner />
  if (!isAuthenticated) return <Navigate to="/" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
