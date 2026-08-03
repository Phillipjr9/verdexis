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
import { applyTheme } from '../lib/themeApplier'
import { api, clearStoredAuth, getToken, setStoredUser, setToken } from '../lib/api'
import { adminApi } from '../lib/adminApi'

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
    return { ...DEFAULT_PREFS, ...stored, email: auth.email || '', username: auth.username || stored.username || '', name: auth.name || stored.name || 'User' }
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
    } catch {}
  }, [])

  const update = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    localStorage.setItem('verdexis_prefs', JSON.stringify(next))
    
    if (key === 'name' || key === 'email' || key === 'username') {
      const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
      localStorage.setItem('verdexis_auth', JSON.stringify({ ...auth, [key]: value }))
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
      else if (key === 'twoFactorEnabled') patch.twoFactor = value
      else patch.prefs = next
      
      api.patchProfile(patch)
        .then(() => {
          if (key !== 'username') toast.success('Saved')
        })
        .catch((err) => {
          if (key === 'username') toast.error((err as { error?: string }).error || 'Username unavailable')
          else toast.error('Failed to save preference')
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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { toast.error('Fill in both fields'); return }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setChangingPassword(true)
    try {
      const res = await api.changePassword(currentPassword, newPassword)
      setToken(res.token)
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
                  <Field label="Email"><p className="text-sm text-[#A0A0A0] py-3">{prefs.email}</p></Field>
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
                  <div className="border-t border-[#ffffff08] pt-6">
                    <h3 className="text-sm font-medium text-[#A0A0A0] mb-4">Passkeys</h3>
                    <p className="text-xs text-[#737373] mb-3">Use biometrics or a security key to sign in without a password.</p>
                    <button type="button" onClick={() => setSection('security')} className="text-xs text-[#0C8B44] hover:underline flex items-center gap-1">
                      <Fingerprint className="w-3.5 h-3.5" /> Manage passkeys in Security settings
                    </button>
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
                  <div className="max-w-md rounded-xl bg-[#0a0e10] border border-[#ffffff08] p-6 space-y-4">
                    <h3 className="text-sm font-medium text-[#E5E5E5]">Withdrawal Processing Fee</h3>
                    <p className="text-xs text-[#737373]">Flat-rate fee charged on every withdrawal. Changes take effect immediately.</p>
                    <Field label="Fee rate (%)">
                      <div className="flex items-center gap-3">
                        <input type="number" step="0.1" min="0" max="100" value={withdrawalFeeRate}
                          onChange={(e) => setWithdrawalFeeRate(parseFloat(e.target.value))}
                          className="w-32 bg-[#070C0E] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                        <span className="text-sm text-[#737373]">%</span>
                        <span className="text-xs text-[#A0A0A0]">e.g. $10,000 → fee = ${(10000 * (withdrawalFeeRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </Field>
                    <button onClick={handleSaveFeeRate} disabled={savingFee}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
                      <Save className="w-4 h-4" />{savingFee ? 'Saving…' : 'Save fee rate'}
                    </button>
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
