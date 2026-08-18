import { api, getToken } from './api'

export type WithdrawalFeeEstimate = {
  amount: number
  method: string
  tier: string
  ratePct: number
  source: 'override' | 'tier' | 'local'
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

export function localWithdrawalFee(amount: number, method = 'crypto'): WithdrawalFeeEstimate {
  const ratePct = method === 'check' ? 0 : LOCAL_TIER_RATES.UNVERIFIED
  const processingFee = amount * ratePct / 100
  return {
    amount,
    method,
    tier: 'UNVERIFIED',
    ratePct,
    source: 'local',
    processingFee,
    totalDebit: amount + processingFee,
    youReceive: amount,
  }
}

export async function estimateWithdrawalFee(amount: number, method = 'crypto'): Promise<WithdrawalFeeEstimate> {
  if (!Number.isFinite(amount) || amount <= 0) return localWithdrawalFee(0, method)
  if (!getToken()) return localWithdrawalFee(amount, method)
  try {
    return await api.get<WithdrawalFeeEstimate>(
      `/api/withdrawals/estimate?amount=${encodeURIComponent(String(amount))}&method=${encodeURIComponent(method)}`,
    )
  } catch {
    return localWithdrawalFee(amount, method)
  }
}
