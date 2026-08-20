import crypto from 'node:crypto'
import { prisma } from './db.js'
import { generateTransactionId } from './utils/transactionIdGenerator.js'

const REFERRAL_SETTINGS_KEY = 'referral_program'

export type ReferralProgramSettings = {
  enabled: boolean
  referrerBonusUsd: number
  refereeBonusUsd: number
  minDepositUsd: number
  note?: string
}

const DEFAULT_SETTINGS: ReferralProgramSettings = {
  enabled: false,
  referrerBonusUsd: 250,
  refereeBonusUsd: 10,
  minDepositUsd: 50,
  note: '',
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
      referrerBonusUsd: Number.isFinite(referrerBonusUsd) && referrerBonusUsd >= 0 ? referrerBonusUsd : DEFAULT_SETTINGS.referrerBonusUsd,
      refereeBonusUsd: Number.isFinite(refereeBonusUsd) && refereeBonusUsd >= 0 ? refereeBonusUsd : DEFAULT_SETTINGS.refereeBonusUsd,
      minDepositUsd: Number.isFinite(minDepositUsd) && minDepositUsd >= 0 ? minDepositUsd : DEFAULT_SETTINGS.minDepositUsd,
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
): Promise<{ linked: boolean; reason?: string }> {
  if (!referralCode?.trim()) return { linked: false, reason: 'no_code' }
  const settings = await readReferralSettings()
  if (!settings.enabled) return { linked: false, reason: 'program_disabled' }
  const code = referralCode.trim().toUpperCase()
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  })
  if (!referrer) return { linked: false, reason: 'invalid_code' }
  if (referrer.id === newUserId) return { linked: false, reason: 'self_referral' }
  const existing = await prisma.referral.findFirst({
    where: { refereeId: newUserId },
    select: { id: true },
  })
  if (existing) return { linked: false, reason: 'already_linked' }
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId: newUserId,
      refereeEmail: newUserEmail,
      status: 'pending',
    },
  })
  await prisma.user.update({
    where: { id: newUserId },
    data: { referrerId: referrer.id },
  }).catch(() => {})
  return { linked: true }
}

export async function activateReferralOnDeposit(
  refereeUserId: string,
  depositAmountUsd: number,
): Promise<{ activated: boolean; reason?: string }> {
  const settings = await readReferralSettings()
  if (!settings.enabled) return { activated: false, reason: 'program_disabled' }
  if (depositAmountUsd < settings.minDepositUsd) return { activated: false, reason: 'below_min_deposit' }
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
  const bonusRows: Array<{ userId: string; amount: number; bonusType: string; paymentMethod: string; status: string }> = []
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

export async function getReferralSummary(userId: string): Promise<{
  referralCode: string | null
  totalEarned: number
  activeReferrals: number
  pendingReferrals: number
  program: ReferralProgramSettings
}> {
  const [settings, code] = await Promise.all([
    readReferralSettings(),
    ensureUserReferralCode(userId).catch(() => null),
  ])
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: { status: true, referrerBonusUsd: true },
  })
  const bonuses = await prisma.referralBonus.findMany({
    where: { userId, bonusType: 'referrer_bonus', status: 'credited' },
    select: { amount: true },
  })
  return {
    referralCode: code,
    totalEarned: bonuses.reduce((sum, b) => sum + (b.amount || 0), 0),
    activeReferrals: referrals.filter((r) => r.status === 'active').length,
    pendingReferrals: referrals.filter((r) => r.status === 'pending').length,
    program: settings,
  }
}

export async function getUserReferrals(userId: string) {
  return prisma.referral.findMany({
    where: { referrerId: userId },
    select: {
      id: true,
      refereeEmail: true,
      status: true,
      firstDepositAt: true,
      firstDepositAmount: true,
      referrerBonusUsd: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function creditReferralBonus(
  bonusId: string,
  paymentMethod: 'trading_credit' | 'cash_deposit' = 'trading_credit',
): Promise<{ bonusId: string; userId: string; amount: number; transactionId?: string }> {
  const bonus = await prisma.referralBonus.findUnique({
    where: { id: bonusId },
    select: { userId: true, amount: true, status: true },
  })
  if (!bonus || bonus.status !== 'pending') {
    throw new Error('Bonus not found or already credited')
  }
  const transaction = await prisma.transaction.create({
    data: {
      transactionId: generateTransactionId(),
      userId: bonus.userId,
      kind: 'deposit',
      currency: 'USD',
      amount: bonus.amount,
      status: 'completed',
      subType: 'referral_bonus',
      reference: `referral_bonus:${bonusId}`,
    } as any,
  })
  const wallet = await prisma.walletBalance.findUnique({
    where: { userId_currency: { userId: bonus.userId, currency: 'USD' } },
    select: { id: true, balance: true, available: true },
  })
  if (wallet) {
    await prisma.walletBalance.update({
      where: { id: wallet.id },
      data: {
        balance: wallet.balance + bonus.amount,
        available: wallet.available + bonus.amount,
      },
    })
  }
  await prisma.referralBonus.update({
    where: { id: bonusId },
    data: {
      status: 'credited',
      creditedAt: new Date(),
      creditedTransactionId: transaction.id,
    },
  })
  return {
    bonusId,
    userId: bonus.userId,
    amount: bonus.amount,
    transactionId: transaction.id,
  }
}

export { REFERRAL_SETTINGS_KEY, DEFAULT_SETTINGS as DEFAULT_REFERRAL_SETTINGS }
