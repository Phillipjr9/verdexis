import { marketData } from './marketData'

const EVENT = 'verdexis:staking'
let memory: StakingPosition[] = []

export interface StakingPosition {
  id: string
  asset: string
  name: string
  principal: number
  apy: number
  startedAt: string
  protocol: string
  payoutFrequencyDays: number
}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function load(): StakingPosition[] {
  return memory.slice()
}

function save(list: StakingPosition[]) {
  memory = list
  emit()
}

export const stakingStore = {
  list(): StakingPosition[] { return load() },
  async hydrate(): Promise<StakingPosition[]> {
    try {
      const { api } = await import('./api')
      const res = await api.staking.listPositions()
      memory = (res.positions || []).filter((p) => p.status !== 'unstaked').map((p) => ({
        id: p.id,
        asset: p.asset,
        name: p.asset,
        principal: p.amount,
        apy: p.apy > 1 ? p.apy / 100 : p.apy,
        startedAt: p.startedAt,
        protocol: 'Verdexis',
        payoutFrequencyDays: p.yieldFrequency === 'monthly' ? 30 : p.yieldFrequency === 'weekly' ? 7 : 1,
      }))
      emit()
    } catch (e) {
      console.warn('[staking] hydrate failed', e)
    }
    return memory.slice()
  },
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
      totalApy += p.apy * p.principal * price
    }
    const blendedApy = totalPrincipal > 0 ? totalApy / totalPrincipal : 0
    return {
      staked: totalPrincipal,
      pending: totalRewards,
      blendedApy,
      annualYield: totalPrincipal * blendedApy,
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
      projection += p.principal * price * Math.pow(1 + p.apy, years)
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
  const sinceLast = totalAccrued - (cyclesElapsed * p.principal * p.apy * (p.payoutFrequencyDays / 365))
  return { rewardAsset: Math.max(0, sinceLast), nextPayoutInDays }
}

export function priceForAsset(asset: string): number {
  const quotes = marketData.getLatestQuotes()
  const key = asset.toLowerCase()
  if (quotes.has(key)) return quotes.get(key)!
  return 0
}

export const STAKING_EVENT = EVENT
