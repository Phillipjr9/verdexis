import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { env } from '../env.js'
import { normalizeFromAddress, preferSupportReplyTo } from './emailFrom.js'

export function listAllowedFromAddresses(): { address: string; label: string }[] {
  const seen = new Set<string>()
  const out: { address: string; label: string }[] = []
  const add = (raw: string | undefined, label: string) => {
    const address = normalizeFromAddress((raw || '').trim())
    if (!address || !address.includes('@') || seen.has(address.toLowerCase())) return
    seen.add(address.toLowerCase())
    out.push({ address, label })
  }
  add(env.EMAIL_FROM_ADDRESS || env.SMTP_FROM || env.SMTP_USER, 'Default (customer mail)')
  add(env.ADMIN_EMAIL_ADDRESS || env.ADMIN_EMAIL, 'Admin')
  add(env.EMAIL_REPLY_TO || env.SMTP_REPLY_TO, 'Reply-To / support')
  const primary = out[0]?.address || ''
  const domain = primary.split('@')[1]
  if (domain) {
    add(`noreply@${domain}`, 'No-reply')
    add(`support@${domain}`, 'Support')
    add(`invites@${domain}`, 'Invites')
  }
  return out
}

export function resolveAllowedFromAddress(requested?: string): string {
  const allowed = listAllowedFromAddresses()
  const fallback = allowed[0]?.address || normalizeFromAddress((env.EMAIL_FROM_ADDRESS || env.SMTP_FROM || env.SMTP_USER || '').trim())
  if (!requested) return fallback
  const want = normalizeFromAddress(requested.trim()).toLowerCase()
  const hit = allowed.find((a) => a.address.toLowerCase() === want)
  return hit?.address || fallback
}

export async function sendViaConfiguredSmtp(
  to: string,
  subject: string,
  text: string,
  html: string,
  fromOverride?: string,
): Promise<boolean> {
  const user = (env.SMTP_USER || '').trim()
  const pass = (env.SMTP_PASS || '').trim()
  const host = (env.SMTP_HOST || 'smtp.gmail.com').trim()
  if (!user || !pass) {
    console.error('[smtp] invite/OTP send aborted: SMTP_USER or SMTP_PASS missing')
    return false
  }

  const fromAddress = resolveAllowedFromAddress(fromOverride)
  const fromName = (env.EMAIL_FROM_NAME || env.SMTP_FROM_NAME || 'Verdexis').trim()
  if (!fromAddress) {
    console.error('[smtp] send aborted: EMAIL_FROM_ADDRESS / SMTP_FROM missing')
    return false
  }

  const from = `${fromName} <${fromAddress}>`
  const envelopeFrom = fromAddress
  const replyTo = preferSupportReplyTo(fromAddress, (env.EMAIL_REPLY_TO || env.SMTP_REPLY_TO || '').trim()) || undefined

  const configured = Number(env.SMTP_PORT) || 0
  const preferred = configured || (host.toLowerCase().includes('mailgun') ? 2525 : 587)
  const ports = [preferred, ...[2525, 587, 465].filter((p) => p !== preferred)]

  const mail = {
    from,
    to,
    replyTo,
    subject,
    text,
    html,
    headers: {
      'X-Mailer': 'Verdexis',
      'X-Priority': '3',
      'Importance': 'normal',
      'Auto-Submitted': 'no',
      'X-Originating-IP': '[127.0.0.1]',
      'List-Unsubscribe': '<mailto:unsubscribe@verdexis.com>',
      'Precedence': 'bulk',
      ...(replyTo ? { 'Reply-To': replyTo } : {}),
    },
    envelope: { from: envelopeFrom, to },
  }

  for (const port of ports) {
    try {
      const secure = port === 465 || String(env.SMTP_SECURE || 'false').toLowerCase() === 'true'
      const options: SMTPTransport.Options = {
        host,
        port,
        secure,
        auth: { user, pass },
        requireTLS: !secure && (host.toLowerCase().includes('mailgun') || port === 587 || port === 2525 || port === 2587),
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 15_000,
        tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
      }
      const transporter = nodemailer.createTransport(options)
      const info = await transporter.sendMail(mail)
      console.log('[smtp] sent', {
        to,
        port,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        from: fromAddress,
      })
      return true
    } catch (error) {
      const err = error as { message?: string; code?: string }
      const msg = String(err?.message || error)
      const isTimeout = /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg)
      console.error('[smtp] send error', { to, port, message: err?.message, code: err?.code, willRetry: isTimeout, host })
      if (!isTimeout) break
    }
  }
  return false
}
