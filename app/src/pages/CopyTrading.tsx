import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { 
  TrendingUp, Users, Award, Star, Shield, 
  ChevronRight, Filter, Search, Flame, Target 
} from 'lucide-react'
import { api } from '../lib/api'
import { toast } from 'sonner'

interface Trader {
  id: string
  userId: string
  displayName: string
  bio: string | null
  rank: number
  roi30d: number
  roi90d: number
  roiAllTime: number
  winRate: number
  totalTrades: number
  totalCopiers: number
  activeCopiers: number
  verified: boolean
  performanceFee: number
  minCopyAmount: number
  maxCopiers: number
  lastTradeAt: string | null
  user: {
    name: string
    username: string | null
    avatar: string | null
  }
}

type Period = '30d' | '90d' | 'all'

export default function CopyTrading() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadLeaderboard()
  }, [period])

  async function loadLeaderboard() {
    setLoading(true)
    try {
      const res = await fetch(`/api/copy-trading/leaderboard?period=${period}&limit=50`)
      const data = await res.json()
      setTraders(data.traders || [])
    } catch (err) {
      toast.error('Failed to load traders')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTraders = traders.filter(t => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      t.displayName.toLowerCase().includes(query) ||
      t.user.name.toLowerCase().includes(query) ||
      t.user.username?.toLowerCase().includes(query)
    )
  })

  const getRoiForPeriod = (trader: Trader) => {
    if (period === '90d') return trader.roi90d
    if (period === 'all') return trader.roiAllTime
    return trader.roi30d
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">
                  Copy Trading
                </h1>
                <p className="text-sm text-[#737373] mt-1">
                  Follow top traders and automatically copy their trades
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Period Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#737373]" />
                <div className="flex gap-1">
                  {(['30d', '90d', 'all'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        period === p
                          ? 'bg-[#0C8B44] text-white'
                          : 'text-[#A0A0A0] hover:text-[#E5E5E5] hover:bg-[#ffffff05]'
                      }`}
                    >
                      {p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : 'All Time'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type="text"
                  placeholder="Search traders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E5E5E5] placeholder-[#737373] focus:border-[#0C8B44] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                <Users className="w-3.5 h-3.5" />
                Active Traders
              </div>
              <p className="text-2xl font-semibold text-[#E5E5E5]">{traders.length}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                <Target className="w-3.5 h-3.5" />
                Total Copiers
              </div>
              <p className="text-2xl font-semibold text-[#E5E5E5]">
                {traders.reduce((sum, t) => sum + t.activeCopiers, 0).toLocaleString()}
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-[#737373] text-xs uppercase tracking-wider mb-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Avg. ROI ({period})
              </div>
              <p className="text-2xl font-semibold text-[#0C8B44]">
                {traders.length > 0
                  ? `+${(traders.reduce((sum, t) => sum + getRoiForPeriod(t), 0) / traders.length).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* Traders List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTraders.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Users className="w-12 h-12 text-[#737373] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#E5E5E5] mb-2">
                {searchQuery ? 'No traders found' : 'No traders yet'}
              </h3>
              <p className="text-sm text-[#737373]">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Be the first to enable copy trading and attract followers!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTraders.map((trader, idx) => (
                <Link
                  key={trader.id}
                  to={`/copy-trading/trader/${trader.userId}`}
                  className="block glass-card p-5 hover:border-[#0C8B44]/30 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-12 text-center">
                      {trader.rank <= 3 ? (
                        <div className="relative">
                          <Award
                            className={`w-8 h-8 mx-auto ${
                              trader.rank === 1
                                ? 'text-[#FFD700]'
                                : trader.rank === 2
                                ? 'text-[#C0C0C0]'
                                : 'text-[#CD7F32]'
                            }`}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                            {trader.rank}
                          </span>
                        </div>
                      ) : (
                        <div className="text-2xl font-light text-[#737373]">#{trader.rank}</div>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center text-xl font-medium text-white overflow-hidden relative">
                        {trader.user.avatar ? (
                          <img
                            src={trader.user.avatar}
                            alt={trader.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          trader.displayName[0].toUpperCase()
                        )}
                        {trader.verified && (
                          <Shield className="absolute bottom-0 right-0 w-4 h-4 text-[#0C8B44] bg-white rounded-full p-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-[#E5E5E5] truncate group-hover:text-[#0C8B44] transition-colors">
                              {trader.displayName}
                            </h3>
                            {trader.verified && (
                              <Shield className="w-4 h-4 text-[#0C8B44] flex-shrink-0" />
                            )}
                          </div>
                          {trader.user.username && (
                            <p className="text-sm text-[#737373]">@{trader.user.username}</p>
                          )}
                        </div>

                        {/* ROI Badge */}
                        <div
                          className={`px-3 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${
                            getRoiForPeriod(trader) >= 0
                              ? 'bg-[#0C8B44]/20 text-[#0C8B44]'
                              : 'bg-[#f44336]/20 text-[#f44336]'
                          }`}
                        >
                          {getRoiForPeriod(trader) >= 0 ? '+' : ''}
                          {getRoiForPeriod(trader).toFixed(1)}%
                        </div>
                      </div>

                      {trader.bio && (
                        <p className="text-sm text-[#A0A0A0] mb-3 line-clamp-2">{trader.bio}</p>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-[#737373]">Win Rate</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">
                            {trader.winRate.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#737373]">Trades</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">
                            {trader.totalTrades.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#737373]">Copiers</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">
                            {trader.activeCopiers}/{trader.maxCopiers}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#737373]">Min. Copy</p>
                          <p className="text-sm font-medium text-[#E5E5E5]">
                            ${trader.minCopyAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-[#737373] group-hover:text-[#0C8B44] flex-shrink-0 self-center transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* CTA for becoming a trader */}
          <div className="mt-8 glass-card p-6 border-[#0C8B44]/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-[#0C8B44]" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-[#E5E5E5] mb-1">
                    Become a Copy Trader
                  </h3>
                  <p className="text-sm text-[#737373]">
                    Build your reputation, attract followers, and earn performance fees
                  </p>
                </div>
              </div>
              <Link
                to="/settings?tab=copy-trading"
                className="px-4 py-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition-colors whitespace-nowrap"
              >
                Enable Copy Trading
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
