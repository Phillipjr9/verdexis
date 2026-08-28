import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { getToken, clearStoredAuth, api } from '../lib/api'
import { getProfile, updateProfile, fileToAvatarDataUrl } from '../lib/userProfile'
import { Toaster, toast } from 'sonner'
import { applyTheme } from '../lib/themeApplier'

export default function Settings() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(getProfile())
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!getToken()) {
      navigate('/')
      return
    }
    const p = getProfile()
    setProfile(p)
    setName(p?.name || '')
    setEmail(p?.email || '')
    setLoading(false)

    // Load live profile from API when available
    api.me()
      .then((res) => {
        const u = res.user
        if (u) {
          setName(u.name || '')
          setEmail(u.email || '')
          setProfile({
            email: u.email,
            name: u.name,
            avatar: u.avatar,
            kycStatus: u.kycStatus,
            kycTier: u.kycTier,
          })
          updateProfile({
            email: u.email,
            name: u.name,
            avatar: u.avatar,
            kycStatus: u.kycStatus,
            kycTier: u.kycTier,
          })
        }
      })
      .catch(() => { /* keep local profile */ })
  }, [navigate])

  async function handleSave() {
    try {
      const res = await api.patchProfile({ name: name.trim() })
      if (res.user) {
        updateProfile({ name: res.user.name, email: res.user.email })
        setProfile(getProfile())
        toast.success('Profile updated')
      }
    } catch (e: any) {
      toast.error(e?.error || 'Failed to update profile')
    }
  }

  function handleSignOut() {
    clearStoredAuth()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <p className="text-muted-foreground">Loading settings...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="rounded-lg border p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <input
              className="w-full rounded border px-3 py-2 bg-background"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              className="w-full rounded border px-3 py-2 bg-background opacity-70"
              value={email}
              disabled
            />
          </div>
          {profile && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong>KYC Tier:</strong> {profile.kycTier || 'UNVERIFIED'}</p>
              <p><strong>KYC Status:</strong> {profile.kycStatus || 'none'}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm"
            >
              Save changes
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded bg-red-600 text-white text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  )
}
