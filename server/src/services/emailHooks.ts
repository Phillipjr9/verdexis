/**
 * Fire-and-forget branded email hooks used across auth, wallet, and admin flows.
 * Never throws — failures are logged only so request paths stay resilient.
 */
import { emailService } from './email.js'

type UserLike = {
  id?: string
  email?: string | null
  name?: string | null
}

function safeName(user: UserLike): string {
  return (user.name || user.email || 'there').toString()
}

export async function notifyNewLogin(
  user: UserLike,
  meta: { ip?: string; userAgent?: string; location?: string } = {}
): Promise<void> {
  if (!user.email) return
  try {
    await emailService.sendSecurityAlert(
      user.email,
      safeName(user),
      {
        title: 'New sign-in detected',
        message:
          'We noticed a sign-in to your Verdexis account. If this was you, no action is needed. If not, secure your account immediately.',
        ip: meta.ip || 'Unknown',
        device: (meta.userAgent || 'Unknown').slice(0, 120),
        location: meta.location || 'Unknown',
      },
      user.id
    )
  } catch (err) {
    console.error('[emailHooks] notifyNewLogin failed:', err)
  }
}

export async function notifyPasswordChanged(user: UserLike, meta: { ip?: string } = {}): Promise<void> {
  if (!user.email) return
  try {
    await emailService.sendSecurityAlert(
      user.email,
      safeName(user),
      {
        title: 'Password changed',
        message:
          'Your Verdexis account password was changed successfully. If you did not make this change, reset your password and contact support immediately.',
        ip: meta.ip || 'Unknown',
        device: 'Account settings',
        location: 'Unknown',
      },
      user.id
    )
  } catch (err) {
    console.error('[emailHooks] notifyPasswordChanged failed:', err)
  }
}

export async function notifyPasswordResetRequested(user: UserLike, resetUrl: string): Promise<void> {
  if (!user.email) return
  try {
    await emailService.sendPasswordReset(user.email, safeName(user), resetUrl, user.id)
  } catch (err) {
    console.error('[emailHooks] notifyPasswordResetRequested failed:', err)
  }
}

export async function notifyTransaction(
  user: UserLike,
  tx: {
    id: string
    type: string
    amount: string | number
    currency: string
    from?: string
    to?: string
    fee?: string | number
  }
): Promise<void> {
  if (!user.email) return
  const now = new Date()
  try {
    await emailService.sendTransactionConfirmation(
      user.email,
      safeName(user),
      {
        id: tx.id,
        type: tx.type,
        amount: String(tx.amount),
        currency: tx.currency,
        from: tx.from || '—',
        to: tx.to || '—',
        fee: tx.fee !== undefined ? String(tx.fee) : '0',
        date: now.toLocaleDateString('en-US'),
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
      user.id
    )
  } catch (err) {
    console.error('[emailHooks] notifyTransaction failed:', err)
  }
}

export async function notifyWithdrawalEvent(
  user: UserLike,
  event: {
    status: 'pending' | 'approved' | 'rejected' | 'completed'
    amount: number | string
    asset: string
    destination?: string
    txHash?: string | null
    reason?: string
    fee?: number | string
    id?: string
  }
): Promise<void> {
  if (!user.email) return
  const typeLabel =
    event.status === 'pending'
      ? 'Withdrawal requested'
      : event.status === 'rejected'
        ? 'Withdrawal rejected'
        : event.status === 'approved'
          ? 'Withdrawal approved'
          : 'Withdrawal completed'

  try {
    await emailService.sendTransactionConfirmation(
      user.email,
      safeName(user),
      {
        id: event.id || event.txHash || `withdrawal-${Date.now()}`,
        type: typeLabel,
        amount: String(event.amount),
        currency: event.asset,
        from: 'Verdexis Wallet',
        to: event.destination || (event.txHash ? `Tx ${event.txHash.slice(0, 14)}…` : 'External wallet'),
        fee: event.fee !== undefined ? String(event.fee) : '0',
        date: new Date().toLocaleDateString('en-US'),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
      user.id
    )

    if (event.status === 'rejected' && event.reason) {
      await emailService.sendSecurityAlert(
        user.email,
        safeName(user),
        {
          title: 'Withdrawal rejected',
          message: `Your withdrawal of ${event.amount} ${event.asset} was rejected. Reason: ${event.reason}. Funds have been returned to your balance where applicable.`,
        },
        user.id
      )
    }
  } catch (err) {
    console.error('[emailHooks] notifyWithdrawalEvent failed:', err)
  }
}

export async function notifyDepositEvent(
  user: UserLike,
  event: {
    status: 'pending' | 'confirmed' | 'credited' | 'rejected'
    amount: number | string
    asset: string
    reference?: string
    id?: string
  }
): Promise<void> {
  if (!user.email) return
  const typeLabel =
    event.status === 'pending'
      ? 'Deposit received'
      : event.status === 'rejected'
        ? 'Deposit rejected'
        : event.status === 'confirmed'
          ? 'Deposit confirmed'
          : 'Deposit credited'

  try {
    await emailService.sendTransactionConfirmation(
      user.email,
      safeName(user),
      {
        id: event.id || event.reference || `deposit-${Date.now()}`,
        type: typeLabel,
        amount: String(event.amount),
        currency: event.asset,
        from: event.reference || 'External',
        to: 'Verdexis Wallet',
        fee: '0',
        date: new Date().toLocaleDateString('en-US'),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
      user.id
    )
  } catch (err) {
    console.error('[emailHooks] notifyDepositEvent failed:', err)
  }
}
