import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { Toaster, toast } from 'sonner'
import {
  User, Shield, Bell, Palette, Key, LogOut,
  Check, ChevronRight, Camera, Save,
  TrendingUp, Plug, Lock, Fingerprint, Settings as SettingsIcon,
} from 'lucide-react'
import { fileToAvatarDataUrl, getAvatar, updateProfile } from '../lib/userProfile'
import { sanitizeDisplayText, sanitizeEmail, sanitizeText, sanitizeUsername } from '../lib/sanitize'
import { applyTheme } from '../lib/themeApplier'
import { api, clearStoredAuth, getToken, setStoredUser, setTokenWithTimestamp } from '../lib/api'
import { adminApi } from '../lib/adminApi'
import { deletePasskey, listPasskeys, registerPasskey, type Passkey } from '../lib/passkeys'

type Section = 'profile' | 'security' | 'trading' | 'connections' | 'notifications' | 'preferences' | 'privacy' | 'admin'

type OrderType = 'market' | 'limit' | 'stop'
type LandingPage = 'home' | 'dashboard' | 'trading' | 'wallet'
type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
type Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh'
type Visibility = 'public' | 'private'

interface UserPrefs {
  email: string
  username: string
  name: string
  phone: string
  country: string
  bio: string
  twoFactorEnabled: boolean
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY'
  theme: 'dark' | 'light' | 'auto'
  language: Language
  timezone: string
  dateFormat: DateFormat
  defaultLandingPage: LandingPage
  compactDensity: boolean
  reducedMotion: boolean
  hideBalances: boolean
  hideSmallBalances: boolean
  requireTradeConfirmation: boolean
  priceAlertsEnabled: boolean
  defaultOrderType: OrderType
  slippageTolerance: number
  maxSingleTrade: number
  analyticsOptOut: boolean
  profileVisibility: Visibility
  blurOnFocusLoss: boolean
}

const DEFAULT_PREFS: UserPrefs = {
  email: '',
  username: '',
  name: 'User',
  phone: '',
  country: '',
  bio: '',
  twoFactorEnabled: false,
  currency: 'USD',
  theme: 'dark',
  language: 'en',
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  dateFormat: 'MM/DD/YYYY',
  defaultLandingPage: 'dashboard',
  compactDensity: false,
  reducedMotion: false,
  hideBalances: false,
  hideSmallBalances: false,
  requireTradeConfirmation: true,
  priceAlertsEnabled: true,
  defaultOrderType: 'market',
  slippageTolerance: 0.5,
  maxSingleTrade: 0,
  analyticsOptOut: false,
  profileVisibility: 'private',
  blurOnFocusLoss: false,
}

function loadPrefs(): UserPrefs {
  try {
    const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
    const stored = JSON.parse(localStorage.getItem('verdexis_prefs') || '{}')
    return {
      ...DEFAULT_PREFS,
      ...stored,
      email: sanitizeEmail(auth.email || stored.email || ''),
      username: sanitizeUsername(auth.username || stored.username || ''),
      name: sanitizeDisplayText(auth.name || stored.name || 'User', 80),
      phone: sanitizeDisplayText(auth.phone || stored.phone || '', 32),
      bio: sanitizeDisplayText(stored.bio || '', 300),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export default function Settings() {
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('profile')
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)
  const [isAuthed, setIsAuthed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [withdrawalFeeRate, setWithdrawalFeeRate] = useState(11.8)
  const [savingFee, setSavingFee] = useState(false)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneVerificationSent, setPhoneVerificationSent] = useState(false)
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('')
  const [sendingEmailVerification, setSendingEmailVerification] = useState(false)
  const [sendingPhoneVerification, setSendingPhoneVerification] = useState(false)
  const [verifyingPhoneCode, setVerifyingPhoneCode] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; userAgent?: string; ipAddress?: string; lastActivityAt?: string; isActive?: boolean }>>([])
  const [loginHistory, setLoginHistory] = useState<Array<{ id: string; createdAt: string; ipAddress?: string; userAgent?: string; location?: string; success?: boolean }>>([])
  const [ipRestrictions, setIpRestrictions] = useState<Array<{ id: string; ipAddress: string; type: 'whitelist' | 'blacklist'; description?: string | null; createdAt?: string }>>([])
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [cookiePrefs, setCookiePrefs] = useState({ essential: true, analytics: false, marketing: false, preferences: false })
  const [dataExports, setDataExports] = useState<Array<{ id: string; format: string; status?: string; createdAt?: string }>>([])
  const [newIpAddress, setNewIpAddress] = useState('')
  const [newIpType, setNewIpType] = useState<'whitelist' | 'blacklist'>('whitelist')

  useEffect(() => {
    const auth = localStorage.getItem('verdexis_auth')
    if (!auth) { setIsAuthed(false); return }
    setIsAuthed(true)
    setPrefs(loadPrefs())
    setAvatar(getAvatar())
    try {
      const parsed = JSON.parse(auth)
      if (parsed.role === 'admin') {
        setIsAdmin(true)
        api.get<{ ratePct: number }>('/api/admin/withdrawal-fee-config')
          .then((r) => setWithdrawalFeeRate(r.ratePct))
          .catch(() => {})
      }
      if (parsed.emailVerified) setEmailVerified(true)
    } catch {}
  }, [])

  useEffect(() => {
    if (!getToken()) return
    const fetchPasskeys = async () => {
      setPasskeyError(null)
      setPasskeysLoading(true)
      try {
        const keys = await listPasskeys()
        setPasskeys(keys)
      } catch (err) {
        setPasskeyError((err as any)?.error || (err as Error).message || 'Unable to load passkeys')
      } finally {
        setPasskeysLoading(false)
      }
    }
    fetchPasskeys()
  }, [isAuthed])

  useEffect(() => {
    if (!getToken()) return

    let cancelled = false
    const refreshVerificationStatus = async () => {
      try {
        const status = await api.verificationStatus()
        if (cancelled) return
        setEmailVerified(status.emailVerified)
        setPhoneVerified(status.phoneVerified)
      } catch {
        if (cancelled) return
      }
    }

    refreshVerificationStatus()
    window.addEventListener('verdexis:profile', refreshVerificationStatus)
    return () => {
      cancelled = true
      window.removeEventListener('verdexis:profile', refreshVerificationStatus)
    }
  }, [])

  useEffect(() => {
    if (!isAuthed) return

    const loadUserSettings = async () => {
      try {
        const [sessionResult, loginResult, restrictionResult, recoveryResult, cookieResult, exportResult] = await Promise.all([
          api.userSettings.getSessions().catch(() => ({ items: [] })),
          api.userSettings.getLoginHistory().catch(() => ({ items: [] })),
          api.userSettings.getIpRestrictions().catch(() => ({ items: [] })),
          api.userSettings.get2faRecoveryCodes().catch(() => ({ items: [] })),
          api.userSettings.getCookiePreferences().catch(() => ({ essential: true, analytics: false, marketing: false, preferences: false })),
          api.userSettings.getDataExports().catch(() => ({ items: [] })),
        ])

        setSessions(Array.isArray((sessionResult as any)?.sessions) ? (sessionResult as any).sessions : Array.isArray(sessionResult) ? sessionResult as any[] : [])
        setLoginHistory(Array.isArray((loginResult as any)?.events) ? (loginResult as any).events : Array.isArray(loginResult) ? loginResult as any[] : [])
        setIpRestrictions(Array.isArray((restrictionResult as any)?.items) ? (restrictionResult as any).items : Array.isArray(restrictionResult) ? restrictionResult as any[] : [])
        setRecoveryCodes(Array.isArray((recoveryResult as any)?.codes) ? (recoveryResult as any).codes : Array.isArray(recoveryResult) ? recoveryResult as any[] : [])
        setCookiePrefs({
          essential: Boolean((cookieResult as any)?.essential ?? true),
          analytics: Boolean((cookieResult as any)?.analytics ?? false),
          marketing: Boolean((cookieResult as any)?.marketing ?? false),
          preferences: Boolean((cookieResult as any)?.preferences ?? false),
        })
        setDataExports(Array.isArray((exportResult as any)?.items) ? (exportResult as any).items : Array.isArray(exportResult) ? exportResult as any[] : [])
      } catch {
        // Ignore load errors in the settings shell; individual actions can surface their own errors.
      }
    }

    void loadUserSettings()
  }, [isAuthed])

  const update = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    const sanitizedValue =
      key === 'name' ? sanitizeDisplayText(value, 80) :
      key === 'email' ? sanitizeEmail(value) :
      key === 'username' ? sanitizeUsername(value) :
      key === 'phone' ? sanitizeDisplayText(value, 32) :
      key === 'bio' ? sanitizeDisplayText(value, 300) :
      value

    const next = { ...prefs, [key]: sanitizedValue }
    setPrefs(next)
    localStorage.setItem('verdexis_prefs', JSON.stringify(next))
    
    if (key === 'name' || key === 'email' || key === 'username') {
      const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
      localStorage.setItem('verdexis_auth', JSON.stringify({ ...auth, [key]: sanitizedValue }))
      window.dispatchEvent(new Event('verdexis:profile'))
    }
    if (key === 'theme') {
      applyTheme(value as UserPrefs['theme'])
      window.dispatchEvent(new Event('verdexis:prefs'))
    }
    if (key === 'reducedMotion') document.documentElement.classList.toggle('reduce-motion', !!value)
    if (key === 'compactDensity') document.documentElement.classList.toggle('compact-ui', !!value)
    if (key === 'hideBalances') document.documentElement.classList.toggle('hide-balances', !!value)
    
    if (getToken()) {
      const patch: Record<string, unknown> = {}
      if (key === 'name') patch.name = value
      else if (key === 'username') patch.username = (value as string).trim().toLowerCase() || null
      else if (key === 'email') patch.email = (value as string).trim().toLowerCase()
      else if (key === 'phone') patch.phone = value
      else if (key === 'twoFactorEnabled') patch.twoFactor = value
      else patch.prefs = next
      
      api.patchProfile(patch)
        .then(async (res) => {
          setStoredUser(res.user)
          if (key === 'email' || key === 'phone') {
            try {
              const status = await api.verificationStatus()
              setEmailVerified(status.emailVerified)
              setPhoneVerified(status.phoneVerified)
            } catch {
              /* ignore */
            }
          }
          if (key !== 'username') toast.success('Saved')
        })
        .catch((err) => {
          if (key === 'username') toast.error((err as { error?: string }).error || 'Username unavailable')
          else toast.error((err as { error?: string }).error || 'Failed to save preference')
        })
    } else {
      if (key !== 'username') toast.success('Saved locally')
    }
  }

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion)
    document.documentElement.classList.toggle('compact-ui', prefs.compactDensity)
    document.documentElement.classList.toggle('hide-balances', prefs.hideBalances)
  }, [prefs.reducedMotion, prefs.compactDensity, prefs.hideBalances])

  useEffect(() => {
    if (!prefs.blurOnFocusLoss) {
      document.documentElement.style.removeProperty('filter')
      return
    }
    const onBlur = () => { document.documentElement.style.filter = 'blur(8px)' }
    const onFocus = () => { document.documentElement.style.removeProperty('filter') }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.documentElement.style.removeProperty('filter')
    }
  }, [prefs.blurOnFocusLoss])

  const handleAvatarPick = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      updateProfile({ avatar: dataUrl })
      setAvatar(dataUrl)
      if (getToken()) {
        try {
          const res = await api.patchProfile({ avatar: dataUrl })
          setStoredUser(res.user)
        } catch { }
      }
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update avatar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarRemove = async () => {
    updateProfile({ avatar: null })
    setAvatar(null)
    if (getToken()) {
      try { await api.patchProfile({ avatar: null }) } catch { }
    }
    toast.success('Avatar removed')
  }

  const refreshUserSettingsPanels = async () => {
    try {
      const [sessionResult, loginResult, restrictionResult, recoveryResult, cookieResult, exportResult] = await Promise.all([
        api.userSettings.getSessions().catch(() => ({ items: [] })),
        api.userSettings.getLoginHistory().catch(() => ({ items: [] })),
        api.userSettings.getIpRestrictions().catch(() => ({ items: [] })),
        api.userSettings.get2faRecoveryCodes().catch(() => ({ items: [] })),
        api.userSettings.getCookiePreferences().catch(() => ({ essential: true, analytics: false, marketing: false, preferences: false })),
        api.userSettings.getDataExports().catch(() => ({ items: [] })),
      ])

      setSessions(Array.isArray((sessionResult as any)?.sessions) ? (sessionResult as any).sessions : Array.isArray(sessionResult) ? sessionResult as any[] : [])
      setLoginHistory(Array.isArray((loginResult as any)?.events) ? (loginResult as any).events : Array.isArray(loginResult) ? loginResult as any[] : [])
      setIpRestrictions(Array.isArray((restrictionResult as any)?.items) ? (restrictionResult as any).items : Array.isArray(restrictionResult) ? restrictionResult as any[] : [])
      setRecoveryCodes(Array.isArray((recoveryResult as any)?.codes) ? (recoveryResult as any).codes : Array.isArray(recoveryResult) ? recoveryResult as any[] : [])
      setCookiePrefs({
        essential: Boolean((cookieResult as any)?.essential ?? true),
        analytics: Boolean((cookieResult as any)?.analytics ?? false),
        marketing: Boolean((cookieResult as any)?.marketing ?? false),
        preferences: Boolean((cookieResult as any)?.preferences ?? false),
      })
      setDataExports(Array.isArray((exportResult as any)?.items) ? (exportResult as any).items : Array.isArray(exportResult) ? exportResult as any[] : [])
    } catch {
      // no-op: reload is best-effort
    }
  }

  const handleRevokeSession = async (id: string) => {
    try {
      await api.userSettings.revokeSession(id)
      setSessions((current) => current.filter((session) => session.id !== id))
      toast.success('Session revoked')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to revoke session')
    }
  }

  const handleRevokeAllSessions = async () => {
    try {
      await api.userSettings.revokeAllSessions()
      setSessions([])
      toast.success('All sessions revoked')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to revoke sessions')
    }
  }

  const handleGenerateRecoveryCodes = async () => {
    try {
      const result = await api.userSettings.generate2faRecoveryCodes()
      const nextCodes = Array.isArray(result?.codes) ? result.codes : []
      setRecoveryCodes(nextCodes)
      toast.success('Recovery codes generated')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to generate recovery codes')
    }
  }

  const handleAddIpRestriction = async () => {
    if (!newIpAddress.trim()) return
    try {
      const added = await api.userSettings.addIpRestriction({
        ipAddress: newIpAddress.trim(),
        type: newIpType,
        description: 'User-managed restriction',
      })
      setIpRestrictions((current) => [added as any, ...current])
      setNewIpAddress('')
      toast.success('IP restriction added')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to add restriction')
    }
  }

  const handleDeleteIpRestriction = async (id: string) => {
    try {
      await api.userSettings.deleteIpRestriction(id)
      setIpRestrictions((current) => current.filter((item) => item.id !== id))
      toast.success('Restriction removed')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to remove restriction')
    }
  }

  const handleSaveCookiePrefs = async () => {
    try {
      const result = await api.userSettings.patchCookiePreferences(cookiePrefs)
      setCookiePrefs({
        essential: Boolean((result as any)?.essential ?? cookiePrefs.essential),
        analytics: Boolean((result as any)?.analytics ?? cookiePrefs.analytics),
        marketing: Boolean((result as any)?.marketing ?? cookiePrefs.marketing),
        preferences: Boolean((result as any)?.preferences ?? cookiePrefs.preferences),
      })
      toast.success('Cookie preferences saved')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to save preferences')
    }
  }

  const handleRequestDataExport = async (format: 'json' | 'csv' = 'json') => {
    try {
      const result = await api.userSettings.requestDataExport(format)
      setDataExports((current) => [result as any, ...current])
      toast.success('Data export requested')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to request data export')
    }
  }

  const handleLogout = () => {
    if (getToken()) {
      api.logout().catch(() => { })
    }
    clearStoredAuth()
    localStorage.removeItem('verdexis_holdings')
    localStorage.removeItem('verdexis_wallet')
    localStorage.removeItem('verdexis_trades')
    localStorage.removeItem('verdexis_transactions')
    toast.success('Logged out')
    setTimeout(() => { window.location.href = '/' }, 600)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return
    if (getToken()) {
      try { await api.deleteAccount() } catch { }
    }
    localStorage.clear()
    toast.success('Account deleted')
    setTimeout(() => { window.location.href = '/' }, 600)
  }

  const handleSendEmailVerification = async () => {
    setSendingEmailVerification(true)
    try {
      await api.sendVerification()
      toast.success('Verification link sent. Check your email or notifications.')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to send verification link')
    } finally {
      setSendingEmailVerification(false)
    }
  }

  const handleSendPhoneVerification = async () => {
    if (!prefs.phone?.trim()) {
      toast.error('Enter a phone number before requesting verification.')
      return
    }
    setSendingPhoneVerification(true)
    try {
      await api.sendPhoneVerification(prefs.phone.trim())
      setPhoneVerificationSent(true)
      toast.success('Verification code sent to your email.')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to send verification code')
    } finally {
      setSendingPhoneVerification(false)
    }
  }

  const handleVerifyPhoneCode = async () => {
    if (!phoneVerificationCode.trim()) {
      toast.error('Enter the verification code.')
      return
    }
    setVerifyingPhoneCode(true)
    try {
      await api.verifyPhone(phoneVerificationCode.trim(), prefs.phone.trim())
      setPhoneVerified(true)
      setPhoneVerificationSent(false)
      setPhoneVerificationCode('')
      toast.success('Phone verified successfully.')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to verify phone')
    } finally {
      setVerifyingPhoneCode(false)
    }
  }

  const reloadPasskeys = async () => {
    setPasskeyError(null)
    setPasskeysLoading(true)
    try {
      const keys = await listPasskeys()
      setPasskeys(keys)
    } catch (err) {
      setPasskeyError((err as any)?.error || (err as Error).message || 'Unable to load passkeys')
    } finally {
      setPasskeysLoading(false)
    }
  }

  const handleRegisterPasskey = async () => {
    const deviceName = window.prompt('Enter a name for this passkey/device', 'My device')?.trim()
    if (!deviceName) return
    setRegisteringPasskey(true)
    try {
      await registerPasskey(deviceName)
      toast.success('Passkey registered successfully')
      await reloadPasskeys()
    } catch (err) {
      toast.error((err as any)?.error || (err as Error).message || 'Passkey registration failed')
    } finally {
      setRegisteringPasskey(false)
    }
  }

  const handleRemovePasskey = async (id: string) => {
    if (!confirm('Remove this passkey? You will no longer be able to sign in with it.')) return
    setPasskeyError(null)
    try {
      await deletePasskey(id)
      toast.success('Passkey removed')
      setPasskeys((current) => current.filter((pk) => pk.id !== id))
    } catch (err) {
      toast.error((err as any)?.error || (err as Error).message || 'Failed to remove passkey')
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { toast.error('Fill in both fields'); return }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setChangingPassword(true)
    try {
      const res = await api.changePassword(currentPassword, newPassword)
      setTokenWithTimestamp(res.token)
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSaveFeeRate = async () => {
    setSavingFee(true)
    try {
      await adminApi.setWithdrawalFeeConfig({ ratePct: withdrawalFeeRate })
      toast.success(`Withdrawal fee updated to ${withdrawalFeeRate}%`)
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed to save')
    } finally {
      setSavingFee(false)
    }
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-32 pb-16 px-6">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mx-auto mb-6">
              <Key className="w-8 h-8 text-[#0C8B44]" />
            </div>
            <h1 className="text-3xl font-light text-[#E5E5E5] mb-3">Sign in required</h1>
            <p className="text-[#A0A0A0] mb-8">You need an account to access settings.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sections: Array<{ key: Section; label: string; icon: typeof User }> = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'trading', label: 'Trading', icon: TrendingUp },
    { key: 'connections', label: 'Connections', icon: Plug },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'preferences', label: 'Preferences', icon: Palette },
    { key: 'privacy', label: 'Privacy', icon: Lock },
    ...(isAdmin ? [{ key: 'admin' as Section, label: 'Admin Settings', icon: SettingsIcon }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1080px] mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Settings</h1>
            <p className="text-sm text-[#737373] mt-1">Manage your account, security and preferences</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            <nav className="glass-card p-3 h-fit">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                    section === s.key
                      ? 'bg-[#0C8B44]/15 text-[#0C8B44]'
                      : 'text-[#A0A0A0] hover:text-[#E5E5E5] hover:bg-[#ffffff05]'
                  }`}
                >
                  <s.icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{s.label}</span>
                  {section === s.key && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ))}
              <div className="border-t border-[#ffffff08] my-3" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[#A0A0A0] hover:text-[#f44336] hover:bg-[#f44336]/10 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </nav>

            <div className="glass-card p-8">
              {section === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Profile</h2>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-[#1a1a1a] overflow-hidden flex items-center justify-center">
                        {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-[#737373]" />}
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0C8B44] flex items-center justify-center">
                        <Camera className="w-3 h-3 text-white" />
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarPick(e.target.files?.[0])} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E5E5E5]">{prefs.name}</p>
                      <p className="text-xs text-[#737373]">{prefs.email}</p>
                      {avatar && <button onClick={handleAvatarRemove} className="text-xs text-red-400 hover:text-red-300 mt-1">Remove photo</button>}
                    </div>
                  </div>
                  <Field label="Display name">
                    <input type="text" value={prefs.name} onChange={(e) => update('name', e.target.value)}
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                  </Field>
                  <Field label="Username">
                    <input type="text" value={prefs.username} onChange={(e) => update('username', e.target.value)}
                      placeholder="@username" className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={prefs.email} onChange={(e) => update('email', e.target.value)}
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[#737373]">
                        {emailVerified
                          ? 'Email verified ✅'
                          : 'Email not verified. Send a link to confirm ownership.'}
                      </p>
                      {!emailVerified && (
                        <button
                          onClick={handleSendEmailVerification}
                          disabled={sendingEmailVerification}
                          className="inline-flex items-center justify-center rounded-lg bg-[#0C8B44] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a7539] disabled:opacity-50"
                        >
                          {sendingEmailVerification ? 'Sending…' : 'Send link'}
                        </button>
                      )}
                    </div>
                  </Field>
                  <Field label="Phone">
                    <input type="text" value={prefs.phone} onChange={(e) => update('phone', e.target.value)}
                      placeholder="+1 555 010 0000" className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                    <div className="mt-2 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-[#737373]">
                          {phoneVerified
                            ? 'Phone verified ✅'
                            : 'Phone not verified. Verify it for support and security.'}
                        </p>
                        <button
                          onClick={handleSendPhoneVerification}
                          disabled={sendingPhoneVerification || !prefs.phone.trim()}
                          className="inline-flex items-center justify-center rounded-lg bg-[#0C8B44] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a7539] disabled:opacity-50"
                        >
                          {sendingPhoneVerification ? 'Sending…' : 'Send code'}
                        </button>
                      </div>
                      {!phoneVerified && phoneVerificationSent && (
                        <div className="grid gap-2">
                          <input
                            type="text"
                            value={phoneVerificationCode}
                            onChange={(e) => setPhoneVerificationCode(e.target.value)}
                            placeholder="Enter verification code"
                            className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                          />
                          <button
                            onClick={handleVerifyPhoneCode}
                            disabled={verifyingPhoneCode || !phoneVerificationCode.trim()}
                            className="inline-flex items-center justify-center rounded-lg bg-[#0C8B44] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a7539] disabled:opacity-50"
                          >
                            {verifyingPhoneCode ? 'Verifying…' : 'Verify phone'}
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[#737373] mt-2">Update your phone number for notifications and support.</p>
                  </Field>
                </div>
              )}

              {section === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Security</h2>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">Change Password</h3>
                    <Field label="Current password">
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                    </Field>
                    <Field label="New password">
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                    </Field>
                    <button onClick={handleChangePassword} disabled={changingPassword}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
                      <Save className="w-4 h-4" />{changingPassword ? 'Saving…' : 'Update password'}
                    </button>
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">Sessions</h3>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-[#737373]">Manage active logins across your devices.</p>
                      <button onClick={handleRevokeAllSessions} className="px-3 py-2 text-xs text-[#FF6B6B] bg-[#ff6b6b14] rounded-lg hover:bg-[#ff6b6b20]">Revoke all</button>
                    </div>
                    <div className="space-y-3">
                      {sessions.length === 0 ? (
                        <p className="text-xs text-[#737373]">No active sessions.</p>
                      ) : sessions.map((session) => (
                        <div key={session.id} className="rounded-2xl bg-[#0a0e10] border border-[#ffffff10] p-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-[#E5E5E5]">{session.device || 'Unknown device'}</p>
                            <p className="text-[11px] text-[#737373]">{session.ipAddress || 'Unknown IP'} • {session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleString() : 'Recently active'}</p>
                          </div>
                          <button onClick={() => handleRevokeSession(session.id)} className="px-3 py-2 text-xs text-[#FF6B6B] bg-[#ff6b6b14] rounded-lg hover:bg-[#ff6b6b20]">Revoke</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">Login history</h3>
                    <div className="space-y-3">
                      {loginHistory.length === 0 ? (
                        <p className="text-xs text-[#737373]">No recent sign-ins recorded.</p>
                      ) : loginHistory.slice(0, 6).map((event) => (
                        <div key={event.id} className="rounded-2xl bg-[#0a0e10] border border-[#ffffff10] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-[#E5E5E5]">{event.location || 'Unknown location'}</p>
                            <span className={`rounded-full px-2 py-1 text-[10px] ${event.success === false ? 'bg-red-500/10 text-red-300' : 'bg-[#0C8B44]/10 text-[#0C8B44]'}`}>
                              {event.success === false ? 'Failed' : 'Success'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#737373]">{event.ipAddress || 'Unknown IP'} • {new Date(event.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">IP restrictions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
                      <input value={newIpAddress} onChange={(e) => setNewIpAddress(e.target.value)} placeholder="192.168.1.10" className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                      <select value={newIpType} onChange={(e) => setNewIpType(e.target.value as 'whitelist' | 'blacklist')} className="bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-3 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                        <option value="whitelist">Whitelist</option>
                        <option value="blacklist">Blacklist</option>
                      </select>
                      <button onClick={handleAddIpRestriction} className="px-4 py-3 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]">Add</button>
                    </div>
                    <div className="space-y-3">
                      {ipRestrictions.length === 0 ? (
                        <p className="text-xs text-[#737373]">No IP restrictions configured.</p>
                      ) : ipRestrictions.map((item) => (
                        <div key={item.id} className="rounded-2xl bg-[#0a0e10] border border-[#ffffff10] p-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-[#E5E5E5]">{item.ipAddress}</p>
                            <p className="text-[11px] text-[#737373]">{item.type} • {item.description || 'User-managed restriction'}</p>
                          </div>
                          <button onClick={() => handleDeleteIpRestriction(item.id)} className="px-3 py-2 text-xs text-[#FF6B6B] bg-[#ff6b6b14] rounded-lg hover:bg-[#ff6b6b20]">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6">
                    <h3 className="text-sm font-medium text-[#A0A0A0] mb-4">Passkeys</h3>
                    <p className="text-xs text-[#737373] mb-3">Use biometrics or a security key to sign in without a password.</p>
                    <div className="space-y-3">
                      {passkeyError && <p className="text-xs text-red-400">{passkeyError}</p>}
                      <button
                        type="button"
                        onClick={handleRegisterPasskey}
                        disabled={registeringPasskey || passkeysLoading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        {registeringPasskey ? 'Registering passkey…' : 'Register new passkey'}
                      </button>
                      {passkeysLoading ? (
                        <p className="text-xs text-[#737373]">Loading passkeys…</p>
                      ) : passkeys.length === 0 ? (
                        <p className="text-xs text-[#737373]">No passkeys registered yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {passkeys.map((pk) => (
                            <div key={pk.id} className="rounded-2xl bg-[#0a0e10] border border-[#ffffff10] p-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-[#E5E5E5]">{pk.deviceName}</p>
                                <p className="text-[11px] text-[#737373]">Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePasskey(pk.id)}
                                className="px-3 py-2 text-xs text-[#FF6B6B] bg-[#ff6b6b14] rounded-lg hover:bg-[#ff6b6b20] transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[#FF9800]">Passkeys require HTTPS or a production domain to work reliably.</p>
                    </div>
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">2FA recovery codes</h3>
                    <button onClick={handleGenerateRecoveryCodes} className="px-4 py-2.5 bg-[#0a0e10] border border-[#ffffff10] text-[#E5E5E5] text-sm rounded-lg hover:border-[#0C8B44]/30">Generate recovery codes</button>
                    {recoveryCodes.length > 0 && (
                      <div className="rounded-2xl bg-[#0a0e10] border border-[#ffffff10] p-4">
                        <div className="grid grid-cols-2 gap-2">
                          {recoveryCodes.map((code) => (
                            <div key={code} className="rounded-lg border border-[#ffffff10] bg-[#070C0E] px-3 py-2 text-center text-xs font-medium tracking-[0.2em] text-[#E5E5E5]">{code}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Toggle icon={<Shield className="w-5 h-5 text-[#0C8B44]" />} title="Two-factor authentication"
                    description="Require a verification code on every login."
                    enabled={prefs.twoFactorEnabled} onChange={(v) => update('twoFactorEnabled', v)} />
                </div>
              )}

              {section === 'trading' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Trading</h2>
                  <Toggle icon={<TrendingUp className="w-5 h-5 text-[#0C8B44]" />} title="Require trade confirmation"
                    description="Show a confirmation dialog before executing trades."
                    enabled={prefs.requireTradeConfirmation} onChange={(v) => update('requireTradeConfirmation', v)} />
                  <Field label="Default order type">
                    <div className="grid grid-cols-3 gap-2">
                      {(['market', 'limit', 'stop'] as const).map((t) => (
                        <button key={t} onClick={() => update('defaultOrderType', t)}
                          className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                            prefs.defaultOrderType === t ? 'bg-[#0C8B44] text-white' : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}>{t}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Slippage tolerance (%)">
                    <input type="number" step="0.1" min="0" max="50" value={prefs.slippageTolerance}
                      onChange={(e) => update('slippageTolerance', parseFloat(e.target.value))}
                      className="w-36 bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                  </Field>
                </div>
              )}

              {section === 'connections' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Connections</h2>
                  <p className="text-sm text-[#737373]">Manage linked wallets and external integrations.</p>
                  <a href="/linked-wallets" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0a0e10] border border-[#ffffff10] rounded-lg text-sm text-[#A0A0A0] hover:text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors">
                    <Plug className="w-4 h-4" /> Manage linked wallets
                  </a>
                </div>
              )}

              {section === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Notifications</h2>
                  <Toggle icon={<Bell className="w-5 h-5 text-[#0C8B44]" />} title="Price alerts"
                    description="Get notified when your price alerts trigger."
                    enabled={prefs.priceAlertsEnabled} onChange={(v) => update('priceAlertsEnabled', v)} />
                  <a href="/settings/notifications" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0a0e10] border border-[#ffffff10] rounded-lg text-sm text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors">
                    <Bell className="w-4 h-4" /> Advanced notification settings
                  </a>
                </div>
              )}

              {section === 'privacy' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Privacy</h2>
                  <Toggle icon={<Lock className="w-5 h-5 text-[#0C8B44]" />} title="Hide balances"
                    description="Blur balance amounts across the app."
                    enabled={prefs.hideBalances} onChange={(v) => update('hideBalances', v)} />
                  <Toggle icon={<Lock className="w-5 h-5 text-[#737373]" />} title="Blur on focus loss"
                    description="Blur the page when you switch to another tab or app."
                    enabled={prefs.blurOnFocusLoss} onChange={(v) => update('blurOnFocusLoss', v)} />
                  <Toggle icon={<Lock className="w-5 h-5 text-[#737373]" />} title="Analytics opt-out"
                    description="Disable anonymous usage analytics."
                    enabled={prefs.analyticsOptOut} onChange={(v) => update('analyticsOptOut', v)} />

                  <div className="border-t border-[#ffffff08] pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">Cookie preferences</h3>
                    <div className="space-y-3">
                      {Object.entries(cookiePrefs).map(([key, value]) => (
                        <label key={key} className="flex items-center justify-between rounded-xl border border-[#ffffff08] bg-[#0a0e10] px-4 py-3 text-sm text-[#E5E5E5]">
                          <span className="capitalize">{key}</span>
                          <input type="checkbox" checked={Boolean(value)} onChange={(e) => setCookiePrefs((prev) => ({ ...prev, [key]: e.target.checked }))} className="h-4 w-4 accent-[#0C8B44]" />
                        </label>
                      ))}
                    </div>
                    <button onClick={handleSaveCookiePrefs} className="px-4 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]">Save cookie settings</button>
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#A0A0A0]">Data export</h3>
                    <div className="flex gap-3">
                      <button onClick={() => handleRequestDataExport('json')} className="px-4 py-2.5 bg-[#0a0e10] border border-[#ffffff10] text-[#E5E5E5] text-sm rounded-lg hover:border-[#0C8B44]/30">Request JSON export</button>
                      <button onClick={() => handleRequestDataExport('csv')} className="px-4 py-2.5 bg-[#0a0e10] border border-[#ffffff10] text-[#E5E5E5] text-sm rounded-lg hover:border-[#0C8B44]/30">Request CSV export</button>
                    </div>
                    {dataExports.length > 0 && (
                      <div className="space-y-3">
                        {dataExports.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-2xl bg-[#0a0e10] border border-[#ffffff10] p-4 text-sm text-[#E5E5E5]">
                            <div className="flex items-center justify-between gap-3">
                              <span>{item.format?.toUpperCase() || 'DATA'}</span>
                              <span className="text-[11px] text-[#737373]">{item.status || 'Requested'}</span>
                            </div>
                            <p className="mt-2 text-[11px] text-[#737373]">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#ffffff08] pt-6">
                    <button onClick={handleDeleteAccount} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors">
                      Delete account
                    </button>
                  </div>
                </div>
              )}

              {section === 'admin' && isAdmin && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Admin Settings</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-[#0a0e10] border border-[#ffffff08] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-[#E5E5E5]">Withdrawal processing fee</h3>
                        <span className="rounded-full bg-[#0C8B44]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#0C8B44]">Optional</span>
                      </div>
                      <p className="text-xs text-[#737373]">Flat-rate fee charged on every withdrawal. Changes take effect immediately.</p>
                      <Field label="Fee rate (%)">
                        <div className="flex items-center gap-3">
                          <input type="number" step="0.1" min="0" max="100" value={withdrawalFeeRate}
                            onChange={(e) => setWithdrawalFeeRate(parseFloat(e.target.value))}
                            className="w-32 bg-[#070C0E] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                          <span className="text-sm text-[#737373]">%</span>
                        </div>
                      </Field>
                      <button onClick={handleSaveFeeRate} disabled={savingFee}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
                        <Save className="w-4 h-4" />{savingFee ? 'Saving…' : 'Save fee rate'}
                      </button>
                    </div>

                    <div className="rounded-2xl bg-[#0a0e10] border border-[#ffffff08] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-[#E5E5E5]">Signup bonus</h3>
                        <span className="rounded-full bg-[#0C8B44]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#0C8B44]">Optional</span>
                      </div>
                      <p className="text-xs text-[#737373]">Enable a welcome credit or keep the default onboarding flow disabled.</p>
                      <Link to="/admin/signup-bonus" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">
                        <Gift className="w-4 h-4 text-[#0C8B44]" /> Manage signup bonus
                      </Link>
                    </div>

                    <div className="rounded-2xl bg-[#0a0e10] border border-[#ffffff08] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-[#E5E5E5]">Security & compliance</h3>
                        <span className="rounded-full bg-[#0C8B44]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#0C8B44]">Optional</span>
                      </div>
                      <div className="space-y-2">
                        <Link to="/admin/settings" className="block rounded-lg border border-[#ffffff08] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">Platform settings</Link>
                        <Link to="/admin/audit" className="block rounded-lg border border-[#ffffff08] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">Audit log</Link>
                        <Link to="/admin/security-events" className="block rounded-lg border border-[#ffffff08] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">Security events</Link>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0a0e10] border border-[#ffffff08] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-[#E5E5E5]">User operations</h3>
                        <span className="rounded-full bg-[#0C8B44]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#0C8B44]">Optional</span>
                      </div>
                      <div className="space-y-2">
                        <Link to="/admin/users" className="block rounded-lg border border-[#ffffff08] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">Manage users</Link>
                        <Link to="/admin/deposits" className="block rounded-lg border border-[#ffffff08] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">Deposit settings</Link>
                        <Link to="/admin/broadcast" className="block rounded-lg border border-[#ffffff08] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/30">Broadcast</Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {section === 'preferences' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Preferences</h2>

                  <Field label="Display currency" hint="Used to value your portfolio">
                    <div className="grid grid-cols-4 gap-2">
                      {(['USD', 'EUR', 'GBP', 'JPY'] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => update('currency', c)}
                          className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            prefs.currency === c
                              ? 'bg-[#0C8B44] text-white'
                              : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Theme" hint="Light theme is in preview — most surfaces remain dark.">
                    <div className="grid grid-cols-3 gap-2">
                      {(['dark', 'light', 'auto'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => update('theme', t)}
                          className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                            prefs.theme === t
                              ? 'bg-[#0C8B44] text-white'
                              : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Language">
                      <select aria-label="Language" value={prefs.language} onChange={(e) => update('language', e.target.value as Language)} className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="pt">Português</option>
                        <option value="ja">日本語</option>
                        <option value="zh">中文</option>
                      </select>
                    </Field>
                    <Field label="Date format">
                      <select aria-label="Date format" value={prefs.dateFormat} onChange={(e) => update('dateFormat', e.target.value as DateFormat)} className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Timezone" hint="Used for charts, alerts and history timestamps.">
                    <select aria-label="Timezone" value={prefs.timezone} onChange={(e) => update('timezone', e.target.value)} className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                      {commonTimezones.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </Field>

                  <Toggle
                    icon={<Palette className="w-5 h-5 text-[#0C8B44]" />}
                    title="Compact mode"
                    description="Tighten spacing and shrink controls for more on-screen data."
                    enabled={prefs.compactDensity}
                    onChange={(v) => update('compactDensity', v)}
                  />

                  <Toggle
                    icon={<Palette className="w-5 h-5 text-[#737373]" />}
                    title="Reduce motion"
                    description="Disable non-essential animations and transitions."
                    enabled={prefs.reducedMotion}
                    onChange={(v) => update('reducedMotion', v)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#737373] mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#737373] mt-2">{hint}</p>}
    </div>
  )
}

const commonTimezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Amsterdam',
  'Europe/Zurich', 'Europe/Stockholm', 'Europe/Moscow',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland',
]

function Toggle({
  icon,
  title,
  description,
  enabled,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#E5E5E5]">{title}</p>
        <p className="text-xs text-[#737373] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-[#0C8B44]' : 'bg-[#1a1a1a] border border-[#ffffff15]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform flex items-center justify-center ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        >
          {enabled && <Check className="w-3 h-3 text-[#0C8B44]" />}
        </span>
      </button>
    </div>
  )
}
