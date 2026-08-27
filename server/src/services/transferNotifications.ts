import { prisma } from '../db.js'
import { sendEmailNotification } from '../notificationService.js'

function fmtAmount(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 8 })
  return currency === 'USD' ? `$${formatted}` : `${formatted} ${currency}`
}

/**
 * In-app + email notification for wallet credits/debits (admin funding & P2P).
 * Email failures are logged; they never block the ledger result.
 */
export async function notifyWalletMovement(opts: {
  userId: string
  email: string
  name?: string | null
  direction: 'credit' | 'debit'
  amount: number
  currency: string
  title: string
  body: string
  kind?: string
}): Promise<void> {
  const { userId, email, direction, amount, currency, title, body } = opts
  const kind = opts.kind || (direction === 'credit' ? 'deposit' : 'transfer')

  await prisma.notification
    .create({
      data: { userId, kind, title, body },
    })
    .catch((e) => console.warn('[transfer-notify] in-app failed', e instanceof Error ? e.message : e))

  const subject =
    direction === 'credit'
      ? `Verdexis: ${fmtAmount(amount, currency)} credited to your account`
      : `Verdexis: ${fmtAmount(amount, currency)} debited from your account`

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 12px;color:#0C8B44">${title}</h2>
      <p style="margin:0 0 16px;line-height:1.5">${body}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px 0;color:#64748b">Amount</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:${direction === 'credit' ? '#0C8B44' : '#b91c1c'}">
            ${direction === 'credit' ? '+' : '−'}${fmtAmount(amount, currency)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b">Currency</td>
          <td style="padding:8px 0;text-align:right">${currency}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b">Type</td>
          <td style="padding:8px 0;text-align:right">${direction === 'credit' ? 'Credit' : 'Debit'}</td>
        </tr>
      </table>
      <p style="font-size:13px;color:#64748b;margin-top:24px">
        If you did not expect this activity, contact Verdexis support immediately.
      </p>
    </div>
  `

  try {
    const ok = await sendEmailNotification(email, subject, body, html, {
      userId,
      kind,
      title,
      body,
      createWebNotification: false,
    })
    if (!ok) console.warn('[transfer-notify] email returned false for', email)
  } catch (e) {
    console.warn('[transfer-notify] email failed', e instanceof Error ? e.message : e)
  }
}

export async function notifyAdminFundedUser(opts: {
  userId: string
  email: string
  name?: string | null
  amount: number
  currency: string
  note?: string | null
}): Promise<void> {
  const amt = fmtAmount(opts.amount, opts.currency)
  await notifyWalletMovement({
    userId: opts.userId,
    email: opts.email,
    name: opts.name,
    direction: 'credit',
    amount: opts.amount,
    currency: opts.currency,
    title: `Funds received: ${amt}`,
    body: `An administrator credited ${amt} to your Verdexis wallet.${opts.note ? ` Note: ${opts.note}` : ''}`,
    kind: 'deposit',
  })
}

export async function notifyAdminDeductedUser(opts: {
  userId: string
  email: string
  name?: string | null
  amount: number
  currency: string
  note?: string | null
}): Promise<void> {
  const amt = fmtAmount(opts.amount, opts.currency)
  await notifyWalletMovement({
    userId: opts.userId,
    email: opts.email,
    name: opts.name,
    direction: 'debit',
    amount: opts.amount,
    currency: opts.currency,
    title: `Account debit: ${amt}`,
    body: `An administrator debited ${amt} from your Verdexis wallet.${opts.note ? ` Note: ${opts.note}` : ''}`,
    kind: 'transfer',
  })
}

export async function notifyPeerTransfer(opts: {
  sender: { id: string; email: string; name?: string | null }
  recipient: { id: string; email: string; name?: string | null }
  amount: number
  currency: string
  note?: string | null
}): Promise<void> {
  const amt = fmtAmount(opts.amount, opts.currency)
  const noteSuffix = opts.note ? ` Note: ${opts.note}` : ''
  const fromLabel = opts.sender.name || opts.sender.email
  const toLabel = opts.recipient.name || opts.recipient.email

  await Promise.all([
    notifyWalletMovement({
      userId: opts.sender.id,
      email: opts.sender.email,
      name: opts.sender.name,
      direction: 'debit',
      amount: opts.amount,
      currency: opts.currency,
      title: `Transfer sent: ${amt}`,
      body: `You sent ${amt} to ${toLabel}.${noteSuffix}`,
      kind: 'transfer',
    }),
    notifyWalletMovement({
      userId: opts.recipient.id,
      email: opts.recipient.email,
      name: opts.recipient.name,
      direction: 'credit',
      amount: opts.amount,
      currency: opts.currency,
      title: `Transfer received: ${amt}`,
      body: `You received ${amt} from ${fromLabel}.${noteSuffix}`,
      kind: 'deposit',
    }),
  ])
}
