/**
 * Pure helpers for wallet routes — unit-tested in wallet.test.ts
 */
import { z } from 'zod'

export const transferBodySchema = z.object({
  recipientEmail: z.string().email(),
  currency: z.string().min(1).max(10),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
})

export type TransferBody = z.infer<typeof transferBodySchema>

export type WalletBalanceRow = {
  currency: string
  balance: number | string | { toString(): string }
  available: number | string | { toString(): string }
}

/** Map DB wallet balance rows to API shape */
export function mapBalances(balances: WalletBalanceRow[]) {
  return balances.map((b) => {
    const balance = Number(b.balance)
    const available = Number(b.available)
    return {
      currency: b.currency,
      symbol: b.currency === 'USD' ? '$' : b.currency,
      balance,
      available,
      locked: balance - available,
    }
  })
}

/** Clamp transaction list limit query param */
export function clampTransactionLimit(raw: unknown, fallback = 50): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(100, Math.max(1, Math.floor(n)))
}

/** Normalize email for recipient lookup */
export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

export type TransferGateUser = {
  id?: string
  suspended?: boolean | null
  holdActive?: boolean | null
  holdType?: string | null
  email?: string | null
  name?: string | null
}

export type TransferGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Validate whether a sender may transfer to a recipient.
 * Pure: no DB / network.
 */
export function evaluateTransferGate(opts: {
  senderId: string
  sender: TransferGateUser | null
  recipient: TransferGateUser | null
  amount: number
  available: number | null
}): TransferGateResult {
  const { senderId, sender, recipient, amount, available } = opts

  if (!recipient) {
    return { ok: false, status: 404, error: 'Recipient not found' }
  }
  if (recipient.id === senderId) {
    return { ok: false, status: 400, error: 'Cannot transfer to yourself' }
  }
  if (recipient.suspended) {
    return { ok: false, status: 400, error: 'Recipient account is suspended' }
  }
  if (!sender || sender.suspended) {
    return { ok: false, status: 403, error: 'Account not allowed to transfer' }
  }
  if (sender.holdActive && (sender.holdType === 'all' || sender.holdType === 'transfer')) {
    return { ok: false, status: 403, error: 'Transfers are on hold for this account' }
  }
  if (available == null || available < amount) {
    return { ok: false, status: 400, error: 'Insufficient available balance' }
  }
  return { ok: true }
}

/** Build ledger idempotency key base for a user transfer */
export function buildTransferKeyBase(opts: {
  clientKey?: string
  senderId: string
  recipientId: string
  currency: string
  amount: number
  uuid: string
}): string {
  if (opts.clientKey) return `user_transfer:${opts.clientKey}`
  return `user_transfer:${opts.senderId}:${opts.recipientId}:${opts.currency}:${opts.amount}:${opts.uuid}`
}

export function parseWithdrawalFeeRate(raw: string | null | undefined): number {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw)
    return Number(parsed.ratePct) || 0
  } catch {
    return 0
  }
}
