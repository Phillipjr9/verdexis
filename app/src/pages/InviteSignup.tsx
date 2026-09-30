import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

interface InviteData {
  email: string
  amountUsd: number
  isReferral: boolean
  expiresAt: string
  tokenId: string
}

export function InviteSignup() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link')
      setLoading(false)
      return
    }

    const validateToken = async () => {
      try {
        const response = await api.get(`/invite/${token}`)
        if (response.ok) {
          setInviteData(response)
        } else {
          setError(response.error || 'Invalid or expired invite link')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to validate invite')
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [token])

  const validatePassword = (): boolean => {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return false
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return false
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError('Password must contain uppercase letters and numbers')
      return false
    }
    setPasswordError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validatePassword()) return
    if (!token) return

    setSubmitting(true)
    try {
      const response = await api.post(`/invite/${token}/redeem`, {
        password,
        name: name.trim() || undefined,
      })

      if (response.ok) {
        // Redirect to login with success message
        navigate('/login?invited=true', { replace: true })
      } else {
        setError(response.error || 'Failed to set up account')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up account')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          <p className="mt-4 text-gray-300">Validating your invite...</p>
        </div>
      </div>
    )
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-red-400 mb-2">Invite Invalid</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-slate-800/90 rounded-xl shadow-2xl p-8 max-w-md w-full border border-slate-700">
        <h1 className="text-3xl font-bold text-center mb-2 text-green-400">Welcome to Verdexis</h1>
        <p className="text-center text-gray-400 mb-6">Complete your account setup</p>

        {/* Invite Details */}
        <div className="bg-slate-700/50 rounded-lg p-4 mb-6 border border-green-900/30">
          <p className="text-sm text-gray-400 mb-2">
            Invited email: <span className="text-white font-mono">{inviteData.email}</span>
          </p>
          {inviteData.amountUsd > 0 && (
            <p className="text-sm text-gray-400">
              Welcome bonus: <span className="text-green-400 font-bold">${inviteData.amountUsd.toFixed(2)}</span>
              {!inviteData.isReferral && <span className="text-yellow-500 text-xs ml-2">(locked)</span>}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters, uppercase, numbers"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              • At least 8 characters<br/>
              • Uppercase letters & numbers
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Password Error */}
          {passwordError && (
            <div className="bg-red-900/20 border border-red-500/50 rounded p-3 text-sm text-red-400">
              {passwordError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition duration-200 mt-6"
          >
            {submitting ? 'Setting up account...' : 'Complete Setup'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-green-400 hover:text-green-300 font-semibold"
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
