import { prisma } from './db.js'
import { generateTransactionId } from './utils/transactionIdGenerator.js'

const REFERRAL_CODE_PREFIX = 'VDX'
const REFERRAL_BONUS_REFERRER_USD = 250  // $250 to referrer
const REFERRAL_BONUS_REFEREE_USD = 10   // $10 to referee

export async function generateReferralCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = `${REFERRAL_CODE_PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const existing = await prisma.user.findFirst({ where: { referralCode: code }, select: { id: true } })
    if (!existing) return code
  }
  return `${REFERRAL_CODE_PREFIX}${Date.now().toString(36).toUpperCase()}`
}

export async function linkReferrer(newUserId: string, newUserEmail: string, referralCode?: string): Promise<void> {
  if (!referralCode) return
  const code = referralCode.trim().toUpperCase()
  if (!code) return
  const referrer = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true },
  })
  if (!referrer || referrer.id === newUserId) return
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId: newUserId,
      refereeEmail: newUserEmail,
      status: 'pending',
    },
  }).catch(() => {})
}

export async function activateReferralOnDeposit(
  userId: string,
  depositAmountUsd: number,
): Promise<{ activated: boolean; reason?: string }> {
  const referral = await prisma.referral.findFirst({
    where: { refereeId: userId, status: 'pending' },
  })
  if (!referral) return { activated: false, reason: 'no_pending_referral' }

  const settings = await readReferralSettings()
  if (!settings.enabled) return { activated: false, reason: 'program_disabled' }
  if (depositAmountUsd < settings.minDepositUsd) {
    return { activated: false, reason: 'below_min_deposit' }
  }

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: 'active',
      firstDepositAmount: depositAmountUsd,
      firstDepositAt: new Date(),
      referrerBonusUsd: settings.referrerBonusUsd,
      refereeBonusUsd: settings.refereeBonusUsd,
    },
  })

  await prisma.referralBonus.createMany({
    data: [
      {
        userId: referral.referrerId,
        amount: settings.referrerBonusUsd,
        bonusType: 'referrer',
        status: 'pending',
      },
      {
        userId: userId,
        amount: settings.refereeBonusUsd,
        bonusType: 'referee',
        status: 'pending',
      },
    ],
  }).catch(() => {})

  return { activated: true }
}

export async function getReferralSummary(userId: string): Promise<{
  code: string | null
  totalReferrals: number
  activeReferrals: number
  pendingBonuses: number
  earnedUsd: number
}> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
  const [totalReferrals, activeReferrals, bonuses] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.referral.count({ where: { referrerId: userId, status: 'active' } }),
    prisma.referralBonus.findMany({ where: { userId }, select: { amount: true, status: true } }),
  ])
  const pendingBonuses = bonuses.filter((b) => b.status === 'pending').reduce((s, b) => s + b.amount, 0)
  const earnedUsd = bonuses.filter((b) => b.status === 'credited' || b.status === 'paid').reduce((s, b) => s + b.amount, 0)
  return {
    code: user?.referralCode ?? null,
    totalReferrals,
    activeReferrals,
    pendingBonuses,
    earnedUsd,
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

export async function creditReferralBonus(bonusId: string, paymentMethod: 'trading_credit' | 'cash_deposit' = 'trading_credit'): Promise<{
  bonusId: string
  userId: string
  amount: number
  transactionId?: string
}> {
  const bonus = await prisma.referralBonus.findUnique({
    where: { id: bonusId },
    select: { userId: true, amount: true, status: true },
  })

  if (!bonus || bonus.status !== 'pending') {
    throw new Error(`Bonus not found or already credited`)
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

const REFERRAL_SETTINGS_KEY = 'referral_program_settings'

export type ReferralProgramSettings = {
  enabled: boolean
  referrerBonusUsd: number
  refereeBonusUsd: number
  minDepositUsd: number
  note: string
}

const DEFAULT_REFERRAL_SETTINGS: ReferralProgramSettings = {
  enabled: true,
  referrerBonusUsd: REFERRAL_BONUS_REFERRER_USD,
  refereeBonusUsd: REFERRAL_BONUS_REFEREE_USD,
  minDepositUsd: 0,
  note: '',
}

export async function readReferralSettings(): Promise<ReferralProgramSettings> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: REFERRAL_SETTINGS_KEY } })
    if (!row?.value) return { ...DEFAULT_REFERRAL_SETTINGS }
    const parsed = JSON.parse(row.value) as Partial<ReferralProgramSettings>
    return {
      enabled: parsed.enabled !== false,
      referrerBonusUsd: Number(parsed.referrerBonusUsd ?? DEFAULT_REFERRAL_SETTINGS.referrerBonusUsd) || 0,
      refereeBonusUsd: Number(parsed.refereeBonusUsd ?? DEFAULT_REFERRAL_SETTINGS.refereeBonusUsd) || 0,
      minDepositUsd: Number(parsed.minDepositUsd ?? 0) || 0,
      note: String(parsed.note ?? ''),
    }
  } catch {
    return { ...DEFAULT_REFERRAL_SETTINGS }
  }
}

export async function writeReferralSettings(
  settings: ReferralProgramSettings,
  updatedBy?: string,
): Promise<ReferralProgramSettings> {
  const value = JSON.stringify({
    enabled: settings.enabled === true,
    referrerBonusUsd: Number(settings.referrerBonusUsd) || 0,
    refereeBonusUsd: Number(settings.refereeBonusUsd) || 0,
    minDepositUsd: Number(settings.minDepositUsd) || 0,
    note: String(settings.note || '').slice(0, 500),
  })
  await prisma.appSetting.upsert({
    where: { key: REFERRAL_SETTINGS_KEY },
    create: { key: REFERRAL_SETTINGS_KEY, value, updatedBy: updatedBy || 'admin' },
    update: { value, updatedBy: updatedBy || 'admin' },
  })
  return readReferralSettings()
}
