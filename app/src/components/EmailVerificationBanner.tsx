import { useState, useEffect } from 'react'
import { Mail, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

const DISMISS_KEY = 'verdexis_email_banner_dismissed'

interface Props {
  email?: string
  emailVerified?: boolean
}

/**
 * Persistent banner shown on the dashboard when the signed-in user hasn't
 * verified their email. Dismissible per-session — but since unverified users
 * are blocked from withdrawing, the toast on the wallet page will reopen it.
 *
 * Subscribes to the `verdexis:profile` event so when verification completes
 * in another tab (or the verify-email page), the banner disappears without
 * requiring a route change.
 */
export default function EmailVerificationBanner({ email, emailVerified: emailVerifiedProp }: Props) {
  const [emailVerified, setEmailVerified] = useState(!!emailVerifiedProp)
  useEffect(() => { setEmailVerified(!!emailVerifiedProp) }, [emailVerifiedProp])
  // Re-read the cached user on profile updates so a successful verify-email
  // flow in another tab clears this banner instantly.
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem('verdexis_auth')
        if (raw) {
          const u = JSON.parse(raw) as { emailVerified?: boolean }
          if (u.emailVerified) setEmailVerified(true)
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('verdexis:profile', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('verdexis:profile', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (emailVerified || dismissed) return null

  const send = async () => {
    setSending(true)
    try {
      const r = await api.sendVerification()
      if (r.alreadyVerified) {
        toast.success('Email already verified — refresh to update.')
        setDismissed(true)
        return
      }
      setSent(true)
      toast.success('Verification link sent. Check your inbox & notification bell.')
      // In dev, we surface the raw link so testers don't need SMTP wired up.
      if (r.devLink) {
        toast.message('Dev link', { description: r.devLink, duration: 30_000 })
      }
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not send verification link.')
    } finally {
      setSending(false)
    }
  }

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* tolerated */ }
  }

  return (
    <div className="mb-6 rounded-xl bg-yellow-400/10 border border-yellow-400/20 px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-yellow-400/15 flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-yellow-400">
          Verify your email{email ? ` (${email})` : ''} to unlock withdrawals.
        </p>
        <p className="text-[10px] text-yellow-400/70">
          Withdrawals are blocked until you confirm ownership of your inbox.
        </p>
      </div>
      <button
        onClick={send}
        disabled={sending || sent}
        className="px-3 py-1.5 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 text-[11px] uppercase tracking-[0.05em] rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0"
      >
        {sending && <Loader2 className="w-3 h-3 animate-spin" />}
        {sent ? 'Sent' : sending ? 'Sending…' : 'Send link'}
      </button>
      <button onClick={dismiss} className="text-yellow-400/60 hover:text-yellow-400 transition-colors" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
