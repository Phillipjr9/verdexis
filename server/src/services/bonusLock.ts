/** Unified bonus-withdrawal lock helpers.
 *  Historically two shapes were written:
 *    prefs.bonusLocked = true
 *    prefs.bonusLock = { active: true, amountUsd }
 *  Grant/unlock/enforce must treat both as the same lock.
 */

export type ParsedPrefs = Record<string, unknown>

export function parsePrefs(raw: unknown): ParsedPrefs {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as ParsedPrefs) }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function lockObject(prefs: ParsedPrefs): Record<string, unknown> | null {
  const lock = prefs.bonusLock
  if (lock && typeof lock === 'object' && !Array.isArray(lock)) return lock as Record<string, unknown>
  return null
}

export function isBonusLocked(prefs: ParsedPrefs): boolean {
  if (prefs.bonusLocked === true) return true
  const lock = lockObject(prefs)
  return !!(lock && lock.active === true)
}

export function bonusLockedAmountUsd(prefs: ParsedPrefs): number | null {
  if (typeof prefs.bonusLockedAmountUsd === 'number' && Number.isFinite(prefs.bonusLockedAmountUsd)) {
    return prefs.bonusLockedAmountUsd
  }
  const lock = lockObject(prefs)
  if (!lock) return null
  const n = Number(lock.amountUsd ?? lock.amount)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function applyBonusLock(
  prefs: ParsedPrefs,
  opts: { amountUsd: number; source?: string; extraLock?: Record<string, unknown> },
): ParsedPrefs {
  const prev = lockObject(prefs) || {}
  return {
    ...prefs,
    bonusLocked: true,
    bonusLockedAmountUsd: opts.amountUsd,
    bonusLockedAt: new Date().toISOString(),
    bonusLock: {
      ...prev,
      ...(opts.extraLock || {}),
      active: true,
      amountUsd: opts.amountUsd,
      grantedAt: typeof prev.grantedAt === 'string' ? prev.grantedAt : new Date().toISOString(),
      source: opts.source || prev.source || 'signup_bonus',
    },
  }
}

export function clearBonusLock(prefs: ParsedPrefs, by?: string): ParsedPrefs {
  const next: ParsedPrefs = { ...prefs }
  delete next.bonusLocked
  delete next.bonusLockedAmountUsd
  delete next.bonusLockedAt
  delete next.bonusLock
  next.bonusUnlockedAt = new Date().toISOString()
  if (by) next.bonusUnlockedBy = by
  return next
}

export const BONUS_LOCK_RESPONSE = {
  error: 'Withdrawals are locked until your signup bonus is reviewed.',
  reason: 'bonus_locked',
  whatsapp: 'https://wa.me/17196798790',
  telegram: 'https://t.me/+17196798790',
} as const
