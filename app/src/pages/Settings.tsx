import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { getToken, clearStoredAuth, api } from '../lib/api'
import { getProfile, updateProfile, fileToAvatarDataUrl } from '../lib/userProfile'
import { applyTheme } from '../lib/themeApplier'
import { Toaster, toast } from 'sonner'
import {
  User, Shield, Bell, Palette, Wallet, Download, Trash2,
  LogOut, Camera, Check, KeyRound, Landmark, BadgeCheck,
} from 'lucide-react'

type ThemePref = 'dark' | 'light' | 'auto'

interface UserPrefs {
  theme: ThemePref
  reducedMotion: boolean
  compactDensity: boolean
  hideBalances: boolean
  displayCurrency: string
  language: string
}

const PREFS_KEY = 'verdexis_prefs'

const defaultPrefs: UserPrefs = {
  theme: 'dark',
  reducedMotion: false,
  compactDensity: false,
  hideBalances: false,
  displayCurrency: 'USD',
  language: 'en',
}

function readLocalPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...defaultPrefs }
    return { ...defaultPrefs, ...JSON.parse(raw) }
  } catch {
    return { ...defaultPrefs }
  }
}

function Toggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string
  description?: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#ffffff08] bg-[#070C0E]/70 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[#E5E5E5]">{label}</p>
        {description && <p className="mt-1 text-xs text-[#737373]">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-[#0C8B44]' : 'bg-[#1a1a1a]'}`}
        aria-pressed={enabled}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [kycStatus, setKycStatus] = useState('none')
  const [kycTier, setKycTier] = useState('UNVERIFIED')
  const [twoFactor, setTwoFactor] = useState(false)
  const [prefs, setPrefs] = useState<UserPrefs>(readLocalPrefs)
  const [confirmDelete, setConfirmDelete] = useState('')

  useEffect(() => {
    if (!getToken()) {
      navigate('/')
      return
    }
    const p = getProfile()
    setName(p?.name || '')
    setEmail(p?.email || '')
    setAvatar(p?.avatar || null)
    setKycStatus(p?.kycStatus || 'none')
    setKycTier(p?.kycTier || 'UNVERIFIED')

    api.me()
      .then((res) => {
        const u = res.user as {
          name?: string
          email?: string
          username?: string | null
          phone?: string | null
          avatar?: string | null
          kycStatus?: string
          kycTier?: string
          twoFactor?: boolean
          prefs?: Partial<UserPrefs>
        }
        if (!u) return
        setName(u.name || '')
        setEmail(u.email || '')
        setUsername(u.username || '')
        setPhone(u.phone || '')
        setAvatar(u.avatar || null)
        setKycStatus(u.kycStatus || 'none')
        setKycTier(u.kycTier || 'UNVERIFIED')
        setTwoFactor(!!u.twoFactor)
        if (u.prefs) {
          const next = { ...defaultPrefs, ...readLocalPrefs(), ...u.prefs }
          setPrefs(next)
          localStorage.setItem(PREFS_KEY, JSON.stringify(next))
          applyTheme(next.theme)
        }
        updateProfile({
          email: u.email,
          name: u.name,
          avatar: u.avatar,
          kycStatus: (u.kycStatus as 'none' | 'pending' | 'approved' | 'rejected') || 'none',
          kycTier: u.kycTier,
        })
      })
      .catch(() => { /* keep local */ })
      .finally(() => setLoading(false))
  }, [navigate])

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'U'
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  }, [name])

  async function persistPrefs(next: UserPrefs) {
    setPrefs(next)
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    applyTheme(next.theme)
    document.documentElement.classList.toggle('reduce-motion', next.reducedMotion)
    document.documentElement.classList.toggle('compact-ui', next.compactDensity)
    document.documentElement.classList.toggle('hide-balances', next.hideBalances)
    window.dispatchEvent(new Event('verdexis:prefs'))
    if (!getToken()) return
    try {
      await api.patchProfile({ prefs: next })
    } catch {
      toast.error('Preference saved on this device, but the server did not accept it')
    }
  }

  async function handleSaveProfile() {
    setSaving(true)
    try {
      const res = await api.patchProfile({
        name: name.trim(),
        username: username.trim().toLowerCase() || null,
        phone: phone.trim(),
        avatar,
        prefs,
        twoFactor,
      })
      if (res.user) {
        updateProfile({
          name: res.user.name,
          email: res.user.email,
          avatar: res.user.avatar,
          kycStatus: res.user.kycStatus,
          kycTier: res.user.kycTier,
        })
        toast.success('Settings saved')
      }
    } catch (e: unknown) {
      const err = e as { error?: string }
      toast.error(err?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatar(file?: File) {
    if (!file) return
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setAvatar(dataUrl)
      updateProfile({ avatar: dataUrl })
      toast.success('Photo updated — save settings to keep it')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use that image')
    }
  }

  async function handleExport() {
    try {
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `verdexis-account-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Account export downloaded')
    } catch {
      toast.error('Could not export account data')
    }
  }

  async function handleDelete() {
    if (confirmDelete.trim().toLowerCase() !== 'delete') {
      toast.error('Type DELETE to confirm account removal')
      return
    }
    try {
      await api.deleteAccount()
      clearStoredAuth()
      toast.success('Account deleted')
      navigate('/')
    } catch {
      toast.error('Could not delete account')
    }
  }

  function handleSignOut() {
    clearStoredAuth()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <main className="pt-24 pb-16 px-6">
          <p className="max-w-3xl mx-auto text-sm text-[#737373]">Loading settings…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Settings</h1>
            <p className="text-sm text-[#737373] mt-1">Account, security, appearance, and data controls</p>
          </div>

          <section className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Profile</h2>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative h-16 w-16 overflow-hidden rounded-2xl border border-[#ffffff12] bg-[#1a1a1a] shrink-0"
                aria-label="Change profile photo"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-medium text-[#E5E5E5]">{initials}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/50 py-0.5">
                  <Camera className="w-3 h-3 text-white" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { void handleAvatar(e.target.files?.[0]); e.currentTarget.value = '' }}
              />
              <div>
                <p className="text-sm text-[#E5E5E5]">{name || 'Your name'}</p>
                <p className="text-xs text-[#737373]">{email}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-[#A0A0A0] mb-1.5 block">Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-[#ffffff08] bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
              </label>
              <label className="block">
                <span className="text-xs text-[#A0A0A0] mb-1.5 block">Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="optional" className="w-full rounded-xl border border-[#ffffff08] bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
              </label>
              <label className="block">
                <span className="text-xs text-[#A0A0A0] mb-1.5 block">Email</span>
                <input value={email} disabled className="w-full rounded-xl border border-[#ffffff08] bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#737373]" />
              </label>
              <label className="block">
                <span className="text-xs text-[#A0A0A0] mb-1.5 block">Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" className="w-full rounded-xl border border-[#ffffff08] bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Verification</h2>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[#E5E5E5]">KYC tier: {kycTier || 'UNVERIFIED'}</p>
                <p className="text-xs text-[#737373] capitalize">Status: {kycStatus || 'none'}</p>
              </div>
              <Link to="/kyc" className="rounded-lg bg-[#0C8B44] px-4 py-2 text-xs font-medium text-white hover:bg-[#0a7539]">
                Manage verification
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Appearance</h2>
            </div>
            <div>
              <p className="text-xs text-[#A0A0A0] mb-2">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {(['dark', 'light', 'auto'] as ThemePref[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => void persistPrefs({ ...prefs, theme: t })}
                    className={`rounded-xl border px-3 py-2.5 text-sm capitalize ${prefs.theme === t ? 'border-[#0C8B44] bg-[#0C8B44]/10 text-[#E5E5E5]' : 'border-[#ffffff08] bg-[#1a1a1a]/50 text-[#A0A0A0]'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-[#A0A0A0] mb-1.5 block">Display currency</span>
                <select
                  value={prefs.displayCurrency}
                  onChange={(e) => void persistPrefs({ ...prefs, displayCurrency: e.target.value })}
                  className="w-full rounded-xl border border-[#ffffff08] bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                >
                  {['USD', 'EUR', 'GBP', 'BTC', 'ETH'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-[#A0A0A0] mb-1.5 block">Language</span>
                <select
                  value={prefs.language}
                  onChange={(e) => void persistPrefs({ ...prefs, language: e.target.value })}
                  className="w-full rounded-xl border border-[#ffffff08] bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </label>
            </div>
            <Toggle label="Hide balances" description="Mask amounts until you reveal them" enabled={prefs.hideBalances} onChange={(v) => void persistPrefs({ ...prefs, hideBalances: v })} />
            <Toggle label="Compact density" description="Tighter spacing on dashboard cards" enabled={prefs.compactDensity} onChange={(v) => void persistPrefs({ ...prefs, compactDensity: v })} />
            <Toggle label="Reduce motion" description="Limit animations and transitions" enabled={prefs.reducedMotion} onChange={(v) => void persistPrefs({ ...prefs, reducedMotion: v })} />
          </section>

          <section className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Security</h2>
            </div>
            <Toggle
              label="Two-factor authentication"
              description="Require a verification code at sign-in"
              enabled={twoFactor}
              onChange={(v) => setTwoFactor(v)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link to="/reset-password" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ffffff10] px-4 py-2.5 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40">
                <KeyRound className="w-4 h-4" /> Change password
              </Link>
              <Link to="/limits" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ffffff10] px-4 py-2.5 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40">
                Account limits
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-lg font-medium text-[#E5E5E5]">Notifications & connections</h2>
            </div>
            <Link to="/notification-settings" className="flex items-center justify-between rounded-xl border border-[#ffffff08] px-4 py-3 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40">
              Notification preferences <span className="text-xs text-[#737373]">Email, push, quiet hours</span>
            </Link>
            <Link to="/linked-wallets" className="flex items-center justify-between rounded-xl border border-[#ffffff08] px-4 py-3 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40">
              <span className="inline-flex items-center gap-2"><Wallet className="w-4 h-4 text-[#0C8B44]" /> Linked wallets</span>
              <span className="text-xs text-[#737373]">Web3 addresses</span>
            </Link>
            <Link to="/wallet?action=deposit" className="flex items-center justify-between rounded-xl border border-[#ffffff08] px-4 py-3 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40">
              <span className="inline-flex items-center gap-2"><Landmark className="w-4 h-4 text-[#0C8B44]" /> Linked banks</span>
              <span className="text-xs text-[#737373]">ACH destinations</span>
            </Link>
          </section>

          <section className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/60 p-6 space-y-4">
            <h2 className="text-lg font-medium text-[#E5E5E5]">Data & session</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void handleExport()} className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff10] px-4 py-2.5 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40">
                <Download className="w-4 h-4" /> Export my data
              </button>
              <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff10] px-4 py-2.5 text-sm text-[#E5E5E5] hover:border-[#f44336]/40">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
            <div className="rounded-xl border border-[#f44336]/20 bg-[#f44336]/5 p-4 space-y-3">
              <p className="text-sm text-[#E5E5E5] inline-flex items-center gap-2"><Trash2 className="w-4 h-4 text-[#f44336]" /> Delete account</p>
              <p className="text-xs text-[#737373]">This permanently removes your profile. Type DELETE to confirm.</p>
              <div className="flex gap-2">
                <input
                  value={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.value)}
                  placeholder="DELETE"
                  className="flex-1 rounded-xl border border-[#ffffff10] bg-[#070C0E] px-3 py-2 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#f44336]"
                />
                <button type="button" onClick={() => void handleDelete()} className="rounded-xl bg-[#f44336] px-4 py-2 text-sm text-white">
                  Delete
                </button>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0C8B44] py-3.5 text-sm font-medium text-white hover:bg-[#0a7539] disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save all settings'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
