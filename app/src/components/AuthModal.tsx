import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Fingerprint, KeyRound, ArrowLeft, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth0 } from '@auth0/auth0-react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import { api, setToken, setStoredUser, type ApiError } from '../lib/api'
import { auth, googleAuthProvider, isFirebaseConfigured } from '../lib/firebase'
import { isSupabaseConfigured, signInWithEmail, signUpWithEmail } from '../lib/supabase'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: 'login' | 'signup'
}

type Mode = 'login' | 'signup' | 'forgot' | 'otp'

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [pendingToken, setPendingToken] = useState('')
  const [pendingFlow, setPendingFlow] = useState<'login' | 'signup'>('login')
  const [otpCode, setOtpCode] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [resendLoading, setResendLoading] = useState(false)

  // Lock body scroll while the modal is open so the fixed overlay always
  // sits centered in the current viewport (prevents the user from having
  // to scroll the page down to find the modal on long pages).
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`
    }
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'forgot') {
      if (!form.email) {
        setError('Enter your email')
        return
      }
      setLoading(true)
      try {
        await api.forgot(form.email)
        setResetSent(true)
        toast.success('Reset link sent', { description: `If that email exists, a reset link has been sent to ${form.email}.` })
      } catch (err) {
        console.warn('Password reset error:', err)
        setResetSent(true)
        toast.success('Reset link sent', { description: 'If that email exists, a reset link has been sent.' })
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)

    try {
      if (mode === 'otp') {
        if (otpCode.length !== 6) {
          setError('Enter the 6-digit code')
          setLoading(false)
          return
        }
        const res = pendingFlow === 'signup'
          ? await api.signupVerifyOtp(pendingToken, otpCode)
          : await api.loginVerifyOtp(pendingToken, otpCode)
        setToken(res.token)
        setStoredUser(res.user)
        toast.success(pendingFlow === 'signup' ? 'Email verified and account created' : 'Welcome back')
        setLoading(false)
        onClose()
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new Event('verdexis:profile'))
        navigate('/dashboard', { replace: true })
        return
      }

      if (mode === 'signup') {
        const trimmedPhone = form.phone.trim()
        // Require a phone with at least 7 digits; same rule as the server.
        const digitCount = (trimmedPhone.match(/\d/g) || []).length
        if (!trimmedPhone || digitCount < 7) {
          setError('Please enter a valid phone number (at least 7 digits).')
          setLoading(false)
          return
        }
      }

      if (false && isSupabaseConfigured) {
        let sessionData
        if (mode === 'signup') {
          const signUpResult = await signUpWithEmail(form.email, form.password)
          if (!signUpResult.session?.access_token) {
            setError('Check your email to verify your Supabase account before logging in.')
            setLoading(false)
            return
          }
          sessionData = signUpResult.session
        } else {
          const signInResult = await signInWithEmail(form.email, form.password)
          sessionData = signInResult.session
        }

        if (!sessionData?.access_token) {
          setError('Unable to authenticate with Supabase.')
          setLoading(false)
          return
        }

        const result = await api.supabaseAuth(sessionData.access_token)
        setToken(result.token)
        setStoredUser(result.user)
        toast.success(mode === 'signup' ? 'Account created' : 'Welcome back')
        setLoading(false)
        onClose()
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new Event('verdexis:profile'))
        navigate('/dashboard', { replace: true })
        return
      }

      // Use backend directly for email/password (Firebase only used for Google sign-in)
      const name = `${form.firstName} ${form.lastName}`.trim()
      let result
      if (mode === 'signup') {
        result = await api.signup(form.email, form.password, name, form.phone.trim())
      } else {
        result = await api.login(form.email, form.password)
      }

      if ('otpRequired' in result || 'pendingToken' in result) {
        const r = result as { pendingToken: string; message?: string; devCode?: string }
        setPendingToken(r.pendingToken)
        setPendingFlow(mode === 'signup' ? 'signup' : 'login')
        setOtpMessage(r.message || '')
        setMode('otp')
        setLoading(false)
        return
      }

      const r = result as { token: string; user: import('../lib/api').ApiUser }
      setToken(r.token)
      setStoredUser(r.user)
      toast.success(mode === 'signup' ? 'Account created' : 'Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      navigate('/dashboard', { replace: true })
      return
    } catch (err) {
      const e = err as ApiError
      const msg = e.error || 'Authentication failed'
      setError(msg)
      setLoading(false)
      return
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
    setResetSent(false)
    setPendingToken('')
    setPendingFlow('login')
    setOtpCode('')
    setOtpMessage('')
  }

  const goForgot = () => {
    setMode('forgot')
    setError('')
    setResetSent(false)
  }

  const goBackToLogin = () => {
    setMode('login')
    setError('')
    setResetSent(false)
    setPendingToken('')
    setPendingFlow('login')
    setOtpCode('')
    setOtpMessage('')
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    if (!isFirebaseConfigured || !auth || !googleAuthProvider) {
      setError('Google sign-in is not configured. Please add Firebase config.')
      setLoading(false)
      return
    }

    try {
      const credential = await signInWithPopup(auth, googleAuthProvider)
      const idToken = await credential.user.getIdToken()
      const result = await api.google(idToken)
      setToken(result.token)
      setStoredUser(result.user)
      toast.success('Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Google authentication failed'
      setError(msg)
      setLoading(false)
    }
  }

  const { loginWithPopup, getAccessTokenSilently } = useAuth0()

  const handleAuth0SignIn = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithPopup({ authorizationParams: { prompt: 'select_account' } })
      const audience = (import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined) || (import.meta.env.NEXT_PUBLIC_AUTH0_AUDIENCE as string | undefined) || undefined
      const accessToken = await getAccessTokenSilently(audience ? { authorizationParams: { audience } } : undefined)
      if (!accessToken) throw new Error('No access token received from Auth0')
      const result = await api.auth0(accessToken)
      setToken(result.token)
      setStoredUser(result.user)
      toast.success('Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Auth0 authentication failed'
      setError(msg)
      setLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const { isPasskeySupported, authenticateWithPasskey } = await import('../lib/passkeys')
      
      if (!isPasskeySupported()) {
        setError('Passkeys are not supported on this device/browser')
        setLoading(false)
        return
      }

      toast.info('Touch your security key or use biometrics...')
      
      const { token, user } = await authenticateWithPasskey(form.email || undefined)
      setToken(token)
      setStoredUser(user)
      toast.success('Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Passkey authentication failed'
      setError(msg)
      setLoading(false)
    }
  }

  return createPortal(
    // overflow-y-auto + items-start sm:items-center keeps the modal scrollable
    // from the top of the viewport on short / mobile screens — previously the
    // form bled below the fold and users had to scroll the whole page to see
    // the submit button. p-4 keeps a margin all around so the close button
    // never touches the viewport edge.
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card overflow-hidden my-auto" style={{ background: 'rgba(15,22,25,0.95)', backdropFilter: 'blur(24px)' }}>
        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-8">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center mx-auto mb-3 sm:mb-4 overflow-hidden">
              {mode === 'login' ? (
                <Fingerprint className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              ) : mode === 'forgot' || mode === 'otp' ? (
                <KeyRound className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              ) : (
                <img
                  src="/assets/logo-icon-transparent.png"
                  alt="Verdexis"
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                  onError={(e) => {
                    const img = e.currentTarget
                    img.onerror = null
                    img.style.display = 'none'
                    const parent = img.parentElement
                    if (parent) parent.innerHTML = '<span class="text-white text-2xl font-light tracking-tight">V</span>'
                  }}
                />
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-light tracking-[-0.02em] text-[#E5E5E5]">
              {mode === 'login' ? 'Welcome Back' : mode === 'forgot' ? 'Reset Password' : mode === 'otp' ? 'Verify Identity' : 'Create Account'}
            </h2>
            <p className="text-xs sm:text-sm text-[#737373] mt-1 sm:mt-2">
              {mode === 'login'
                ? 'Sign in to access your dashboard'
                : mode === 'forgot'
                ? "We'll email you a secure reset link"
                : mode === 'otp'
                ? 'Check your email for a verification code'
                : 'Get started with Verdexis'}
            </p>
          </div>

          {/* Form (placed above OAuth so email/password are visible without scrolling on mobile) */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'otp' && (
              <div>
                <p className="text-sm text-[#A3A3A3] mb-4 text-center">
                  {otpMessage || (pendingFlow === 'signup' ? 'A 6-digit code was sent to your email. Enter it below to verify your address and finish creating your account.' : 'A 6-digit code was sent to your email. Enter it below to complete sign in.')}
                </p>
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors text-center tracking-[0.4em] text-lg"
                    placeholder="000000"
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mt-3">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Shield className="w-4 h-4" /> {pendingFlow === 'signup' ? 'Verify & Create Account' : 'Verify & Sign In'}</>}
                </button>
                {pendingFlow === 'signup' && (
                  <button
                    type="button"
                    onClick={async () => {
                      setError('')
                      if (!form.email) {
                        setError('Email is missing from the signup form.')
                        return
                      }
                      setResendLoading(true)
                      try {
                        const res = await api.signupResendOtp(form.email)
                        setPendingToken(res.pendingToken)
                        setOtpMessage(res.message || `A new code was sent to ${res.email}`)
                        toast.success('Verification code resent')
                      } catch (err) {
                        const e = err as ApiError
                        setError(e.error || 'Could not resend verification code.')
                      } finally {
                        setResendLoading(false)
                      }
                    }}
                    disabled={resendLoading}
                    className="w-full mt-2 py-3.5 text-sm text-[#E5E5E5] bg-[#1a1a1a] border border-[#ffffff08] rounded-xl hover:bg-[#252525] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendLoading ? 'Resending…' : 'Resend code'}
                  </button>
                )}
                {pendingFlow === 'login' && (
                  <button
                    type="button"
                    onClick={async () => {
                      setError('')
                      if (!pendingToken) {
                        setError('No pending session available to resend code.')
                        return
                      }
                      setResendLoading(true)
                      try {
                        const res = await api.loginResendOtp(pendingToken)
                        setPendingToken(res.pendingToken)
                        setOtpMessage(res.message || `A new code was sent to ${res.email}`)
                        toast.success('Verification code resent')
                      } catch (err) {
                        const e = err as ApiError
                        setError(e.error || 'Could not resend verification code.')
                      } finally {
                        setResendLoading(false)
                      }
                    }}
                    disabled={resendLoading}
                    className="w-full mt-2 py-3.5 text-sm text-[#E5E5E5] bg-[#1a1a1a] border border-[#ffffff08] rounded-xl hover:bg-[#252525] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendLoading ? 'Resending…' : 'Resend code'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setOtpCode(''); setPendingToken(''); setPendingFlow('login'); setOtpMessage('') }}
                  className="w-full mt-2 text-xs text-[#737373] hover:text-[#E5E5E5] transition-colors"
                >
                  ← Back to sign in
                </button>
              </div>
            )}

            {mode !== 'otp' && (
            <>
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                      placeholder="John"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-[#737373] mb-1.5 block">{mode === 'login' ? 'Email or username' : 'Email'}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  placeholder={mode === 'login' ? 'you@example.com or janedoe' : 'you@example.com'}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-2 text-[11px] text-[#A3A3A3] leading-relaxed">
                  Please use a real email you can access (like Gmail, Outlook, Yahoo, etc.) for account verification and security alerts.
                </p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="text-xs text-[#737373] mb-1.5 block">Phone number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                    placeholder="+1 555 123 4567"
                    autoComplete="tel"
                    required
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#A3A3A3] leading-relaxed">
                  Required. Used by our team to reach you on WhatsApp / Telegram for verification and bonus release.
                </p>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="text-xs text-[#737373] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  placeholder="Min 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#E5E5E5]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={goForgot}
                  className="mt-2 text-xs text-[#737373] hover:text-[#0C8B44] transition-colors"
                >
                  Forgot password?
                </button>
              )}
              {mode === 'signup' && form.password.length > 0 && <PasswordStrength password={form.password} />}
            </div>
            )}

            {mode === 'forgot' && resetSent && (
              <div className="p-3 rounded-lg bg-[#0C8B44]/10 border border-[#0C8B44]/30 text-sm text-[#00E676]">
                If an account exists for that email, a reset link is on its way.
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && form.password.length < 8)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {mode === 'login' && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#ffffff08]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[rgba(15,22,25,0.95)] px-2 text-[#737373]">Or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1a1a1a] border border-[#ffffff15] text-[#E5E5E5] text-sm font-medium rounded-xl hover:bg-[#252525] hover:border-[#0C8B44]/30 transition-colors"
                >
                  <Fingerprint className="w-5 h-5" />
                  Sign in with passkey
                </button>
                <button
                  type="button"
                  onClick={handleAuth0SignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/10 border border-[#ffffff15] text-[#E5E5E5] text-sm font-medium rounded-xl hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-sm">Sign in with Google (Auth0)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAuth0SignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1a1a1a] border border-[#ffffff15] text-[#E5E5E5] text-sm font-medium rounded-xl hover:bg-[#252525] transition-colors"
                >
                  <span className="text-sm">Sign in with Auth0</span>
                </button>
              </>
            )}
            </>
            )}
          </form>

          {/* Switch mode */}
          {mode !== 'otp' && <p className="text-center text-sm text-[#737373] mt-6">
            {mode === 'forgot' ? (
              <button
                onClick={goBackToLogin}
                className="inline-flex items-center gap-1 text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium"
              >
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>
            ) : mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button onClick={switchMode} className="text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium">
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={switchMode} className="text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium">
                  Sign in
                </button>
              </>
            )}
          </p>}

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#ffffff08]">
            <span className="flex items-center gap-1 text-xs text-[#737373]" title="All traffic encrypted with TLS 1.3">
              <Lock className="w-3 h-3" /> TLS 1.3
            </span>
            <span className="flex items-center gap-1 text-xs text-[#737373]" title="Data at rest encrypted with AES-256">
              <Shield className="w-3 h-3" /> AES-256
            </span>
            <span className="flex items-center gap-1 text-xs text-[#737373]">
              <Fingerprint className="w-3 h-3" /> 2FA Ready
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]
  const score = checks.filter(Boolean).length
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const colors = ['#f44336', '#f44336', '#F57C00', '#FFC107', '#9CCC65', '#0C8B44']
  const tone = colors[score]
  const tips: string[] = []
  if (!checks[0]) tips.push('8+ characters')
  if (!checks[1]) tips.push('lowercase')
  if (!checks[2]) tips.push('UPPERCASE')
  if (!checks[3]) tips.push('a digit')
  if (!checks[4]) tips.push('a symbol')
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < score ? tone : '#1a1a1a' }} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: tone }}>
        {labels[score]}
        {tips.length > 0 && <span className="text-[#737373]"> · add {tips.join(', ')}</span>}
      </p>
    </div>
  )
}
