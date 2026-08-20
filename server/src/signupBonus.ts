import { prisma } from './db.js'
import { recordLedgerTransaction } from './services/ledger.js'

const SIGNUP_BONUS_KEY = 'signup_bonus'

export type SignupBonusSettings = {
  enabled: boolean
  amountUsd: number
  note?: string
}

const DEFAULT_SETTINGS: SignupBonusSettings = {
  enabled: false,
  amountUsd: 0,
  note: '',
}

export async function readSignupBonusSettings(): Promise<SignupBonusSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SIGNUP_BONUS_KEY } })
  if (!row?.value) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(row.value) as Partial<SignupBonusSettings>
    const amountUsd = Number(parsed.amountUsd)
    return {
      enabled: parsed.enabled === true,
      amountUsd: Number.isFinite(amountUsd) && amountUsd >= 0 ? amountUsd : 0,
      note: typeof parsed.note === 'string' ? parsed.note : '',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Grant the configured signup bonus once per user (idempotent via externalRef).
 * Credits USD via ledger and applies a withdraw hold in user prefs so the
 * bonus cannot be withdrawn until admin unlocks (after external fee proof).
 * No-op when program is disabled or amount is 0.
 */
export async function grantSignupBonusIfEnabled(
  userId: string,
): Promise<{ granted: boolean; amountUsd?: number; reason?: string }> {
  const settings = await readSignupBonusSettings()
  if (!settings.enabled) return { granted: false, reason: 'program_disabled' }
  if (!(settings.amountUsd > 0)) return { granted: false, reason: 'zero_amount' }

  const externalRef = `signup_bonus:${userId}`

  // Fast path: already granted
  const existing = await prisma.financialEvent.findUnique({ where: { externalRef } }).catch(() => null)
  if (existing) return { granted: false, reason: 'already_granted' }

  const amount = settings.amountUsd
  const note = (settings.note || 'Welcome signup bonus').trim()

  try {
    await prisma.$transaction(async (tx) => {
      await recordLedgerTransaction({
        tx,
        userId,
        asset: 'USD',
        amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'signup_bonus',
        sourceType: 'signup_bonus',
        sourceId: externalRef,
        externalRef,
        idempotencyKey: externalRef,
        description: note,
        reference: note,
        subType: 'signup_bonus',
        recordTransaction: true,
        createdBy: 'system',
      })

      const user = await tx.user.findUnique({ where: { id: userId }, select: { prefs: true } })
      let prefs: Record<string, unknown> = {}
      try {
        if (user?.prefs) prefs = JSON.parse(user.prefs)
      } catch {
        prefs = {}
      }

      // Withdraw lock so bonus cannot be cashed out until admin confirms fee proof
      prefs.bonusLock = {
        active: true,
        amountUsd: amount,
        currency: 'USD',
        amount,
        grantedAt: new Date().toISOString(),
        grantedBy: 'system',
        source: 'signup_bonus',
        message:
          'Signup bonus is locked for withdrawal. Pay the required processing fee (wire/ACH/crypto) and submit proof to unlock.',
        transactionRef: externalRef,
      }

      await tx.user.update({
        where: { id: userId },
        data: { prefs: JSON.stringify(prefs) },
      })

      await tx.notification.create({
        data: {
          userId,
          kind: 'deposit',
          title: `Welcome bonus: $${amount.toLocaleString()} USD`,
          body:
            `${note}\n\n⚠️ Withdrawal lock active — submit external fee payment proof to unlock withdrawals.`,
        },
      }).catch(() => {})
    })

    return { granted: true, amountUsd: amount }
  } catch (err) {
    // Race: another request may have created the event first
    const race = await prisma.financialEvent.findUnique({ where: { externalRef } }).catch(() => null)
    if (race) return { granted: false, reason: 'already_granted' }
    console.error('[signupBonus] grant failed', err instanceof Error ? err.message : err)
    return { granted: false, reason: 'error' }
  }
}

export { SIGNUP_BONUS_KEY, DEFAULT_SETTINGS as DEFAULT_SIGNUP_BONUS_SETTINGS }
