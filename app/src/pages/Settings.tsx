import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { getStoredUser, getToken } from '../lib/api'
import { Toaster } from 'sonner'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(getStoredUser())

  useEffect(() => {
    if (!getToken()) {
      navigate('/')
      return
    }
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
          {user ? (
            <div className="space-y-2">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>KYC Tier:</strong> {user.kycTier || 'UNVERIFIED'}</p>
              <p><strong>KYC Status:</strong> {user.kycStatus}</p>
            </div>
          ) : (
            <p>Loading user...</p>
          )}
        </div>
      </main>
      <Toaster />
    </div>
  )
}
