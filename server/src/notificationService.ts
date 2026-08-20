import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { prisma } from './db.js'
import { env } from './env.js'
import { customerEmailAddress, customerEmailName, adminEmailAddress, adminEmailRecipients, customerEmailFooter, emailReplyTo, formatEmailAddress, appUrl } from './config/email.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface EmailTransportConfig {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
  from: string
  fromAddress: string
  fromName?: string
  replyTo?: string
  unsubscribeUrl?: string
}

export function resolveEmailTransportConfig(
  overrides: Record<string, string | undefined> = process.env,
): EmailTransportConfig {
  const host = overrides.SMTP_HOST ?? env.SMTP_HOST ?? 'smtp.gmail.com'
  const port = Number.parseInt(overrides.SMTP_PORT ?? env.SMTP_PORT ?? '587', 10) || 587
  const secure = (overrides.SMTP_SECURE ?? env.SMTP_SECURE ?? 'false').toLowerCase() === 'true'
  const user = (overrides.SMTP_USER ?? env.SMTP_USER ?? '').trim()
  const pass = (overrides.SMTP_PASS ?? overrides.SMTP_PASSWORD ?? env.SMTP_PASS ?? '').trim()
  const fromAddress = (overrides.EMAIL_FROM_ADDRESS ?? overrides.SMTP_FROM ?? env.EMAIL_FROM_ADDRESS ?? env.SMTP_FROM ?? customerEmailAddress).trim()
  const fromName = (overrides.EMAIL_FROM_NAME ?? overrides.SMTP_FROM_NAME ?? env.EMAIL_FROM_NAME ?? env.SMTP_FROM_NAME ?? customerEmailName).trim()
  const replyTo = (overrides.EMAIL_REPLY_TO ?? overrides.SMTP_REPLY_TO ?? env.EMAIL_REPLY_TO ?? env.SMTP_REPLY_TO ?? emailReplyTo ?? '').trim()
  const unsubscribeUrl = (overrides.SMTP_UNSUBSCRIBE_URL ?? env.SMTP_UNSUBSCRIBE_URL ?? '').trim()
  return { host, port, secure, auth: { user, pass }, from: formatEmailAddress(fromAddress, fromName), fromAddress, fromName, replyTo: replyTo || undefined, unsubscribeUrl: unsubscribeUrl || undefined }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&' + 'amp;').replace(/</g, '&' + 'lt;').replace(/>/g, '&' + 'gt;').replace(/"/g, '&' + 'quot;').replace(/'/g, '&#39;')
}

function buildTrackedNotificationUrl(source = 'email', channel = 'notification'): string {
  const baseUrl = env.APP_BASE_URL.replace(/\/$/, '')
  const url = new URL(`${baseUrl}/notifications`)
  url.searchParams.set('source', source)
  url.searchParams.set('channel', channel)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', 'notification')
  url.searchParams.set('utm_campaign', 'verdexis_notification')
  return url.toString()
}

export function buildNotificationEmailHtml(subject: string, body: string, htmlBody?: string, trackingUrl?: string): string {
  const resolvedTrackingUrl = trackingUrl ?? buildTrackedNotificationUrl()
  if (htmlBody) {
    return htmlBody.includes('</body>')
      ? htmlBody.replace(/<\/body>/i, `<p><a href="${resolvedTrackingUrl}">View in Verdexis</a></p>${customerEmailFooter()}</body>`)
      : `${htmlBody}<p><a href="${resolvedTrackingUrl}">View in Verdexis</a></p>${customerEmailFooter()}`
  }
  const safeBody = escapeHtml(body).replace(/\n/g, '<br />')
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px"><h2>${escapeHtml(subject)}</h2><p>${safeBody}</p><p><a href="${resolvedTrackingUrl}">View in Verdexis</a></p>${customerEmailFooter()}</body></html>`
}

let emailTransporter: import('nodemailer').Transporter | null = null

function buildSmtpTransportConfig(config: EmailTransportConfig): SMTPTransport.Options {
  const host = config.host.toLowerCase()
  const isMailgun = host.includes('mailgun')
  const useStartTls = isMailgun || config.port === 587 || config.port === 2587
  return { host: config.host, port: config.port, secure: config.secure, auth: config.auth, requireTLS: useStartTls, connectionTimeout: 20_000, greetingTimeout: 20_000, socketTimeout: 20_000, tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' } }
}

function getEmailTransporter() {
  if (emailTransporter) return emailTransporter
  const config = resolveEmailTransportConfig()
  if (!config.auth.user || !config.auth.pass) {
    console.warn('[notification-service] SMTP credentials missing, skipping email delivery')
    return null
  }
  emailTransporter = nodemailer.createTransport(buildSmtpTransportConfig(config))
  return emailTransporter
}

async function createTrackedWebNotification(userId: string, kind: string, title: string, body: string) {
  try { await prisma.notification.create({ data: { userId, kind, title, body } }) }
  catch (error) { console.warn('[notification-service] Could not create in-app notification:', error) }
}

export async function sendEmailNotification(email: string, subject: string, body: string, htmlBody?: string, options: { userId?: string; kind?: string; title?: string; body?: string; createWebNotification?: boolean } = {}): Promise<boolean> {
  try {
    const transporter = getEmailTransporter()
    const trackingUrl = buildTrackedNotificationUrl()
    const html = buildNotificationEmailHtml(subject, body, htmlBody, trackingUrl)
    if (!transporter) {
      if (options.userId && options.createWebNotification !== false) await createTrackedWebNotification(options.userId, options.kind ?? 'email', options.title ?? subject, options.body ?? body)
      return false
    }
    const config = resolveEmailTransportConfig()
    const envelopeFrom = config.auth.user || config.fromAddress
    await transporter.sendMail({ from: config.from, to: email, replyTo: config.replyTo, subject, text: `${body}\n\nView in Verdexis: ${trackingUrl}`, html, headers: { 'X-Mailer': 'Verdexis', Sender: formatEmailAddress(envelopeFrom, config.fromName) }, envelope: { from: envelopeFrom, to: email } })
    if (options.userId && options.createWebNotification !== false) await createTrackedWebNotification(options.userId, options.kind ?? 'email', options.title ?? subject, options.body ?? body)
    console.log(`[notification-service] Email sent to ${email}`)
    return true
  } catch (error) {
    console.error('[notification-service] Error sending email:', error)
    return false
  }
}

export type AdminEmailOptions = { important?: boolean; recipients?: string[] }

function resolveAdminRecipients(requested?: string[]): string[] {
  const allow = new Set(adminEmailRecipients.map((a) => a.trim().toLowerCase()).filter((a) => EMAIL_RE.test(a)))
  const primary = String(adminEmailAddress || '').trim().toLowerCase()
  if (primary && EMAIL_RE.test(primary)) allow.add(primary)
  if (requested?.length) {
    const matched = Array.from(new Set(requested.map((a) => a.trim().toLowerCase()).filter((a) => allow.has(a) && EMAIL_RE.test(a))))
    if (matched.length) return matched
    console.warn('[notification-service] Requested admin recipients were not on ADMIN_EMAIL allowlist; falling back to allowlist', { requested: requested.map((a) => a.trim().toLowerCase()), allowlist: Array.from(allow) })
  }
  return Array.from(allow)
}

export async function sendAdminEmailNotification(subject: string, body: string, htmlBody?: string, recipientsOrOptions: string[] | AdminEmailOptions = adminEmailRecipients): Promise<boolean> {
  try {
    const transporter = getEmailTransporter()
    if (!transporter) { console.warn('[notification-service] Admin email skipped: SMTP not configured'); return false }
    const config = resolveEmailTransportConfig()
    const options: AdminEmailOptions = Array.isArray(recipientsOrOptions) ? { recipients: recipientsOrOptions } : recipientsOrOptions || {}
    const recipients = resolveAdminRecipients(options.recipients)
    if (!recipients.length) {
      console.warn('[notification-service] Admin email blocked: ADMIN_EMAIL / ADMIN_EMAILS is empty or invalid. Set them on Render (server env).')
      return false
    }
    const safeSubject = String(subject || 'Verdexis admin alert').replace(/[\r\n]+/g, ' ').slice(0, 200)
    const fromAddress = String(adminEmailAddress || 'admin@verdexisgroup.com').trim().toLowerCase()
    const from = formatEmailAddress(fromAddress, 'Verdexis Admin')
    const envelopeFrom = (config.auth?.user && config.auth.user.trim()) || fromAddress
    const headers: Record<string, string> = { 'X-Mailer': 'Verdexis', 'X-Verdexis-Channel': 'admin-internal', 'Auto-Submitted': 'auto-generated', Precedence: 'bulk', Sender: formatEmailAddress(envelopeFrom, 'Verdexis Admin') }
    if (options.important) { headers.Importance = 'high'; headers['X-Priority'] = '1'; headers.Priority = 'urgent'; headers['X-MSMail-Priority'] = 'High' }
    const safeHtml = htmlBody ?? `<p style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5">${escapeHtml(body).replace(/\n/g, '<br />')}</p>`
    console.log('[notification-service] Sending admin email:', { toCount: recipients.length, subject: safeSubject.slice(0, 80), important: !!options.important, from: fromAddress })
    await transporter.sendMail({ from, to: recipients, subject: safeSubject, text: body, html: safeHtml, headers, envelope: { from: envelopeFrom, to: recipients } })
    return true
  } catch (error) {
    console.error('[notification-service] Error sending admin email:', error)
    return false
  }
}

export type NewUserNotifyPayload = {
  id: string
  email: string
  name?: string | null
  username?: string | null
  investmentId?: string | null
  role?: string | null
  createdAt?: Date | string | null
  address?: string | null
  phone?: string | null
  /** Client IP captured at signup or verification */
  ip?: string | null
  userAgent?: string | null
  /** Pre-resolved location string if already known */
  location?: string | null
  /** How the user arrived (referral code, campaign, referer, etc.) */
  source?: string | null
}

type GeoLookupResult = {
  locationLabel: string
  country?: string
  region?: string
  city?: string
  timezone?: string
  isp?: string
  lat?: number
  lon?: number
}

/** Resolve approximate location from a public IP (ip-api.com free endpoint). Never throws. */
async function lookupIpLocation(ip: string | null | undefined): Promise<GeoLookupResult | null> {
  const raw = String(ip || '').trim()
  if (!raw) return null
  // Skip private / local addresses
  if (
    raw === '127.0.0.1' ||
    raw === '::1' ||
    raw.startsWith('10.') ||
    raw.startsWith('192.168.') ||
    raw.startsWith('172.16.') ||
    raw.startsWith('172.17.') ||
    raw.startsWith('172.18.') ||
    raw.startsWith('172.19.') ||
    raw.startsWith('172.2') ||
    raw.startsWith('172.3') ||
    raw.includes('localhost')
  ) {
    return { locationLabel: 'Local / private network' }
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4_000)
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(raw)}?fields=status,message,country,regionName,city,timezone,isp,lat,lon,query`,
      { signal: controller.signal },
    )
    clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as {
      status?: string
      country?: string
      regionName?: string
      city?: string
      timezone?: string
      isp?: string
      lat?: number
      lon?: number
    }
    if (data.status !== 'success') return null
    const parts = [data.city, data.regionName, data.country].filter(Boolean)
    return {
      locationLabel: parts.length ? parts.join(', ') : 'Unknown',
      country: data.country,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      isp: data.isp,
      lat: data.lat,
      lon: data.lon,
    }
  } catch (err) {
    console.warn('[notification-service] IP geo lookup failed:', err)
    return null
  }
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;color:#0f172a;font-weight:500">${escapeHtml(value)}</td></tr>`
}

export async function notifyAdminNewUser(user: NewUserNotifyPayload): Promise<boolean> {
  try {
    const email = String(user.email || '').trim().toLowerCase()
    if (!email) return false
    if (adminEmailRecipients.includes(email) || email === String(adminEmailAddress || '').toLowerCase()) return false

    const name = (user.name || '').trim() || '—'
    const username = (user.username || '').trim() || '—'
    const investmentId = user.investmentId || '—'
    const role = user.role || 'user'
    const address = (user.address || '').trim() || '—'
    const phone = (user.phone || '').trim() || '—'
    const ip = (user.ip || '').trim() || '—'
    const userAgent = (user.userAgent || '').trim() || '—'
    const source = (user.source || '').trim() || 'direct / unknown'
    const verifiedAt = new Date().toISOString()
    const createdAt = user.createdAt
      ? (user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt))
      : '—'

    let locationLabel = (user.location || '').trim()
    let geo: GeoLookupResult | null = null
    if (!locationLabel && ip !== '—') {
      geo = await lookupIpLocation(ip)
      locationLabel = geo?.locationLabel || '—'
    }
    if (!locationLabel) locationLabel = '—'

    const base = (appUrl || env.APP_BASE_URL || 'https://www.verdexisgroup.com').replace(/\/$/, '')
    const adminUsersUrl = `${base}/admin/users`
    const adminUserDetailUrl = `${base}/admin/users/${encodeURIComponent(user.id)}`

    const subject = `[IMPORTANT] New Verdexis user registered: ${email}`

    const bodyLines = [
      'A new user has completed email verification and is now fully registered.',
      '',
      '── Account ──',
      `Name: ${name}`,
      `Username: ${username}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `User ID: ${user.id}`,
      `Investment ID: ${investmentId}`,
      `Role: ${role}`,
      `Account created: ${createdAt}`,
      `Email verified at: ${verifiedAt}`,
      `Signup source: ${source}`,
      '',
      '── Location & contact ──',
      `Address (provided at signup): ${address}`,
      `Approximate location (IP): ${locationLabel}`,
      `IP address: ${ip}`,
    ]
    if (geo?.timezone) bodyLines.push(`Timezone: ${geo.timezone}`)
    if (geo?.isp) bodyLines.push(`ISP: ${geo.isp}`)
    if (geo?.lat != null && geo?.lon != null) bodyLines.push(`Coordinates: ${geo.lat}, ${geo.lon}`)
    bodyLines.push(`User-Agent: ${userAgent}`)
    bodyLines.push('')
    bodyLines.push(`Admin users list: ${adminUsersUrl}`)
    bodyLines.push(`User detail: ${adminUserDetailUrl}`)
    const body = bodyLines.join('\n')

    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;max-width:640px">
  <p style="margin:0 0 12px"><strong style="color:#b91c1c">IMPORTANT</strong> — New registered user</p>
  <p style="margin:0 0 16px;color:#334155">A new user completed email verification and is fully registered on Verdexis.</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px">
    <tbody>
      ${row('Name', name)}
      ${row('Username', username)}
      ${row('Email', email)}
      ${row('Phone', phone)}
      ${row('User ID', user.id)}
      ${row('Investment ID', investmentId)}
      ${row('Role', role)}
      ${row('Account created', createdAt)}
      ${row('Email verified', verifiedAt)}
      ${row('Signup source', source)}
      ${row('Address (signup)', address)}
      ${row('Location (IP)', locationLabel)}
      ${row('IP address', ip)}
      ${geo?.timezone ? row('Timezone', geo.timezone) : ''}
      ${geo?.isp ? row('ISP', geo.isp) : ''}
      ${row('User-Agent', userAgent.length > 120 ? userAgent.slice(0, 117) + '…' : userAgent)}
    </tbody>
  </table>
  <p style="margin:0">
    <a href="${escapeHtml(adminUserDetailUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px">Open user</a>
    <a href="${escapeHtml(adminUsersUrl)}" style="display:inline-block;padding:10px 16px;background:#e2e8f0;color:#0f172a;text-decoration:none;border-radius:6px">All users</a>
  </p>
</div>`

    const ok = await sendAdminEmailNotification(subject, body, html, { important: true })
    if (ok) console.log(`[notification-service] New-user admin alert sent for ${email} (location: ${locationLabel}, source: ${source})`)
    else console.warn(`[notification-service] New-user admin alert FAILED for ${email}`)
    return ok
  } catch (error) {
    console.error('[notification-service] Error notifying admin of new user:', error)
    return false
  }
}

export async function sendSMSNotification(phoneNumber: string, _message: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID) { console.warn('[notification-service] SMS not configured, skipping'); return false }
  console.log(`[notification-service] SMS stub to ${phoneNumber}`); return true
}

export async function sendPushNotification(userId: string, title: string, _body: string): Promise<boolean> {
  if (!process.env.FCM_SERVER_KEY) { console.warn('[notification-service] Push not configured, skipping'); return false }
  console.log(`[notification-service] Push stub to ${userId}: ${title}`); return true
}

interface NotificationPreferences { emailNotifications: boolean; smsNotifications: boolean; pushNotifications: boolean; priceAlerts: boolean; transactionAlerts: boolean; securityAlerts: boolean; marketingEmails: boolean }
const defaultPrefs: NotificationPreferences = { emailNotifications: true, smsNotifications: false, pushNotifications: true, priceAlerts: true, transactionAlerts: true, securityAlerts: true, marketingEmails: false }

export async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
    if (!user?.prefs) return { ...defaultPrefs }
    return { ...defaultPrefs, ...JSON.parse(user.prefs) }
  } catch { return { ...defaultPrefs } }
}

export async function updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const current = await getUserNotificationPreferences(userId)
  const updated = { ...current, ...preferences }
  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.stringify(updated) } })
  return updated
}

export async function sendWithdrawalNotification(userId: string, amount: number, asset: string, status: 'pending' | 'approved' | 'rejected' | 'completed'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId)
  const messages: Record<string, { subject: string; body: string }> = {
    pending: { subject: 'Withdrawal Request Submitted', body: `Your withdrawal request for ${amount} ${asset} has been submitted and is pending admin approval.` },
    approved: { subject: 'Withdrawal Approved', body: `Your withdrawal of ${amount} ${asset} has been approved and is being processed.` },
    rejected: { subject: 'Withdrawal Rejected', body: `Your withdrawal request for ${amount} ${asset} has been rejected. Please contact support for details.` },
    completed: { subject: 'Withdrawal Completed', body: `Your withdrawal of ${amount} ${asset} has been completed successfully.` },
  }
  const message = messages[status]; if (!message) return
  if (prefs.emailNotifications && prefs.transactionAlerts) await sendEmailNotification(user.email, message.subject, message.body, undefined, { userId, kind: 'transaction', title: message.subject, body: message.body })
}

export async function sendDepositNotification(userId: string, amount: number, asset: string, status: 'pending' | 'confirmed' | 'credited'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId)
  const messages: Record<string, { subject: string; body: string }> = {
    pending: { subject: 'Deposit Received', body: `We received your deposit of ${amount} ${asset}. It's pending confirmation.` },
    confirmed: { subject: 'Deposit Confirmed', body: `Your deposit of ${amount} ${asset} has been confirmed on the blockchain.` },
    credited: { subject: 'Deposit Credited', body: `Your deposit of ${amount} ${asset} has been credited to your account.` },
  }
  const message = messages[status]; if (!message) return
  if (prefs.emailNotifications && prefs.transactionAlerts) await sendEmailNotification(user.email, message.subject, message.body, undefined, { userId, kind: 'transaction', title: message.subject, body: message.body })
}

export async function sendSecurityAlert(userId: string, alertType: string, details: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId); if (!prefs.securityAlerts) return
  const subject = `Security Alert: ${alertType}`
  const body = `${details}. If this wasn't you, please secure your account immediately.`
  if (prefs.emailNotifications) await sendEmailNotification(user.email, subject, body, undefined, { userId, kind: 'security', title: subject, body })
}

export async function sendPriceAlertNotification(userId: string, symbol: string, currentPrice: number, targetPrice: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId); if (!prefs.priceAlerts) return
  const subject = `Price Alert: ${symbol}`
  const body = `${symbol} has reached $${currentPrice} (your target: $${targetPrice})`
  if (prefs.emailNotifications) await sendEmailNotification(user.email, subject, body, undefined, { userId, kind: 'price_alert', title: subject, body })
}

export async function sendStakingNotification(userId: string, action: 'started' | 'yielded' | 'claimed' | 'unstaked', amount: number, asset: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId)
  const messages: Record<string, { subject: string; body: string }> = {
    started: { subject: 'Staking Started', body: `You've started staking ${amount} ${asset}. Earn passive income!` },
    yielded: { subject: 'Yield Earned', body: `You've earned yield on your ${asset} staking position.` },
    claimed: { subject: 'Yield Claimed', body: `You've claimed ${amount} ${asset} in yield rewards.` },
    unstaked: { subject: 'Unstaking Complete', body: `Your ${amount} ${asset} has been unstaked and returned to your balance.` },
  }
  const message = messages[action]
  if (prefs.emailNotifications && prefs.transactionAlerts) await sendEmailNotification(user.email, message.subject, message.body, undefined, { userId, kind: 'staking', title: message.subject, body: message.body })
}

export async function getNotificationHistory(userId: string, limit = 50) {
  try { return await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }) } catch { return [] }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try { await prisma.notification.update({ where: { id: notificationId }, data: { read: true } }) } catch (e) { console.error('[notification-service] mark read failed:', e) }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try { await prisma.notification.delete({ where: { id: notificationId } }) } catch (e) { console.error('[notification-service] delete failed:', e) }
}
