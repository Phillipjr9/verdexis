import { useEffect, useState } from 'react'
import { Clock, LogOut } from 'lucide-react'
import { getToken } from '../lib/api'

export function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  let inactivityTimer: NodeJS.Timeout | null = null
  let warningTimer: NodeJS.Timeout | null = null

  const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  const WARNING_TIME = 5 * 60 * 1000 // Show warning 5 min before timeout

  useEffect(() => {
    if (!getToken()) return

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (warningTimer) clearTimeout(warningTimer)

      inactivityTimer = setTimeout(() => {
        setShowWarning(true)
        setTimeRemaining(WARNING_TIME / 1000)
      }, SESSION_TIMEOUT - WARNING_TIME)

      warningTimer = setTimeout(() => {
        // Full auth clear so RequireAuth cannot reopen the dashboard via leftover verdexis_auth
        try {
          localStorage.removeItem('verdexis_token')
          localStorage.removeItem('verdexis_auth')
          localStorage.removeItem('verdexis_avatar')
          localStorage.removeItem('verdexis_token_set_at')
          localStorage.removeItem('verdexis_auth_retry_guard')
          localStorage.removeItem('verdexis_just_verified')
        } catch { /* ignore */ }
        window.location.href = '/'
      }, SESSION_TIMEOUT)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }))

    resetInactivityTimer()

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (warningTimer) clearTimeout(warningTimer)
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer))
    }
  }, [])

  useEffect(() => {
    if (!showWarning) return
    const interval = setInterval(
      () => setTimeRemaining((t) => (t > 0 ? t - 1 : 0)),
      1000
    )
    return () => clearInterval(interval)
  }, [showWarning])

  if (!showWarning) return null

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div className="fixed bottom-8 left-8 z-50 max-w-sm">
      <div className="bg-[#F57C00]/10 border border-[#F57C00]/30 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">Your session is expiring</p>
            <p className="text-xs text-[#A0A0A0] mt-1">
              You'll be logged out in{' '}
              <span className="font-mono text-[#F57C00]">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#F57C00] text-white text-xs font-medium hover:bg-[#e68900] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Stay signed in
        </button>
      </div>
    </div>
  )
}
