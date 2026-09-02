import { z } from 'zod'

export const transferBodySchema = z.object({
  recipientEmail: z.string().min(3).max(120),
  currency: z.string().min(1).max(10),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
  recipientAddress: z.string().min(8).max(100).optional(),
})

export type TransferBody = z.infer<typeof transferBodySchema>

export function mapBalances(
  rows: Array<{
    currency: string
    symbol?: string | null
    balance?: number | null
    available?: number | null
    locked?: number | null
  }>,
) {
  return rows.map((b) => ({
    currency: b.currency,
    symbol: b.symbol || (b.currency === 'USD' ? '$' : b.currency),
    balance: Number(b.balance ?? 0),
    available: Number(b.available ?? 0),
    locked: Number(b.locked ?? 0),
  }))
}

export function clampTransactionLimit(raw: unknown, fallback = 50): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(100, Math.max(1, Math.floor(n)))
}

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
