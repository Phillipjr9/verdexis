import { prisma } from '../db.js'
import { sendEmailNotification } from '../notificationService.js'
import { emailLogoUrl, emailLinks, customerEmailFooter } from '../config/email.js'
import { companyInfo } from '../config/company.js'

function fmtAmount(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 8,
  })
  return currency === 'USD' ? `$${formatted}` : `${formatted} ${currency}`
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildWalletMovementHtml(opts: {
  direction: 'credit' | 'debit'
  title: string
  body: string
  amount: number
  currency: string
  name?: string | null
  note?: string | null
  reference?: string | null
}): string {
  const isCredit = opts.direction === 'credit'
  const accent = isCredit ? '#0C8B44' : '#b91c1c'
  const badge = isCredit ? 'CREDIT' : 'DEBIT'
  const signed = `${isCredit ? '+' : '\u2212'}${fmtAmount(opts.amount, opts.currency)}`
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : 'Hello,'
  const logo = emailLogoUrl
  const dashboard = `${emailLinks.website}/dashboard`
  const support = emailLinks.support

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6eef6">
    <div style="padding:20px;text-align:center;background:linear-gradient(135deg,#0C8B44 0%,#00E676 100%)">
      <img src="${logo}" alt="${escapeHtml(companyInfo.name)}" width="48" height="48" style="display:block;margin:0 auto 8px;border-radius:8px" />
      <div style="color:#fff;font-size:13px;letter-spacing:0.12em;font-weight:600">${badge}</div>
      <div style="color:#fff;font-size:28px;font-weight:700;margin-top:6px">${signed}</div>
    </div>
    <div style="padding:28px 24px">
      <p style="margin:0 0 12px;font-size:16px">${greeting}</p>
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:${accent}">${escapeHtml(opts.title)}</h2>
      <p style="margin:0 0 20px;line-height:1.55;color:#334155">${escapeHtml(opts.body)}</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:12px 16px;color:#64748b;font-size:14px">Amount</td>
          <td style="padding:12px 16px;text-align:right;font-weight:700;color:${accent};font-size:16px">${signed}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0">Currency</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #e2e8f0">${escapeHtml(opts.currency)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0">Type</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #e2e8f0">${isCredit ? 'Account credit' : 'Account debit'}</td>
        </tr>
        ${opts.note ? `<tr>
          <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0">Note</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #e2e8f0">${escapeHtml(opts.note)}</td>
        </tr>` : ''}
        ${opts.reference ? `<tr>
          <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0">Reference</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #e2e8f0;font-family:monospace;font-size:12px">${escapeHtml(opts.reference)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0">When</td>
          <td style="padding:12px 16px;text-align:right;border-top:1px solid #e2e8f0">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;text-align:center">
        <a href="${dashboard}" style="display:inline-block;background:#0C8B44;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">View wallet</a>
      </p>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.5">
        If you did not expect this activity, contact
        <a href="${support}" style="color:#0C8B44">Verdexis support</a> immediately.
      </p>
    </div>
    <div style="padding:16px 24px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b">
      ${customerEmailFooter()}
    </div>
  </div>
</body>
</html>`
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
  note?: string | null
  reference?: string | null
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

  const html = buildWalletMovementHtml({
    direction,
    title,
    body,
    amount,
    currency,
    name: opts.name,
    note: opts.note,
    reference: opts.reference,
  })

  try {
    const ok = await sendEmailNotification(email, subject, body, html, {
      userId,
      kind,
      title,
      body,
      createWebNotification: false,
    })
    if (!ok) console.warn('[transfer-notify] email returned false for', email, '(SMTP may be disabled)')
    else console.log('[transfer-notify] email sent', { to: email, direction, amount, currency })
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
    note: opts.note,
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
    note: opts.note,
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
      note: opts.note,
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
      note: opts.note,
    }),
  ])
}
