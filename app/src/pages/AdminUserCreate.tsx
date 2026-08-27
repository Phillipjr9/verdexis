import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, UserPlus } from 'lucide-react'

export default function AdminUserCreate() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [initialUsdBalance, setInitialUsdBalance] = useState('0')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim() || password.length < 8) {
      toast.error('Email, name, and password (min 8 chars) are required')
      return
    }
    setBusy(true)
    try {
      const bal = parseFloat(initialUsdBalance)
      const res = await adminApi.createUser({
        email: email.trim().toLowerCase(),
        username: username.trim() || undefined,
        name: name.trim(),
        password,
        role: 'user',
        initialUsdBalance: Number.isFinite(bal) && bal > 0 ? bal : undefined,
      })
      toast.success('User created')
      navigate(`/admin/users/${res.user.id}`)
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to create user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-xl mx-auto px-6 py-8">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-6">
          <ArrowLeft className="w-4 h-4" />Back to users
        </Link>
        <h1 className="text-2xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
          <UserPlus className="w-6 h-6 text-[#0C8B44]" />Create user
        </h1>
        <p className="text-xs text-[#737373] mb-8">Creates a standard user account. Admins must be created via Hierarchy.</p>

        <form onSubmit={onSubmit} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-4">
          <label className="block">
            <span className="text-xs text-[#A0A0A0]">Email *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#A0A0A0]">Username (optional)</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              pattern="[a-zA-Z0-9_.\\-]*"
              minLength={3}
              maxLength={40}
              className="mt-1 w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#A0A0A0]">Display name *</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1 w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#A0A0A0]">Temporary password *</span>
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
            <span className="text-[10px] text-[#737373]">Min 8 characters. Share securely with the user.</span>
          </label>
          <label className="block">
            <span className="text-xs text-[#A0A0A0]">Opening USD balance (optional)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={initialUsdBalance}
              onChange={(e) => setInitialUsdBalance(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />{busy ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </div>
    </div>
  )
}
