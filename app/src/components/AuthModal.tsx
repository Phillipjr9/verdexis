import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Fingerprint, KeyRound, ArrowLeft, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { api, getFriendlyApiErrorMessage, setTokenWithTimestamp, setStoredUser, type ApiError } from '../lib/api'
import { sanitizeDisplayText, sanitizeEmail, sanitizeText } from '../lib/sanitize'
import { isSupabaseConfigured, signInWithEmail, signUpWithEmail } from '../lib/supabase'
import AddressAutocomplete from './AddressAutocomplete'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: 'login' | 'signup'
}

type Mode = 'login' | 'signup' | 'forgot' | 'otp'

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const navigate = useNavigate()
  const goAfterAuth = (user?: { role?: string } | null) => {
    const role = user?.role
    const dest = role === 'admin' ? '/admin' : '/dashboard'
    // Hard navigation avoids stuck modal / race with onClose -> navigate('/')
    window.setTimeout(() => {
      window.location.assign(dest)
    }, 50)
  }
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '', phone: '', address: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [pendingToken, setPendingToken] = useState('')
  const [pendingFlow, setPendingFlow] = useState<'login' | 'signup'>('login')
  const [otpCode, setOtpCode] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [resendLoading, setResendLoading] = useState(false)

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
      const safeEmail = sanitizeEmail(form.email)
      if (!safeEmail) {
        setError('Enter your email')
        return
      }
      setLoading(true)
      try {
        await api.forgot(safeEmail)
        setResetSent(true)
        toast.success('Reset link sent', { description: `If that email exists, a reset link has been sent to ${safeEmail}.` })
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
        setTokenWithTimestamp(res.token)
        setStoredUser(res.user)
        toast.success(pendingFlow === 'signup' ? 'Email verified and account created' : 'Welcome back')
        setLoading(false)
        onClose()
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new Event('verdexis:profile'))
        goAfterAuth(res.user)
        return
      }

      if (mode === 'signup') {
        const safeEmail = sanitizeEmail(form.email)
        const safePhone = sanitizeText(form.phone, '').replace(/[^\d+()\-\s.]/g, '')
        const safeAddress = sanitizeDisplayText(form.address, 200)
        const safeFirstName = sanitizeDisplayText(form.firstName, 40)
        const safeLastName = sanitizeDisplayText(form.lastName, 40)
        setForm((current) => ({ ...current, email: safeEmail, phone: safePhone, address: safeAddress, firstName: safeFirstName, lastName: safeLastName }))

        if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
          setError('Enter a valid email address')
          setLoading(false)
          return
        }
        if (!form.password || form.password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        const trimmedPhone = safePhone.trim()
        if (trimmedPhone) {
          const digitCount = (trimmedPhone.match(/\d/g) || []).length
          if (digitCount < 7) {
            setError('If you add a phone number, it must contain at least 7 digits.')
            setLoading(false)
            return
          }
        }
        if (!safeAddress || safeAddress.length < 5) {
          setError('Please enter your street address')
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
        setTokenWithTimestamp(result.token)
        setStoredUser(result.user)
        toast.success(mode === 'signup' ? 'Account created' : 'Welcome back')
        setLoading(false)
        onClose()
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new Event('verdexis:profile'))
        goAfterAuth(result.user)
        return
      }

      const safeEmail = sanitizeEmail(form.email)
      const safeFirstName = sanitizeDisplayText(form.firstName, 40)
      const safeLastName = sanitizeDisplayText(form.lastName, 40)
      const safePhone = sanitizeText(form.phone, '').replace(/[^\d+()\-\s.]/g, '')
      const safeAddress = sanitizeDisplayText(form.address, 200)
      const name = `${safeFirstName} ${safeLastName}`.trim()
      let result
      if (mode === 'signup') {
        result = await api.signup(safeEmail, form.password, name, safePhone.trim(), safeAddress.trim())
      } else {
        result = await api.login(safeEmail, form.password)
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
      setTokenWithTimestamp(r.token)
      setStoredUser(r.user)
      toast.success(mode === 'signup' ? 'Account created' : 'Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      goAfterAuth(r.user)
      return
    } catch (err) {
        const e = err as ApiError
        setError(getFriendlyApiErrorMessage(e))
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
      setTokenWithTimestamp(token)
      setStoredUser(user)
      toast.success('Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      goAfterAuth(user)
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Passkey authentication failed'
      setError(msg)
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md glass-card overflow-hidden my-auto" style={{ background: 'rgba(15,22,25,0.95)', backdropFilter: 'blur(24px)' }}>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-8">
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
                      onChange={(e) => setForm({ ...form, firstName: sanitizeDisplayText(e.target.value, 40) })}
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
                      onChange={(e) => setForm({ ...form, lastName: sanitizeDisplayText(e.target.value, 40) })}
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
                  onChange={(e) => setForm({ ...form, email: sanitizeEmail(e.target.value) })}
                  className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  placeholder={mode === 'login' ? 'you@example.com or janedoe' : 'you@example.com'}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

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
            </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
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
              <button
                type="button"
                onClick={handlePasskeyLogin}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1a1a1a] border border-[#ffffff15] text-[#E5E5E5] text-sm font-medium rounded-xl hover:bg-[#252525] transition-colors"
              >
                <Fingerprint className="w-5 h-5" />
                Sign in with passkey
              </button>
            )}
            </>
            )}
          </form>

          {mode !== 'otp' && <p className="text-center text-sm text-[#737373] mt-6">
            {mode === 'forgot' ? (
              <button onClick={goBackToLogin} className="text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium">
                Back to sign in
              </button>
            ) : mode === 'login' ? (
              <>
                Don't have an account?{' '}
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
        </div>
      </div>
    </div>,
    document.body
  )
}
