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
    if (scrollbarGap > 0) document.body.style.paddingRight = `${scrollbarGap}px`
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

    let submitEmail = form.email
    let submitPassword = form.password
    try {
      const formEl = e.currentTarget as HTMLFormElement
      const fd = new FormData(formEl)
      const domEmail = String(fd.get('email') || '').trim()
      const domPassword = String(fd.get('password') || '')
      if (domEmail) submitEmail = domEmail
      if (domPassword) submitPassword = domPassword
      if (domEmail || domPassword) {
        setForm((current) => ({
          ...current,
          email: domEmail || current.email,
          password: domPassword || current.password,
        }))
      }
    } catch {
      // keep state
    }

    if (mode === 'forgot') {
      const safeEmail = sanitizeEmail(submitEmail)
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
        const safeEmail = sanitizeEmail(submitEmail)
        const safePhone = sanitizeText(form.phone, '').replace(/[^\d+()\-\s.]/g, '')
        const safeAddress = sanitizeDisplayText(form.address, 200)
        const safeFirstName = sanitizeDisplayText(form.firstName, 40)
        const safeLastName = sanitizeDisplayText(form.lastName, 40)
        if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
          setError('Enter a valid email address')
          setLoading(false)
          return
        }
        if (!submitPassword || submitPassword.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }
        if (submitPassword !== form.confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
      }

      const safeEmail = sanitizeEmail(submitEmail || form.email)
      const safeFirstName = sanitizeDisplayText(form.firstName, 40)
      const safeLastName = sanitizeDisplayText(form.lastName, 40)
      const safePhone = sanitizeText(form.phone, '').replace(/[^\d+()\-\s.]/g, '')
      const safeAddress = sanitizeDisplayText(form.address, 200)
      const name = `${safeFirstName} ${safeLastName}`.trim()
      const pwd = submitPassword || form.password
      let result
      if (mode === 'signup') {
        result = await api.signup(safeEmail, pwd, name, safePhone.trim(), safeAddress.trim())
      } else {
        result = await api.login(safeEmail, pwd)
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
      setError(err?.error || err?.message || 'Passkey authentication failed')
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card overflow-hidden my-auto" style={{ background: 'rgba(15,22,25,0.95)', backdropFilter: 'blur(24px)' }}>
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] transition-colors z-10">
          <X className="w-4 h-4" />
        </button>
        <div className="p-5 sm:p-8">
          <div className="text-center mb-4 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center mx-auto mb-3 sm:mb-4 overflow-hidden">
              {mode === 'login' ? <Fingerprint className="w-6 h-6 sm:w-8 sm:h-8 text-white" /> : mode === 'forgot' || mode === 'otp' ? <KeyRound className="w-6 h-6 sm:w-8 sm:h-8 text-white" /> : <span className="text-white text-2xl font-light">V</span>}
            </div>
            <h2 className="text-xl sm:text-2xl font-light tracking-[-0.02em] text-[#E5E5E5]">
              {mode === 'login' ? 'Welcome Back' : mode === 'forgot' ? 'Reset Password' : mode === 'otp' ? 'Verify Identity' : 'Create Account'}
            </h2>
            <p className="text-xs sm:text-sm text-[#737373] mt-1 sm:mt-2">
              {mode === 'login' ? 'Sign in to access your dashboard' : mode === 'forgot' ? "We'll email you a secure reset link" : mode === 'otp' ? 'Check your email for a verification code' : 'Get started with Verdexis'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'otp' && (
              <div>
                <p className="text-sm text-[#A3A3A3] mb-4 text-center">{otpMessage || 'Enter the 6-digit code sent to your email.'}</p>
                <input type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] text-center tracking-[0.4em] text-lg" placeholder="000000" autoFocus />
                {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mt-3">{error}</div>}
                <button type="submit" disabled={loading || otpCode.length !== 6} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl mt-4 disabled:opacity-50">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Shield className="w-4 h-4" /> Verify & Sign In</>}
                </button>
                <button type="button" onClick={goBackToLogin} className="w-full mt-2 text-xs text-[#737373]">← Back to sign in</button>
              </div>
            )}

            {mode !== 'otp' && (
              <>
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block">{mode === 'login' ? 'Email or username' : 'Email'}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                    <input type={mode === 'login' ? 'text' : 'email'} name="email" value={form.email} onChange={(e) => setForm({ ...form, email: sanitizeEmail(e.target.value) })} className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5]" placeholder={mode === 'login' ? 'you@example.com or janedoe' : 'you@example.com'} required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <label className="text-xs text-[#737373] mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                      <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5]" placeholder="Min 8 characters" required autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373]">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                    {mode === 'login' && (
                      <button type="button" onClick={goForgot} className="mt-2 text-xs text-[#737373] hover:text-[#0C8B44]">Forgot password?</button>
                    )}
                  </div>
                )}

                {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}

                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl disabled:opacity-50">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{mode === 'login' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Create Account'}<ArrowRight className="w-4 h-4" /></>}
                </button>

                {mode === 'login' && (
                  <button type="button" onClick={handlePasskeyLogin} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1a1a1a] border border-[#ffffff15] text-[#E5E5E5] text-sm font-medium rounded-xl">
                    <Fingerprint className="w-5 h-5" /> Sign in with passkey
                  </button>
                )}
              </>
            )}
          </form>

          {mode !== 'otp' && (
            <p className="text-center text-sm text-[#737373] mt-6">
              {mode === 'forgot' ? (
                <button onClick={goBackToLogin} className="text-[#0C8B44] font-medium">Back to sign in</button>
              ) : mode === 'login' ? (
                <>Don&apos;t have an account? <button onClick={switchMode} className="text-[#0C8B44] font-medium">Sign up free</button></>
              ) : (
                <>Already have an account? <button onClick={switchMode} className="text-[#0C8B44] font-medium">Sign in</button></>
              )}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
