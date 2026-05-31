import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { api } from '../lib/api'

type State = 'pending' | 'verifying' | 'success' | 'error'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [state, setState] = useState<State>(token ? 'verifying' : 'pending')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        await api.verifyEmail(token)
        if (cancelled) return
        setState('success')
        setMessage('Your email is verified — redirecting to your dashboard…')
        // Refresh `me` so emailVerified flips on the auth shape that
        // populates the dashboard banner before the user navigates.
        try { await api.me() } catch { /* tolerated; banner refresh is best-effort */ }
        setTimeout(() => navigate('/dashboard'), 1500)
      } catch (e) {
        if (cancelled) return
        setState('error')
        setMessage((e as Error)?.message || 'Verification link is invalid or expired.')
      }
    })()
    return () => { cancelled = true }
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-[#070C0E] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/15 flex items-center justify-center mx-auto mb-5">
          {state === 'verifying' && <Loader2 className="w-6 h-6 text-[#0C8B44] animate-spin" />}
          {state === 'success' && <CheckCircle2 className="w-6 h-6 text-[#0C8B44]" />}
          {state === 'error' && <AlertCircle className="w-6 h-6 text-red-400" />}
          {state === 'pending' && <MailCheck className="w-6 h-6 text-[#0C8B44]" />}
        </div>
        <h1 className="text-xl font-light text-[#E5E5E5] mb-2">
          {state === 'verifying' && 'Verifying your email…'}
          {state === 'success' && 'Email verified'}
          {state === 'error' && 'Verification failed'}
          {state === 'pending' && 'Confirm your email'}
        </h1>
        <p className="text-xs text-[#737373] mb-6">
          {state === 'pending'
            ? 'Open the verification link from your inbox or notification bell. The link expires 24 hours after it was sent.'
            : message}
        </p>
        <div className="flex flex-col gap-2">
          <Link to="/dashboard" className="px-4 py-2 bg-[#0C8B44] text-white text-xs uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">
            Back to dashboard
          </Link>
          {state === 'error' && (
            <button
              onClick={() => api.sendVerification().then(() => setMessage('A new verification link was sent. Check your notifications.')).catch((e) => setMessage((e as Error)?.message || 'Could not send link.'))}
              className="text-[11px] text-[#737373] hover:text-[#E5E5E5] transition-colors"
            >
              Send a new verification link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
