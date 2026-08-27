import { prisma } from '../db.js'
import { recordLedgerTransaction, recordLedgerBalanceReservation } from './ledger.js'

const ASSET = 'USD'
const KEY_ENABLED = 'signup_bonus_enabled'
const KEY_AMOUNT = 'signup_bonus_amount'

export type SignupBonusStatus = {
  enabled: boolean
  amountUsd: number
  credited: boolean
  locked: boolean
  amountLockedUsd: number
}

async function readBonusConfig(): Promise<{ enabled: boolean; amountUsd: number }> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [KEY_ENABLED, KEY_AMOUNT] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const enabled = (map[KEY_ENABLED] ?? 'false') === 'true'
  const amountUsd = Number(map[KEY_AMOUNT] ?? '0') || 0
  return { enabled, amountUsd }
}

/**
 * Credit signup bonus on first successful email verification.
 * Funds are credited then immediately locked (available=0 for that amount)
 * until an admin unlocks them.
 *
 * Idempotent via financialEvent.externalRef = `signup-bonus:{userId}`.
 */
export async function grantSignupBonusIfEligible(userId: string): Promise<{
  granted: boolean
  amountUsd: number
  reason?: string
}> {
  try {
    const { enabled, amountUsd } = await readBonusConfig()
    if (!enabled || amountUsd <= 0) {
      return { granted: false, amountUsd: 0, reason: 'disabled_or_zero' }
    }

    const externalRef = `signup-bonus:${userId}`
    const lockRef = `signup-bonus-lock:${userId}`

    // Already granted?
    const existing = await prisma.financialEvent.findUnique({ where: { externalRef } }).catch(() => null)
    if (existing) {
      return { granted: false, amountUsd, reason: 'already_granted' }
    }

    await prisma.$transaction(async (tx) => {
      // 1) Credit total balance (ledger debit = user credit in this codebase)
      await recordLedgerTransaction({
        tx,
        userId,
        asset: ASSET,
        amount: amountUsd,
        entryType: 'debit',
        kind: 'bonus',
        eventType: 'signup_bonus_credit',
        sourceType: 'signup_bonus',
        sourceId: userId,
        externalRef,
        idempotencyKey: externalRef,
        description: `Signup bonus $${amountUsd} (locked until admin unlock)`,
        metadata: {
          type: 'signup_bonus',
          locked: true,
          amountUsd,
        },
        createdBy: 'system',
        reference: `Signup bonus $${amountUsd}`,
        recordTransaction: true,
        subType: 'signup_bonus',
      })

      // 2) Lock so it cannot be withdrawn/transferred until admin unlock
      await recordLedgerBalanceReservation({
        tx,
        userId,
        asset: ASSET,
        amount: amountUsd,
        action: 'lock',
        kind: 'bonus_lock',
        eventType: 'signup_bonus_lock',
        sourceType: 'signup_bonus_lock',
        sourceId: userId,
        externalRef: lockRef,
        idempotencyKey: lockRef,
        description: `Lock signup bonus $${amountUsd}`,
        metadata: { type: 'signup_bonus_lock', amountUsd },
        createdBy: 'system',
        reference: `Lock signup bonus $${amountUsd}`,
      })

      await tx.notification.create({
        data: {
          userId,
          kind: 'bonus',
          title: `$${amountUsd} signup bonus credited`,
          body: `Your signup bonus is on your account but locked until an administrator unlocks it.`,
        },
      }).catch(() => null)
    })

    console.log(`[signup-bonus] granted $${amountUsd} (locked) to user ${userId}`)
    return { granted: true, amountUsd }
  } catch (e) {
    console.error('[signup-bonus] grant failed', userId, e)
    return { granted: false, amountUsd: 0, reason: e instanceof Error ? e.message : 'error' }
  }
}

/**
 * Admin unlock: move locked signup bonus into available balance.
 * Idempotent via financialEvent.externalRef = `signup-bonus-unlock:{userId}`.
 */
export async function unlockSignupBonus(
  userId: string,
  adminId: string,
): Promise<{ unlocked: boolean; amountUsd: number; reason?: string }> {
  const creditRef = `signup-bonus:${userId}`
  const unlockRef = `signup-bonus-unlock:${userId}`

  const already = await prisma.financialEvent.findUnique({ where: { externalRef: unlockRef } }).catch(() => null)
  if (already) {
    return { unlocked: false, amountUsd: 0, reason: 'already_unlocked' }
  }

  const creditEvent = await prisma.financialEvent.findUnique({ where: { externalRef: creditRef } }).catch(() => null)
  if (!creditEvent) {
    return { unlocked: false, amountUsd: 0, reason: 'no_bonus_credited' }
  }

  // Prefer amount from lock event metadata / account locked balance
  let amountUsd = 0
  try {
    const details = creditEvent.details ? JSON.parse(creditEvent.details) : {}
    amountUsd = Number(details.amountUsd) || 0
  } catch {
    amountUsd = 0
  }

  if (amountUsd <= 0) {
    const ab = await prisma.accountBalance.findUnique({
      where: { userId_asset: { userId, asset: ASSET } },
    })
    // lockedMinorUnits is in cents for USD
    amountUsd = ab ? Number(ab.lockedMinorUnits) / 100 : 0
  }

  if (amountUsd <= 0) {
    return { unlocked: false, amountUsd: 0, reason: 'nothing_to_unlock' }
  }

  await prisma.$transaction(async (tx) => {
    await recordLedgerBalanceReservation({
      tx,
      userId,
      asset: ASSET,
      amount: amountUsd,
      action: 'unlock',
      kind: 'bonus_unlock',
      eventType: 'signup_bonus_unlock',
      sourceType: 'signup_bonus_unlock',
      sourceId: userId,
      externalRef: unlockRef,
      idempotencyKey: unlockRef,
      description: `Unlock signup bonus $${amountUsd}`,
      metadata: { type: 'signup_bonus_unlock', amountUsd, unlockedBy: adminId },
      createdBy: adminId,
      reference: `Unlock signup bonus $${amountUsd}`,
    })

    await tx.notification.create({
      data: {
        userId,
        kind: 'bonus',
        title: `$${amountUsd} signup bonus unlocked`,
        body: `Your signup bonus is now available to use.`,
      },
    }).catch(() => null)
  })

  console.log(`[signup-bonus] unlocked $${amountUsd} for user ${userId} by ${adminId}`)
  return { unlocked: true, amountUsd }
}

export async function getSignupBonusStatus(userId: string): Promise<SignupBonusStatus> {
  const { enabled, amountUsd } = await readBonusConfig()
  const credit = await prisma.financialEvent.findUnique({ where: { externalRef: `signup-bonus:${userId}` } }).catch(() => null)
  const unlocked = await prisma.financialEvent.findUnique({ where: { externalRef: `signup-bonus-unlock:${userId}` } }).catch(() => null)
  const ab = await prisma.accountBalance.findUnique({ where: { userId_asset: { userId, asset: ASSET } } }).catch(() => null)
  const amountLockedUsd = ab ? Number(ab.lockedMinorUnits) / 100 : 0
  return {
    enabled,
    amountUsd,
    credited: !!credit,
    locked: !!credit && !unlocked && amountLockedUsd > 0,
    amountLockedUsd,
  }
}
