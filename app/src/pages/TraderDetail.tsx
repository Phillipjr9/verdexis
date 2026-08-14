import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import {
  ArrowLeft, Shield, TrendingUp, Users, Activity,
  Calendar, Award, DollarSign, BarChart3, Copy
} from 'lucide-react'
import { api, getToken } from '../lib/api'
import { toast } from 'sonner'

interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  total: number
  createdAt: string
}

interface TraderProfile {
  id: string
  userId: string
  displayName: string
  bio: string | null
  verified: boolean
  roi30d: number
  roi90d: number
  roiAllTime: number
  winRate: number
  totalTrades: number
  totalPnl: number
  totalPnlPercent: number
  activeCopiers: number
  performanceFee: number
  minCopyAmount: number
  maxCopiers: number
  allowCopying: boolean
  lastTradeAt: string | null
  createdAt: string
  user: {
    id: string
    name: string
    username: string | null
    avatar: string | null
    createdAt: string
  }
}

export default function TraderDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<TraderProfile | null>(null)
  const [recentTrades, setRecentTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [allocationUsd, setAllocationUsd] = useState(1000)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (userId) loadTrader()
  }, [userId])

  async function loadTrader() {
    setLoading(true)
    try {
      const res = await fetch(`/api/copy-trading/trader/${userId}`)
      if (!res.ok) throw new Error('Trader not found')
      const data = await res.json()
      setProfile(data.profile)
      setRecentTrades(data.recentTrades)
    } catch (err) {
      toast.error('Failed to load trader')
      navigate('/copy-trading')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!getToken()) {
      toast.error('Please sign in to copy traders')
      navigate('/')
      return
    }

    if (allocationUsd < (profile?.minCopyAmount || 100)) {
      toast.error(`Minimum copy amount is $${profile?.minCopyAmount}`)
      return
    }

    setCopying(true)
    try {
      await api.copyTrading.follow(userId!, allocationUsd)
      toast.success(`Now copying ${profile?.displayName}!`)
      setCopyModalOpen(false)
      navigate('/copy-trading/dashboard')
    } catch (err: any) {
      toast.error(err.error || 'Failed to start copying')
    } finally {
      setCopying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-32 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile) return null

  const stats = [
    { label: 'ROI (30d)', value: `${profile.roi30d >= 0 ? '+' : ''}${profile.roi30d.toFixed(1)}%`, color: profile.roi30d >= 0 ? '#0C8B44' : '#f44336', icon: TrendingUp },
    { label: 'ROI (90d)', value: `${profile.roi90d >= 0 ? '+' : ''}${profile.roi90d.toFixed(1)}%`, color: profile.roi90d >= 0 ? '#0C8B44' : '#f44336', icon: BarChart3 },
    { label: 'ROI (All Time)', value: `${profile.roiAllTime >= 0 ? '+' : ''}${profile.roiAllTime.toFixed(1)}%`, color: profile.roiAllTime >= 0 ? '#0C8B44' : '#f44336', icon: Activity },
    { label: 'Win Rate', value: `${profile.winRate.toFixed(1)}%`, color: '#E5E5E5', icon: Award },
  ]

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate('/copy-trading')}
            className="flex items-center gap-2 text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Leaderboard</span>
          </button>

          {/* Header Card */}
          <div className="glass-card p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center text-3xl font-medium text-white overflow-hidden relative flex-shrink-0">
                {profile.user.avatar ? (
                  <img
                    src={profile.user.avatar}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profile.displayName[0].toUpperCase()
                )}
                {profile.verified && (
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[#0C8B44]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-2xl font-medium text-[#E5E5E5]">
                        {profile.displayName}
                      </h1>
                      {profile.verified && (
                        <Shield className="w-5 h-5 text-[#0C8B44]" />
                      )}
                    </div>
                    {profile.user.username && (
                      <p className="text-[#737373]">@{profile.user.username}</p>
                    )}
                  </div>

                  {/* Copy Button */}
                  {profile.allowCopying && profile.activeCopiers < profile.maxCopiers && (
                    <button
                      onClick={() => setCopyModalOpen(true)}
                      className="px-4 py-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Trader
                    </button>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-[#A0A0A0] mb-3">{profile.bio}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-[#737373]">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(profile.user.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#737373]">
                    <Users className="w-4 h-4" />
                    <span>{profile.activeCopiers} / {profile.maxCopiers} copiers</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#737373]">
                    <DollarSign className="w-4 h-4" />
                    <span>Min. ${profile.minCopyAmount.toLocaleString()}</span>
                  </div>
                  {profile.performanceFee > 0 && (
                    <div className="flex items-center gap-1.5 text-[#737373]">
                      <Activity className="w-4 h-4" />
                      <span>{profile.performanceFee}% performance fee</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, i) => (
              <div key={`${stat.label}-${i}`} className="glass-card p-4">
                <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                  <stat.icon className="w-3.5 h-3.5" />
                  {stat.label}
                </div>
                <p className="text-2xl font-semibold" style={{ color: stat.color }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4">
              <p className="text-xs text-[#737373] uppercase tracking-wider mb-1">Total Trades</p>
              <p className="text-xl font-semibold text-[#E5E5E5]">
                {profile.totalTrades.toLocaleString()}
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-[#737373] uppercase tracking-wider mb-1">Total P&L</p>
              <p className={`text-xl font-semibold ${profile.totalPnl >= 0 ? 'text-[#0C8B44]' : 'text-[#f44336]'}`}>
                ${Math.abs(profile.totalPnl).toLocaleString()}
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-[#737373] uppercase tracking-wider mb-1">Last Trade</p>
              <p className="text-xl font-semibold text-[#E5E5E5]">
                {profile.lastTradeAt
                  ? new Date(profile.lastTradeAt).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-medium text-[#E5E5E5] mb-4">Recent Trades</h2>
            {recentTrades.length === 0 ? (
              <p className="text-center text-[#737373] py-8">No trades yet</p>
            ) : (
              <div className="space-y-3">
                {recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#0a0e10] border border-[#ffffff08]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.side === 'buy'
                            ? 'bg-[#0C8B44]/20 text-[#0C8B44]'
                            : 'bg-[#f44336]/20 text-[#f44336]'
                        }`}
                      >
                        {trade.side.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#E5E5E5]">{trade.symbol}</p>
                        <p className="text-xs text-[#737373]">
                          {trade.amount} @ ${trade.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#E5E5E5]">
                        ${trade.total.toLocaleString()}
                      </p>
                      <p className="text-xs text-[#737373]">
                        {new Date(trade.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copy Modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full p-6">
            <h2 className="text-xl font-medium text-[#E5E5E5] mb-4">
              Copy {profile.displayName}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-[#737373] mb-2">
                  Allocation Amount (USD)
                </label>
                <input
                  type="number"
                  min={profile.minCopyAmount}
                  step="100"
                  value={allocationUsd}
                  onChange={(e) => setAllocationUsd(Number(e.target.value))}
                  className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                />
                <p className="text-xs text-[#737373] mt-1">
                  Min: ${profile.minCopyAmount.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#0a0e10] border border-[#ffffff08] space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#737373]">Performance Fee:</span>
                  <span className="text-[#E5E5E5]">{profile.performanceFee}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373]">Copy Percentage:</span>
                  <span className="text-[#E5E5E5]">100% of trades</span>
                </div>
              </div>

              <p className="text-xs text-[#737373]">
                Your trades will be automatically copied when {profile.displayName} trades.
                You can stop copying at any time.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCopyModalOpen(false)}
                className="flex-1 px-4 py-2 border border-[#ffffff15] text-[#A0A0A0] rounded-lg hover:text-[#E5E5E5] hover:border-[#ffffff30] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopy}
                disabled={copying}
                className="flex-1 px-4 py-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50"
              >
                {copying ? 'Starting...' : 'Start Copying'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
