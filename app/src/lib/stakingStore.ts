// Local staking / yield tracker. Each position has an asset, principal,
// APY, and start date. Pending rewards are computed on the fly from
// (principal * apy * elapsed / year). Default seed positions illustrate
// realistic ETH / SOL / USDC yields so a brand-new account isn't empty.

const STORAGE_KEY = 'verdexis_staking'
const EVENT = 'verdexis:staking'

export interface StakingPosition {
  id: string
  asset: string // symbol e.g. ETH
  name: string
  principal: number // amount of asset staked
  apy: number // 0.05 = 5%
  startedAt: string // ISO
  protocol: string // e.g. 'Lido', 'Marinade', 'Aave'
  payoutFrequencyDays: number
}

const DEFAULT_POSITIONS: StakingPosition[] = [
  { id: 's_eth', asset: 'ETH', name: 'Ethereum', principal: 5, apy: 0.038, startedAt: new Date(Date.now() - 90 * 86400_000).toISOString(), protocol: 'Lido', payoutFrequencyDays: 1 },
  { id: 's_sol', asset: 'SOL', name: 'Solana', principal: 120, apy: 0.072, startedAt: new Date(Date.now() - 45 * 86400_000).toISOString(), protocol: 'Marinade', payoutFrequencyDays: 2 },
  { id: 's_usdc', asset: 'USDC', name: 'USD Coin', principal: 25000, apy: 0.045, startedAt: new Date(Date.now() - 30 * 86400_000).toISOString(), protocol: 'Aave v3', payoutFrequencyDays: 1 },
]

function load(): StakingPosition[] {
  if (typeof window === 'undefined') return DEFAULT_POSITIONS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_POSITIONS
    const parsed = JSON.parse(raw) as StakingPosition[]
    return Array.isArray(parsed) ? parsed : DEFAULT_POSITIONS
  } catch { return DEFAULT_POSITIONS }
}

function save(list: StakingPosition[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(EVENT))
}

export const stakingStore = {
  list(): StakingPosition[] { return load() },
  add(input: Omit<StakingPosition, 'id' | 'startedAt'>): StakingPosition {
    const p: StakingPosition = { ...input, id: `s_${Date.now()}`, startedAt: new Date().toISOString() }
    save([...load(), p])
    return p
  },
  remove(id: string) { save(load().filter((p) => p.id !== id)) },
  stake(input: Omit<StakingPosition, 'id' | 'startedAt'>): StakingPosition {
    const p: StakingPosition = { ...input, id: `s_${Date.now()}`, startedAt: new Date().toISOString() }
    save([...load(), p])
    return p
  },
  unstake(id: string) { save(load().filter((p) => p.id !== id)) },
  totalsUsd(): { 
    staked: number
    pending: number
    blendedApy: number
    annualYield: number
    totalPrincipalUsd: number
    totalRewardsUsd: number
    totalValueUsd: number
  } {
    const positions = load()
    let totalPrincipal = 0
    let totalRewards = 0
    let totalApy = 0
    
    for (const p of positions) {
      const price = priceForAsset(p.asset)
      totalPrincipal += p.principal * price
      const reward = pendingRewardFor(p)
      totalRewards += reward.rewardAsset * price
      totalApy += p.apy * p.principal * price // weighted APY
    }
    
    const blendedApy = totalPrincipal > 0 ? totalApy / totalPrincipal : 0
    const annualYield = totalPrincipal * blendedApy
    
    return {
      staked: totalPrincipal,
      pending: totalRewards,
      blendedApy,
      annualYield,
      totalPrincipalUsd: totalPrincipal,
      totalRewardsUsd: totalRewards,
      totalValueUsd: totalPrincipal + totalRewards,
    }
  },
  projectStakedUsd(years: number): number {
    const positions = load()
    let projection = 0
    
    for (const p of positions) {
      const price = priceForAsset(p.asset)
      const principal = p.principal * price
      const compounded = principal * Math.pow(1 + p.apy, years)
      projection += compounded
    }
    
    return projection
  },
}

export function pendingRewardFor(p: StakingPosition): { rewardAsset: number; nextPayoutInDays: number } {
  const elapsedYears = (Date.now() - new Date(p.startedAt).getTime()) / (365 * 86400_000)
  const totalAccrued = p.principal * p.apy * Math.max(0, elapsedYears)
  const cyclesElapsed = Math.floor((Date.now() - new Date(p.startedAt).getTime()) / (p.payoutFrequencyDays * 86400_000))
  const nextPayout = new Date(p.startedAt).getTime() + (cyclesElapsed + 1) * p.payoutFrequencyDays * 86400_000
  const nextPayoutInDays = Math.max(0, (nextPayout - Date.now()) / 86400_000)
  // Reward since the last payout cycle:
  const sinceLast = totalAccrued - (cyclesElapsed * p.principal * p.apy * (p.payoutFrequencyDays / 365))
  return { rewardAsset: Math.max(0, sinceLast), nextPayoutInDays }
}

// Mock price feed for staking assets. In production, this would query a real API.
export function priceForAsset(asset: string): number {
  const prices: Record<string, number> = {
    ETH: 2500,
    SOL: 180,
    USDC: 1,
    BTC: 63000,
    AVAX: 45,
    POLYGON: 0.8,
  }
  return prices[asset] || 0
}

export const STAKING_EVENT = EVENT
