import { api, getToken } from './api'

export type WithdrawalFeeEstimate = {
  amount: number
  method: string
  tier: string
  ratePct: number
  source: 'override' | 'tier' | 'local' | 'global'
  processingFee: number
  totalDebit: number
  youReceive: number
}

const LOCAL_TIER_RATES: Record<string, number> = {
  PLATINUM: 0.5,
  GOLD: 1,
  SILVER: 1.5,
  BRONZE: 2,
  VERIFIED: 2.5,
  UNVERIFIED: 3,
}

export function feeFromRate(amount: number, ratePct: number, method = 'crypto', source: WithdrawalFeeEstimate['source'] = 'local', tier = 'UNVERIFIED'): WithdrawalFeeEstimate {
  const rate = method === 'check' ? 0 : Math.min(Math.max(ratePct, 0), 15)
  const processingFee = amount * rate / 100
  return {
    amount,
    method,
    tier,
    ratePct: rate,
    source,
    processingFee,
    totalDebit: amount + processingFee,
    youReceive: amount,
  }
}

export function localWithdrawalFee(amount: number, method = 'crypto'): WithdrawalFeeEstimate {
  return feeFromRate(amount, LOCAL_TIER_RATES.UNVERIFIED, method, 'local')
}

export async function estimateWithdrawalFee(amount: number, method = 'crypto'): Promise<WithdrawalFeeEstimate> {
  if (!Number.isFinite(amount) || amount <= 0) return localWithdrawalFee(0, method)
  if (!getToken()) return localWithdrawalFee(amount, method)

  try {
    const live = await api.get<WithdrawalFeeEstimate>(
      `/api/withdrawals/estimate?amount=${encodeURIComponent(String(amount))}&method=${encodeURIComponent(method)}`,
    )
    if (live && typeof live.processingFee === 'number') return live
  } catch {
    /* fall through */
  }

  try {
    const cfg = await api.get<{ ratePct?: number }>('/api/wallet/withdrawal-fee-config')
    if (typeof cfg.ratePct === 'number') {
      return feeFromRate(amount, cfg.ratePct, method, 'global')
    }
  } catch {
    /* use local default */
  }

  return localWithdrawalFee(amount, method)
}
