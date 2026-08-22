import crypto from 'node:crypto'
import { prisma } from './db.js'
import { generateTransactionId } from './utils/transactionIdGenerator.js'

const REFERRAL_SETTINGS_KEY = 'referral_program'

/** Canonical format produced by generateReferralCode: VERDX-XXXXXX (6 hex). */
export const REFERRAL_CODE_REGEX = /^VERDX-[0-9A-F]{6}$/

/** Looser pattern for legacy / alternate codes (4–32 chars, alnum + hyphen). */
export const REFERRAL_CODE_LEGACY_REGEX = /^[A-Z0-9][A-Z0-9-]{3,31}$/

export type ReferralProgramSettings = {
  enabled: boolean
  referrerBonusUsd: number
  refereeBonusUsd: number
  minDepositUsd: number
  note?: string
}

export type ReferralValidationReason =
  | 'empty'
  | 'invalid_format'
  | 'not_found'
  | 'referrer_suspended'
  | 'ok'

export type ReferralValidationResult = {
  valid: boolean
  code: string
  reason: ReferralValidationReason
  /** First name only — no email/id exposed on public validate. */
  referrerName?: string | null
}

const DEFAULT_SETTINGS: ReferralProgramSettings = {
  enabled: false,
  referrerBonusUsd: 250,
  refereeBonusUsd: 10,
  minDepositUsd: 50,
  note: '',
}

/**
 * Normalize user input: trim, upper-case, strip spaces.
 * Accepts VERDXXXXXXX → VERDX-XXXXXX.
 */
export function normalizeReferralCode(raw?: string | null): string {
  if (raw == null) return ''
  let code = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return ''
  // Insert hyphen if missing: VERDX + 6 hex
  if (/^VERDX[0-9A-F]{6}$/.test(code)) {
    code = `VERDX-${code.slice(5)}`
  }
  return code
}

/** Format-only check (no DB). Empty string is not valid format. */
export function isValidReferralCodeFormat(raw?: string | null): boolean {
  const code = normalizeReferralCode(raw)
  if (!code) return false
  if (REFERRAL_CODE_REGEX.test(code)) return true
  return REFERRAL_CODE_LEGACY_REGEX.test(code)
}

/**
 * Validate a referral code for signup attribution.
 * Checks format, existence, and that the referrer is not suspended.
 */
export async function validateReferralCode(
  raw?: string | null,
): Promise<ReferralValidationResult> {
  const code = normalizeReferralCode(raw)
  if (!code) {
    return { valid: false, code: '', reason: 'empty' }
  }
  if (!isValidReferralCodeFormat(code)) {
    return { valid: false, code, reason: 'invalid_format' }
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, name: true, suspended: true },
  })

  if (!referrer) {
    return { valid: false, code, reason: 'not_found' }
  }
  if (referrer.suspended) {
    return { valid: false, code, reason: 'referrer_suspended' }
  }

  const firstName =
    typeof referrer.name === 'string' && referrer.name.trim()
      ? referrer.name.trim().split(/\s+/)[0]
      : null

  return {
    valid: true,
    code,
    reason: 'ok',
    referrerName: firstName,
  }
}

export async function readReferralSettings(): Promise<ReferralProgramSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: REFERRAL_SETTINGS_KEY } })
  if (!row?.value) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(row.value) as Partial<ReferralProgramSettings>
    const referrerBonusUsd = Number(parsed.referrerBonusUsd)
    const refereeBonusUsd = Number(parsed.refereeBonusUsd)
    const minDepositUsd = Number(parsed.minDepositUsd)
    return {
      enabled: parsed.enabled === true,
      referrerBonusUsd:
        Number.isFinite(referrerBonusUsd) && referrerBonusUsd >= 0
          ? referrerBonusUsd
          : DEFAULT_SETTINGS.referrerBonusUsd,
      refereeBonusUsd:
        Number.isFinite(refereeBonusUsd) && refereeBonusUsd >= 0
          ? refereeBonusUsd
          : DEFAULT_SETTINGS.refereeBonusUsd,
      minDepositUsd:
        Number.isFinite(minDepositUsd) && minDepositUsd >= 0
          ? minDepositUsd
          : DEFAULT_SETTINGS.minDepositUsd,
      note: typeof parsed.note === 'string' ? parsed.note : '',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function writeReferralSettings(
  settings: ReferralProgramSettings,
  updatedBy?: string,
): Promise<ReferralProgramSettings> {
  const normalized: ReferralProgramSettings = {
    enabled: settings.enabled === true,
    referrerBonusUsd: Math.max(0, Number(settings.referrerBonusUsd) || 0),
    refereeBonusUsd: Math.max(0, Number(settings.refereeBonusUsd) || 0),
    minDepositUsd: Math.max(0, Number(settings.minDepositUsd) || 0),
    note: (settings.note || '').trim().slice(0, 500),
  }
  const json = JSON.stringify(normalized)
  await prisma.appSetting.upsert({
    where: { key: REFERRAL_SETTINGS_KEY },
    create: { key: REFERRAL_SETTINGS_KEY, value: json, updatedBy: updatedBy || null },
    update: { value: json, updatedBy: updatedBy || null },
  })
  return normalized
}

export async function generateReferralCode(): Promise<string> {
  let code = ''
  let existing: { referralCode: string | null } | null = { referralCode: 'taken' }
  while (existing) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
    code = `VERDX-${randomHex}`
    existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { referralCode: true },
    })
  }
  return code
}

export async function ensureUserReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (user?.referralCode) return user.referralCode
  const code = await generateReferralCode()
  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } })
  return code
}

export async function linkReferrer(
  newUserId: string,
  newUserEmail: string,
  referralCode?: string,
): Promise<{ linked: boolean; reason?: string; code?: string }> {
  if (!referralCode?.trim()) return { linked: false, reason: 'no_code' }

  const validation = await validateReferralCode(referralCode)
  if (!validation.valid) {
    return {
      linked: false,
      reason: validation.reason === 'empty' ? 'no_code' : validation.reason,
      code: validation.code || undefined,
    }
  }

  const code = validation.code
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  })
  if (!referrer) return { linked: false, reason: 'not_found', code }
  if (referrer.id === newUserId) return { linked: false, reason: 'self_referral', code }

  const existing = await prisma.referral.findFirst({
    where: { refereeId: newUserId },
    select: { id: true },
  })
  if (existing) return { linked: false, reason: 'already_linked', code }

  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId: newUserId,
      refereeEmail: newUserEmail,
      status: 'pending',
    },
  })
  await prisma.user
    .update({
      where: { id: newUserId },
      data: { referrerId: referrer.id },
    })
    .catch(() => {})

  return { linked: true, reason: 'ok', code }
}

export async function activateReferralOnDeposit(
  refereeUserId: string,
  depositAmountUsd: number,
): Promise<{ activated: boolean; reason?: string }> {
  const settings = await readReferralSettings()
  if (!settings.enabled) return { activated: false, reason: 'program_disabled' }
  if (depositAmountUsd < settings.minDepositUsd) {
    return { activated: false, reason: 'below_min_deposit' }
  }
  const referral = await prisma.referral.findFirst({
    where: { refereeId: refereeUserId, status: 'pending' },
  })
  if (!referral) return { activated: false, reason: 'no_pending_referral' }
  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: 'active',
      firstDepositAt: new Date(),
      firstDepositAmount: depositAmountUsd,
      referrerBonusUsd: settings.referrerBonusUsd,
      refereeBonusUsd: settings.refereeBonusUsd,
    },
  })
  const bonusRows: Array<{
    userId: string
    amount: number
    bonusType: string
    paymentMethod: string
    status: string
  }> = []
  if (settings.referrerBonusUsd > 0) {
    bonusRows.push({
      userId: referral.referrerId,
      amount: settings.referrerBonusUsd,
      bonusType: 'referrer_bonus',
      paymentMethod: 'trading_credit',
      status: 'pending',
    })
  }
  if (settings.refereeBonusUsd > 0) {
    bonusRows.push({
      userId: refereeUserId,
      amount: settings.refereeBonusUsd,
      bonusType: 'referee_bonus',
      paymentMethod: 'trading_credit',
      status: 'pending',
    })
  }
  if (bonusRows.length > 0) await prisma.referralBonus.createMany({ data: bonusRows })
  return { activated: true }
}

export async function getReferralDashboard(userId: string) {
  const [code, list, bonuses] = await Promise.all([
    ensureUserReferralCode(userId).catch(() => null),
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.referralBonus.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])
  const activeReferrals = list.filter((r) => r.status === 'active').length
  const pendingReferrals = list.filter((r) => r.status === 'pending').length
  const totalEarned = bonuses
    .filter((b) => b.status === 'paid' || b.status === 'credited')
    .reduce((s, b) => s + Number(b.amount || 0), 0)
  return {
    referralCode: code,
    totalEarned,
    activeReferrals,
    pendingReferrals,
    referrals: list,
    bonuses,
  }
}

/** Alias used by referral routes */
export async function getReferralSummary(userId: string) {
  const d = await getReferralDashboard(userId)
  return {
    referralCode: d.referralCode,
    totalEarned: d.totalEarned,
    activeReferrals: d.activeReferrals,
    pendingReferrals: d.pendingReferrals,
  }
}

export async function getUserReferrals(userId: string) {
  return prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      refereeEmail: true,
      status: true,
      firstDepositAt: true,
      firstDepositAmount: true,
      referrerBonusUsd: true,
      refereeBonusUsd: true,
      createdAt: true,
    },
  })
}

export async function creditReferralBonus(
  bonusId: string,
  paymentMethod = 'trading_credit',
): Promise<{ success: boolean; result?: unknown }> {
  const bonus = await prisma.referralBonus.findUnique({ where: { id: bonusId } })
  if (!bonus) throw new Error('Bonus not found')
  if (bonus.status === 'paid' || bonus.status === 'credited') {
    return {
      success: true,
      result: { alreadyCredited: true, transactionId: bonus.creditedTransactionId },
    }
  }
  const transactionId = generateTransactionId()
  await prisma.referralBonus.update({
    where: { id: bonusId },
    data: {
      status: 'credited',
      creditedAt: new Date(),
      creditedTransactionId: transactionId,
      paymentMethod,
    },
  })
  return { success: true, result: { transactionId } }
}

export { REFERRAL_SETTINGS_KEY, DEFAULT_SETTINGS as DEFAULT_REFERRAL_SETTINGS }
