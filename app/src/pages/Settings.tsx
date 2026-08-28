import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { getToken, clearStoredAuth } from '../lib/api'
import { getProfile } from '../lib/userProfile'
import { Toaster } from 'sonner'

export default function Settings() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(getProfile())

  useEffect(() => {
    if (!getToken()) {
      navigate('/')
      return
    }
    setProfile(getProfile())
  }, [navigate])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="rounded-lg border p-6 space-y-4">
          <p className="text-muted-foreground">
            Full Settings page is being restored. Basic profile info:
          </p>
          {profile ? (
            <div className="space-y-2">
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Name:</strong> {profile.name}</p>
              <p><strong>KYC Tier:</strong> {profile.kycTier || 'UNVERIFIED'}</p>
              <p><strong>KYC Status:</strong> {profile.kycStatus || 'none'}</p>
            </div>
          ) : (
            <p>Loading profile...</p>
          )}
          <button
            onClick={() => { clearStoredAuth(); navigate('/') }}
            className="mt-4 px-4 py-2 rounded bg-red-600 text-white text-sm"
          >
            Sign out
          </button>
        </div>
      </main>
      <Toaster />
    </div>
  )
}
