export type WithdrawalOverrides = {
  feeRate: number | null
  waiveFee: boolean
  requireAdminApproval: boolean
}

export function parseUserPrefs(raw: string | null | undefined): Record<string, unknown> {
  try {
    return raw ? JSON.parse(raw) as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function readWithdrawalOverrides(prefs: Record<string, unknown>): WithdrawalOverrides {
  const feeRaw = prefs.withdrawalFeeOverride
  const feeRate = typeof feeRaw === 'number' && Number.isFinite(feeRaw)
    ? Math.min(Math.max(feeRaw, 0), 100)
    : null
  return {
    feeRate,
    waiveFee: prefs.withdrawalFeeWaived === true,
    requireAdminApproval: prefs.withdrawalRequireAdminApproval === true || prefs.withdrawalForceHold === true,
  }
}

export function applyWithdrawalFee(
  amount: number,
  method: string,
  tierRatePct: number,
  overrides: WithdrawalOverrides,
): { ratePct: number; processingFee: number; source: 'override' | 'waived' | 'tier' } {
  if (method === 'check' || overrides.waiveFee) {
    return { ratePct: 0, processingFee: 0, source: overrides.waiveFee ? 'waived' : 'tier' }
  }
  const ratePct = overrides.feeRate != null ? overrides.feeRate : tierRatePct
  return {
    ratePct,
    processingFee: Math.max(0, amount) * ratePct / 100,
    source: overrides.feeRate != null ? 'override' : 'tier',
  }
}
