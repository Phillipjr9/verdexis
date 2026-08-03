import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { Users, TrendingUp, X, ExternalLink, DollarSign } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from 'sonner'

interface Following {
  id: string
  traderId: string
  traderName: string
  traderUsername: string | null
  traderAvatar: string | null
  allocationUsd: number
  allocationPercent: number
  status: 'active' | 'paused' | 'stopped'
  totalCopied: number
  totalPnl: number
  totalPnlPercent: number
  copyCount: number
  pausedAt: string | null
  createdAt: string
}

interface Follower {
  id: string
  followerId: string
  followerName: string
  followerUsername: string | null
  followerAvatar: string | null
  allocationUsd: number
  status: string
  totalCopied: number
  copyCount: number
  createdAt: string
}

export default function CopyTradingDashboard() {
  const [following, setFollowing] = useState<Following[]>([])
  const [followers, setFollowers] = useState<Follower[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'following' | 'followers'>('following')

  async function loadData() {
    setLoading(true)
    try {
      const [followingRes, followersRes] = await Promise.all([
        api.copyTrading.getFollowing(),
        api.copyTrading.getFollowers(),
      ])
      setFollowing(followingRes.following)
      setFollowers(followersRes.followers)
    } catch (err: unknown) {
      const apiErr = err as { error?: unknown }
      const message = err instanceof Error
        ? err.message
        : typeof apiErr.error === 'string'
          ? apiErr.error
          : 'Failed to load data'
      toast.error(message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  async function handleUnfollow(traderId: string, traderName: string) {
    if (!confirm(`Stop copying ${traderName}? You can follow them again later.`)) return

    try {
      await api.copyTrading.unfollow(traderId)
      toast.success(`Stopped copying ${traderName}`)
      void loadData()
    } catch (err: unknown) {
      const apiErr = err as { error?: unknown }
      const message = err instanceof Error
        ? err.message
        : typeof apiErr.error === 'string'
          ? apiErr.error
          : 'Failed to unfollow'
      toast.error(message)
    }
  }

  const activeFollowing = following.filter((f) => f.status === 'active')
  const totalAllocated = activeFollowing.reduce((sum, f) => sum + f.allocationUsd, 0)
  const totalPnl = following.reduce((sum, f) => sum + f.totalPnl, 0)

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">
                  My Copy Trading
                </h1>
                <p className="text-sm text-[#737373] mt-1">
                  Manage traders you're copying and your followers
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                <Users className="w-3.5 h-3.5" />
                Following
              </div>
              <p className="text-2xl font-semibold text-[#E5E5E5]">
                {activeFollowing.length}
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                <DollarSign className="w-3.5 h-3.5" />
                Total Allocated
              </div>
              <p className="text-2xl font-semibold text-[#E5E5E5]">
                ${totalAllocated.toLocaleString()}
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Total P&L
              </div>
              <p
                className={`text-2xl font-semibold ${
                  totalPnl >= 0 ? 'text-[#0C8B44]' : 'text-[#f44336]'
                }`}
              >
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab('following')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'following'
                  ? 'bg-[#0C8B44] text-white'
                  : 'text-[#A0A0A0] hover:text-[#E5E5E5] hover:bg-[#ffffff05]'
              }`}
            >
              Following ({following.length})
            </button>
            <button
              onClick={() => setTab('followers')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'followers'
                  ? 'bg-[#0C8B44] text-white'
                  : 'text-[#A0A0A0] hover:text-[#E5E5E5] hover:bg-[#ffffff05]'
              }`}
            >
              Followers ({followers.length})
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'following' ? (
            <div className="space-y-3">
              {following.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Users className="w-12 h-12 text-[#737373] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[#E5E5E5] mb-2">
                    Not copying anyone yet
                  </h3>
                  <p className="text-sm text-[#737373] mb-6">
                    Browse the leaderboard to find traders to copy
                  </p>
                  <Link
                    to="/copy-trading"
                    className="inline-block px-4 py-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors"
                  >
                    Browse Traders
                  </Link>
                </div>
              ) : (
                following.map((f) => (
                  <div key={f.id} className="glass-card p-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <Link
                        to={`/copy-trading/trader/${f.traderId}`}
                        className="flex-shrink-0"
                      >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center text-xl font-medium text-white overflow-hidden">
                          {f.traderAvatar ? (
                            <img
                              src={f.traderAvatar}
                              alt={f.traderName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            f.traderName[0].toUpperCase()
                          )}
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <Link
                              to={`/copy-trading/trader/${f.traderId}`}
                              className="text-lg font-medium text-[#E5E5E5] hover:text-[#0C8B44] transition-colors"
                            >
                              {f.traderName}
                            </Link>
                            {f.traderUsername && (
                              <p className="text-sm text-[#737373]">@{f.traderUsername}</p>
                            )}
                          </div>

                          {/* Status Badge */}
                          <div
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              f.status === 'active'
                                ? 'bg-[#0C8B44]/20 text-[#0C8B44]'
                                : f.status === 'paused'
                                ? 'bg-[#FF9800]/20 text-[#FF9800]'
                                : 'bg-[#737373]/20 text-[#737373]'
                            }`}
                          >
                            {f.status.toUpperCase()}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <div>
                            <p className="text-xs text-[#737373]">Allocated</p>
                            <p className="text-sm font-medium text-[#E5E5E5]">
                              ${f.allocationUsd.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#737373]">P&L</p>
                            <p
                              className={`text-sm font-medium ${
                                f.totalPnl >= 0 ? 'text-[#0C8B44]' : 'text-[#f44336]'
                              }`}
                            >
                              {f.totalPnl >= 0 ? '+' : ''}${Math.abs(f.totalPnl).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#737373]">P&L %</p>
                            <p
                              className={`text-sm font-medium ${
                                f.totalPnlPercent >= 0 ? 'text-[#0C8B44]' : 'text-[#f44336]'
                              }`}
                            >
                              {f.totalPnlPercent >= 0 ? '+' : ''}
                              {f.totalPnlPercent.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#737373]">Trades Copied</p>
                            <p className="text-sm font-medium text-[#E5E5E5]">{f.copyCount}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link
                            to={`/copy-trading/trader/${f.traderId}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#A0A0A0] border border-[#ffffff15] rounded-lg hover:text-[#E5E5E5] hover:border-[#ffffff30] transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Trader
                          </Link>
                          {f.status === 'active' && (
                            <button
                              onClick={() => handleUnfollow(f.traderId, f.traderName)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#f44336] border border-[#f44336]/30 rounded-lg hover:bg-[#f44336]/10 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Stop Copying
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {followers.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Users className="w-12 h-12 text-[#737373] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[#E5E5E5] mb-2">No followers yet</h3>
                  <p className="text-sm text-[#737373] mb-6">
                    Enable copy trading in settings to let others copy your trades
                  </p>
                  <Link
                    to="/settings?tab=copy-trading"
                    className="inline-block px-4 py-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors"
                  >
                    Enable Copy Trading
                  </Link>
                </div>
              ) : (
                followers.map((f) => (
                  <div key={f.id} className="glass-card p-5">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center text-lg font-medium text-white overflow-hidden flex-shrink-0">
                        {f.followerAvatar ? (
                          <img
                            src={f.followerAvatar}
                            alt={f.followerName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          f.followerName[0].toUpperCase()
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <p className="text-base font-medium text-[#E5E5E5]">{f.followerName}</p>
                        {f.followerUsername && (
                          <p className="text-sm text-[#737373]">@{f.followerUsername}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex gap-6">
                        <div className="text-right">
                          <p className="text-xs text-[#737373]">Allocated</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">
                            ${f.allocationUsd.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#737373]">Trades</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">{f.copyCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#737373]">Since</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">
                            {new Date(f.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
