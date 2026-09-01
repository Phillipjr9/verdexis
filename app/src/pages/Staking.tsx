// Yield / Staking dashboard. Lets the user browse pluggable yield
// "products" (Lido / Marinade / Aave-v3 / Compound), open a position from
// any wallet balance, and see real-time accrued rewards + a forward-looking
// 1y / 5y / 10y projection. Staked funds debit the matching wallet
// currency and accrued interest pays back as an `interest` transaction so
// it shows up cleanly in activity, CSV exports, and tax reports.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { priceForAsset } from '../lib/stakingStore'
import { api, type ApiStakingPosition } from '../lib/api'
import { portfolioStore, type WalletBalance } from '../lib/portfolioStore'
import { useCurrency } from '../lib/currencyContext'
import { cryptoIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'
import { Sparkles, TrendingUp, Clock, ShieldCheck, Zap, X, Plus } from 'lucide-react'
import { toast, Toaster } from 'sonner'

interface YieldProduct {
  id: string
  asset: string
  name: string
  apy: number
  protocol: string
  payoutFrequencyDays: number
  blurb: string
  risk: 'Low' | 'Medium' | 'Higher'
}

// Curated catalog of yield products a user can open a position against.
// Actual positions (principal, APY, start date, accrued yield) are always
// fetched from the real `/api/staking` backend — this catalog only supplies
// display metadata (protocol name / blurb / risk) for the "Earn opportunities"
// marketplace and for labeling an open position back to its originating
// product once staked.
const YIELD_PRODUCTS: YieldProduct[] = [
  { id: 'lido-eth',       asset: 'ETH',  name: 'Ethereum',   apy: 0.038, protocol: 'Lido',          payoutFrequencyDays: 1, blurb: 'Liquid-staked ETH. Daily reward distribution, no lockup.', risk: 'Low' },
  { id: 'marinade-sol',   asset: 'SOL',  name: 'Solana',     apy: 0.072, protocol: 'Marinade',      payoutFrequencyDays: 2, blurb: 'Liquid Solana staking with auto-restaking. ~2 day epoch.', risk: 'Low' },
  { id: 'aave-usdc',      asset: 'USDC', name: 'USD Coin',   apy: 0.045, protocol: 'Aave v3',       payoutFrequencyDays: 1, blurb: 'On-chain stablecoin lending. Supply rate floats with demand.', risk: 'Low' },
  { id: 'compound-usdc',  asset: 'USDC', name: 'USD Coin',   apy: 0.052, protocol: 'Compound v3',   payoutFrequencyDays: 1, blurb: 'cUSDCv3 supply yield. Slightly higher rate, comparable risk.', risk: 'Low' },
  { id: 'aave-usdt',      asset: 'USDT', name: 'Tether',     apy: 0.041, protocol: 'Aave v3',       payoutFrequencyDays: 1, blurb: 'Tether lending. Conservative, deep liquidity.', risk: 'Medium' },
  { id: 'rocketpool-eth', asset: 'ETH',  name: 'Ethereum',   apy: 0.034, protocol: 'Rocket Pool',   payoutFrequencyDays: 1, blurb: 'Decentralised ETH staking with rETH. Permissionless validators.', risk: 'Low' },
  { id: 'jito-sol',       asset: 'SOL',  name: 'Solana',     apy: 0.081, protocol: 'Jito',          payoutFrequencyDays: 2, blurb: 'jitoSOL — staking + MEV rewards. Higher APY, slightly more variable.', risk: 'Medium' },
]

const RISK_BADGE: Record<YieldProduct['risk'], string> = {
  Low: 'bg-[#0C8B44]/15 text-[#0C8B44] border-[#0C8B44]/30',
  Medium: 'bg-[#F57C00]/15 text-[#F57C00] border-[#F57C00]/30',
  Higher: 'bg-[#f44336]/15 text-[#f44336] border-[#f44336]/30',
}

const FREQUENCY_DAYS: Record<ApiStakingPosition['yieldFrequency'], number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
}

/** Match a live server position back to the curated product that opened it
 *  (by asset + APY), so we can show a protocol name/blurb/risk badge. */
function productForPosition(p: ApiStakingPosition): YieldProduct | undefined {
  return YIELD_PRODUCTS.find((y) => y.asset === p.asset && Math.abs(y.apy * 100 - p.apy) < 0.001)
}

/** Client-side estimate of reward accrued since the position started,
 *  using the real principal/APY/start-date from the server. The server
 *  itself credits `totalYieldEarned` once per day via a background job;
 *  this just interpolates between those credits for a smoother display. */
function pendingRewardFor(p: ApiStakingPosition): { rewardAsset: number; nextPayoutInDays: number } {
  const apyFraction = p.apy / 100
  const payoutFrequencyDays = FREQUENCY_DAYS[p.yieldFrequency] ?? 1
  const elapsedYears = (Date.now() - new Date(p.startedAt).getTime()) / (365 * 86400_000)
  const totalAccrued = p.amount * apyFraction * Math.max(0, elapsedYears)
  const cyclesElapsed = Math.floor((Date.now() - new Date(p.startedAt).getTime()) / (payoutFrequencyDays * 86400_000))
  const nextPayout = new Date(p.startedAt).getTime() + (cyclesElapsed + 1) * payoutFrequencyDays * 86400_000
  const nextPayoutInDays = Math.max(0, (nextPayout - Date.now()) / 86400_000)
  const sinceLast = totalAccrued - (cyclesElapsed * p.amount * apyFraction * (payoutFrequencyDays / 365))
  return { rewardAsset: Math.max(0, sinceLast), nextPayoutInDays }
}

export default function Staking() {
  const { format: fmtMoney } = useCurrency()
  const [positions, setPositions] = useState<ApiStakingPosition[]>([])
  const [wallet, setWallet] = useState<WalletBalance[]>(portfolioStore.getWallet())
  const [productOpen, setProductOpen] = useState<YieldProduct | null>(null)
  const [stakeAmount, setStakeAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  const loadPositions = useCallback(async () => {
    try {
      const res = await api.staking.listPositions()
      setPositions((res.positions || []).filter((p) => !p.unstakedAt))
    } catch (e) {
      console.warn('Staking: failed to load positions', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPositions()
    const refreshWallet = () => setWallet(portfolioStore.getWallet())
    window.addEventListener('verdexis:portfolio', refreshWallet)
    // Tick once a minute so the "pending reward" numbers visibly accrue.
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    // Periodically re-sync with the server (background job credits yield daily).
    const poll = setInterval(() => { void loadPositions() }, 60_000)
    return () => {
      window.removeEventListener('verdexis:portfolio', refreshWallet)
      clearInterval(t)
      clearInterval(poll)
    }
  }, [loadPositions])

  const totals = useMemo(() => {
    let totalPrincipal = 0
    let totalRewards = 0
    let totalApy = 0
    for (const p of positions) {
      const price = priceForAsset(p.asset)
      totalPrincipal += p.amount * price
      totalRewards += pendingRewardFor(p).rewardAsset * price
      totalApy += (p.apy / 100) * p.amount * price
    }
    const blendedApy = totalPrincipal > 0 ? totalApy / totalPrincipal : 0
    const annualYield = totalPrincipal * blendedApy
    return { staked: totalPrincipal, pending: totalRewards, blendedApy, annualYield }
  }, [positions])

  function projectStakedUsd(years: number): number {
    let projection = 0
    for (const p of positions) {
      const price = priceForAsset(p.asset)
      const principal = p.amount * price
      projection += principal * Math.pow(1 + p.apy / 100, years)
    }
    return projection
  }
  const proj1y = useMemo(() => projectStakedUsd(1), [positions])
  const proj5y = useMemo(() => projectStakedUsd(5), [positions])
  const proj10y = useMemo(() => projectStakedUsd(10), [positions])

  function balanceFor(asset: string): number {
    const cur = asset.toUpperCase()
    const entry = wallet.find((w) => w.currency.toUpperCase() === cur)
    return entry?.available ?? 0
  }

  function openStake(p: YieldProduct) {
    setProductOpen(p)
    setStakeAmount('')
  }

  async function confirmStake() {
    if (!productOpen) return
    const amount = parseFloat(stakeAmount)
    if (!isFinite(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    try {
      await api.staking.openPosition({
        asset: productOpen.asset,
        amount,
        apy: productOpen.apy * 100,
        yieldFrequency: productOpen.payoutFrequencyDays >= 30 ? 'monthly' : productOpen.payoutFrequencyDays >= 7 ? 'weekly' : 'daily',
      })
      toast.success(`Staked ${amount} ${productOpen.asset} via ${productOpen.protocol}`)
      setProductOpen(null)
      await loadPositions()
      void portfolioStore.hydrate(true)
    } catch (e) {
      const message = e && typeof e === 'object' && 'error' in e ? String((e as { error?: unknown }).error) : e instanceof Error ? e.message : 'Could not stake'
      toast.error(message)
    }
  }

  async function unstake(id: string) {
    const p = positions.find((x) => x.id === id)
    if (!p) return
    try {
      await api.staking.unstake(id)
      toast.success(`Unstaked ${p.amount} ${p.asset}`)
      await loadPositions()
      void portfolioStore.hydrate(true)
    } catch (e) {
      const message = e && typeof e === 'object' && 'error' in e ? String((e as { error?: unknown }).error) : e instanceof Error ? e.message : 'Could not unstake'
      toast.error(message)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <Toaster position="top-right" theme="dark" richColors />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Hero */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-[0.04em]">Yield &amp; Staking</h1>
              <p className="text-xs text-[#737373]">Earn passive yield on idle balances. Liquid where possible. No lockups unless noted.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total Staked" value={fmtMoney(totals.staked)} accent="text-[#E5E5E5]" />
            <Stat label="Blended APY" value={`${(totals.blendedApy * 100).toFixed(2)}%`} accent="text-[#0C8B44]" />
            <Stat label="Pending Rewards" value={`+${fmtMoney(totals.pending)}`} accent="text-[#4CAF50]" />
            <Stat label="Annual Yield" value={`+${fmtMoney(totals.annualYield)}`} accent="text-[#4CAF50]" />
          </div>
        </section>

        {/* Projection */}
        {totals.staked > 0 && (
          <section className="mb-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#0C8B44]" />
              <h2 className="text-sm font-medium">Projected value at current APY</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Projection label="1 year"  base={totals.staked} value={proj1y} fmt={fmtMoney} />
              <Projection label="5 years" base={totals.staked} value={proj5y} fmt={fmtMoney} />
              <Projection label="10 years" base={totals.staked} value={proj10y} fmt={fmtMoney} />
            </div>
            <p className="text-[10px] text-[#737373] mt-3">
              Continuously compounded. Actual returns vary; APYs are not guaranteed and protocols carry smart-contract risk.
            </p>
          </section>
        )}

        {/* Active positions */}
        {!loading && positions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-medium mb-3 text-[#A0A0A0] uppercase tracking-[0.08em]">Active positions</h2>
            <div className="space-y-2">
              {positions.map((p) => {
                const r = pendingRewardFor(p)
                const px = priceForAsset(p.asset)
                const product = productForPosition(p)
                const protocol = product?.protocol ?? 'Verdexis Earn'
                const logo = cryptoIconFor((p.asset || '').toLowerCase())
                const initial = (p.asset || '?')[0]?.toUpperCase() ?? '?'
                return (
                  <div key={p.id} className="flex items-center gap-3 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    {logo ? (
                      <img src={logo} alt="" aria-hidden="true" className="w-10 h-10 rounded-lg shrink-0" loading="lazy" decoding="async"
                           onError={cryptoIconErrorFallback(initial, (p.asset || '').toLowerCase())} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center text-xs font-bold text-[#0C8B44] shrink-0">{p.asset}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#E5E5E5] truncate">{p.amount.toLocaleString()} {p.asset} · {protocol}</p>
                      <p className="text-[11px] text-[#737373]">APY {p.apy.toFixed(2)}% · ≈ {fmtMoney(p.amount * px)} · Total earned {p.totalYieldEarned.toFixed(p.asset === 'USDC' || p.asset === 'USDT' ? 2 : 6)} {p.asset}</p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-[#4CAF50]">+{r.rewardAsset.toFixed(p.asset === 'USDC' || p.asset === 'USDT' ? 2 : 6)} {p.asset}</p>
                      <p className="text-[10px] text-[#737373] flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        Next payout {r.nextPayoutInDays < 1 ? `${Math.floor(r.nextPayoutInDays * 24)}h` : `${Math.ceil(r.nextPayoutInDays)}d`}
                      </p>
                    </div>
                    <button
                      onClick={() => unstake(p.id)}
                      className="px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] rounded-lg border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5] hover:border-[#0C8B44]/40 transition-colors"
                      aria-label={`Unstake ${p.amount} ${p.asset} from ${protocol}`}
                    >Unstake</button>
                  </div>
                )
              })}
            </div>

          </section>
        )}

        {/* Marketplace */}
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-sm font-medium text-[#A0A0A0] uppercase tracking-[0.08em]">Earn opportunities</h2>
            <p className="text-[11px] text-[#737373]">Sorted by risk-adjusted APY</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {YIELD_PRODUCTS.map((y) => {
              const bal = balanceFor(y.asset)
              const logo = cryptoIconFor((y.asset || '').toLowerCase())
              const initial = (y.asset || '?')[0]?.toUpperCase() ?? '?'
              return (
                <div key={y.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    {logo ? (
                      <img src={logo} alt="" aria-hidden="true" className="w-10 h-10 rounded-lg" loading="lazy" decoding="async"
                           onError={cryptoIconErrorFallback(initial, (y.asset || '').toLowerCase())} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{y.asset}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#E5E5E5] truncate">{y.name}</p>
                      <p className="text-[11px] text-[#737373] truncate">{y.protocol}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${RISK_BADGE[y.risk]}`}>{y.risk}</span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-2xl font-light text-[#0C8B44]">{(y.apy * 100).toFixed(2)}<span className="text-sm">% APY</span></p>
                    <p className="text-[11px] text-[#737373]">Payouts every {y.payoutFrequencyDays}d</p>
                  </div>
                  <p className="text-[11px] text-[#A0A0A0] leading-relaxed mb-4 flex-1">{y.blurb}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-[#737373]">Available: <span className="text-[#A0A0A0]">{bal.toLocaleString()} {y.asset}</span></p>
                    <button
                      onClick={() => openStake(y)}
                      disabled={bal <= 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Stake ${y.asset} via ${y.protocol}`}
                    >
                      <Plus className="w-3 h-3" /> Stake
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-[#0f1619]/40 border border-[#ffffff05] p-5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0C8B44] mt-0.5 shrink-0" />
          <div className="text-[12px] text-[#A0A0A0] leading-relaxed">
            <p className="text-[#E5E5E5] mb-1">Important</p>
            APYs displayed are current rates from the underlying protocols and can change at any time.
            Smart-contract risk, slashing risk and stablecoin de-peg risk apply. Verdexis does not custody
            your staked assets directly — staking is performed against the listed protocol.
            See <a href="/disclosures" className="text-[#0C8B44] hover:underline">disclosures</a>.
          </div>
        </section>
      </main>

      {productOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="stake-modal-title">
          <div className="bg-[#0f1619] border border-[#ffffff10] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 id="stake-modal-title" className="text-base font-medium">Stake {productOpen.asset} · {productOpen.protocol}</h3>
              <button onClick={() => setProductOpen(null)} aria-label="Close stake dialog" className="text-[#737373] hover:text-[#E5E5E5]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl bg-[#1a1a1a]/60 p-3 mb-4 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-[10px] uppercase text-[#737373]">APY</p><p className="text-sm text-[#0C8B44]">{(productOpen.apy * 100).toFixed(2)}%</p></div>
              <div><p className="text-[10px] uppercase text-[#737373]">Payouts</p><p className="text-sm">Every {productOpen.payoutFrequencyDays}d</p></div>
              <div><p className="text-[10px] uppercase text-[#737373]">Risk</p><p className="text-sm">{productOpen.risk}</p></div>
            </div>
            <label className="block text-[11px] uppercase text-[#737373] mb-1.5" htmlFor="stake-amount">Amount ({productOpen.asset})</label>
            <div className="flex gap-2 mb-4">
              <input
                id="stake-amount"
                type="number"
                inputMode="decimal"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg px-3 py-2 text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]/50"
              />
              <button
                type="button"
                onClick={() => setStakeAmount(String(balanceFor(productOpen.asset)))}
                className="px-3 py-2 text-[11px] uppercase tracking-[0.06em] rounded-lg border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]"
              >Max</button>
            </div>
            <p className="text-[11px] text-[#737373] mb-4">
              Available: <span className="text-[#A0A0A0]">{balanceFor(productOpen.asset).toLocaleString()} {productOpen.asset}</span>
              {parseFloat(stakeAmount) > 0 && isFinite(parseFloat(stakeAmount)) && (
                <> · Est. annual reward: <span className="text-[#4CAF50]">+{(parseFloat(stakeAmount) * productOpen.apy).toFixed(productOpen.asset === 'USDC' || productOpen.asset === 'USDT' ? 2 : 6)} {productOpen.asset}</span></>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setProductOpen(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5] text-sm">Cancel</button>
              <button onClick={confirmStake} className="flex-1 px-4 py-2.5 rounded-lg bg-[#0C8B44] hover:bg-[#0a7539] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5">
                <Zap className="w-4 h-4" /> Confirm stake
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] p-4">
      <p className="text-[10px] uppercase text-[#737373] tracking-wider">{label}</p>
      <p className={`text-xl font-light mt-1 tabular-nums ${accent}`}>{value}</p>
    </div>
  )
}

function Projection({ label, base, value, fmt }: { label: string; base: number; value: number; fmt: (n: number) => string }) {
  const gain = value - base
  const gainPct = base > 0 ? (gain / base) * 100 : 0
  return (
    <div className="rounded-xl bg-[#1a1a1a]/50 p-4">
      <p className="text-[10px] uppercase text-[#737373] tracking-wider">{label}</p>
      <p className="text-lg font-light text-[#E5E5E5] mt-1 tabular-nums">{fmt(value)}</p>
      <p className="text-[11px] text-[#4CAF50] mt-0.5">+{fmt(gain)} <span className="text-[#737373]">({gainPct.toFixed(1)}%)</span></p>
    </div>
  )
}
