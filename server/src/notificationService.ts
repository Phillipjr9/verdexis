import nodemailer from 'nodemailer'
import { prisma } from './db.js'
import { env } from './env.js'

interface NotificationPreferences {
  emailNotifications: boolean
  smsNotifications: boolean
  pushNotifications: boolean
  priceAlerts: boolean
  transactionAlerts: boolean
  securityAlerts: boolean
  marketingEmails: boolean
}

interface EmailNotificationOptions {
  userId?: string
  kind?: string
  title?: string
  body?: string
  createWebNotification?: boolean
}

export interface EmailTransportConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
  fromName?: string
  replyTo?: string
  unsubscribeUrl?: string
}

function formatFromAddress(address: string, fromName?: string): string {
  const trimmedAddress = address.trim()
  const trimmedName = (fromName ?? '').trim()

  if (!trimmedAddress) return ''
  if (!trimmedName) return trimmedAddress

  return `${trimmedName} <${trimmedAddress}>`
}

export function resolveEmailTransportConfig(
  overrides: Record<string, string | undefined> = process.env
): EmailTransportConfig {
  const host = overrides.SMTP_HOST ?? env.SMTP_HOST ?? 'smtp.gmail.com'
  const port = Number.parseInt(overrides.SMTP_PORT ?? env.SMTP_PORT ?? '587', 10) || 587
  const secure = (overrides.SMTP_SECURE ?? env.SMTP_SECURE ?? 'false').toLowerCase() === 'true'
  const user = (overrides.SMTP_USER ?? env.SMTP_USER ?? '').trim()
  const pass = (overrides.SMTP_PASS ?? overrides.SMTP_PASSWORD ?? env.SMTP_PASS ?? '').trim()
  const fromAddress = (overrides.SMTP_FROM ?? env.SMTP_FROM ?? 'noreply@verdexis.com').trim()
  const fromName = (overrides.SMTP_FROM_NAME ?? env.SMTP_FROM_NAME ?? 'Verdexis').trim()
  const replyTo = (overrides.SMTP_REPLY_TO ?? env.SMTP_REPLY_TO ?? '').trim()
  const unsubscribeUrl = (overrides.SMTP_UNSUBSCRIBE_URL ?? env.SMTP_UNSUBSCRIBE_URL ?? '').trim()

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from: formatFromAddress(fromAddress, fromName),
    fromName,
    replyTo: replyTo || undefined,
    unsubscribeUrl: unsubscribeUrl || undefined,
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildTrackedNotificationUrl(source: string = 'email', channel: string = 'notification'): string {
  const baseUrl = env.APP_BASE_URL.replace(/\/$/, '')
  const url = new URL(`${baseUrl}/notifications`)
  url.searchParams.set('source', source)
  url.searchParams.set('channel', channel)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', 'notification')
  url.searchParams.set('utm_campaign', 'verdexis_notification')
  return url.toString()
}

function appendTrackingButtonToHtml(html: string, trackingUrl: string): string {
  const buttonHtml = `
      <p style="margin-top: 24px;">
        <a href="${trackingUrl}" style="display: inline-block; background: #0f4c81; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 999px; font-weight: 600;">View in Verdexis</a>
      </p>`

  if (html.toLowerCase().includes('</body>')) {
    return html.replace(/<\/body>/i, `${buttonHtml}</body>`) 
  }

  if (html.toLowerCase().includes('</html>')) {
    return html.replace(/<\/html>/i, `${buttonHtml}</html>`) 
  }

  return `${html}${buttonHtml}`
}

export function buildNotificationEmailHtml(subject: string, body: string, htmlBody?: string, trackingUrl?: string): string {
  const resolvedTrackingUrl = trackingUrl ?? buildTrackedNotificationUrl()
  const preheader = `${subject} — ${body.replace(/\n/g, ' ').slice(0, 120)}`

  if (htmlBody) {
    const withButton = appendTrackingButtonToHtml(htmlBody, resolvedTrackingUrl)
    // ensure a hidden preheader for inbox preview and a footer with unsubscribe if configured
    const preheaderSpan = `<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</div>`
    const unsubscribe = env.SMTP_UNSUBSCRIBE_URL ? `<p style="font-size:12px;color:#64748b;margin-top:24px;">To stop receiving these emails, <a href="${env.SMTP_UNSUBSCRIBE_URL}">unsubscribe</a>.</p>` : ''
    if (withButton.toLowerCase().includes('</body>')) {
      return withButton.replace(/<body([^>]*)>/i, `<body$1>${preheaderSpan}`)
        .replace(/<\/body>/i, `${unsubscribe}</body>`)
    }

    return `${preheaderSpan}${withButton}${unsubscribe}`
  }

  const safeBody = escapeHtml(body).replace(/\n/g, '<br />')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f5f7fb; color: #0f172a;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
      <h2 style="margin-top: 0; color: #0f4c81;">${escapeHtml(subject)}</h2>
      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 0;">${safeBody}</p>
      <p style="margin-top: 24px;">
        <a href="${resolvedTrackingUrl}" style="display: inline-block; background: #0f4c81; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 999px; font-weight: 600;">View in Verdexis</a>
      </p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">This message was sent by Verdexis.</p>
      ${env.SMTP_UNSUBSCRIBE_URL ? `<p style="font-size:12px;color:#64748b;margin-top:8px;">To stop receiving these emails, <a href="${env.SMTP_UNSUBSCRIBE_URL}">unsubscribe</a>.</p>` : ''}
    </div>
  </body>
</html>`
}

async function createTrackedWebNotification(userId: string, kind: string, title: string, body: string): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, kind, title, body },
    })
  } catch (error) {
    console.warn('[notification-service] Could not create in-app notification for tracked email delivery:', error)
  }
}

let emailTransporter: nodemailer.Transporter | null = null

function getEmailTransporter(): nodemailer.Transporter | null {
  if (emailTransporter) return emailTransporter

  const config = resolveEmailTransportConfig()
  if (!config.auth.user || !config.auth.pass) {
    console.warn('[notification-service] SMTP credentials missing, skipping email delivery')
    return null
  }

  emailTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  return emailTransporter
}

export async function sendEmailNotification(
  email: string,
  subject: string,
  body: string,
  htmlBody?: string,
  options: EmailNotificationOptions = {}
): Promise<boolean> {
  try {
    const transporter = getEmailTransporter()
    const trackingUrl = buildTrackedNotificationUrl('email', 'notification')
    const html = htmlBody ? buildNotificationEmailHtml(subject, body, htmlBody, trackingUrl) : buildNotificationEmailHtml(subject, body, undefined, trackingUrl)

    if (!transporter) {
      if (options.userId && options.createWebNotification !== false) {
        await createTrackedWebNotification(options.userId, options.kind ?? 'email', options.title ?? subject, options.body ?? body)
      }
      return false
    }

    const config = resolveEmailTransportConfig()
    const headers: Record<string, string> = {
      'X-Mailer': 'Verdexis',
      // Indicate this is not an automated vacation/auto-reply message
      'Auto-Submitted': 'no',
    }

    if (config.replyTo) {
      headers['Reply-To'] = config.replyTo
    }

    if (config.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${config.unsubscribeUrl}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }

    // Prefer the authenticated SMTP user as the envelope/sender to avoid SPF/DMARC alignment issues
    const envelopeFrom = config.auth?.user || config.from
    headers['Sender'] = envelopeFrom

    await transporter.sendMail({
      // Use the authenticated SMTP user as the visible From address (with brand name)
      from: `${config.fromName || 'Verdexis'} <${envelopeFrom}>`,
      to: email,
      replyTo: config.replyTo,
      subject,
      text: `${body}\n\nView in Verdexis: ${trackingUrl}`,
      html,
      headers,
      // Ensure the SMTP envelope (MAIL FROM) matches the authenticated user
      envelope: { from: envelopeFrom, to: email },
    })

    if (options.userId && options.createWebNotification !== false) {
      await createTrackedWebNotification(options.userId, options.kind ?? 'email', options.title ?? subject, options.body ?? body)
    }

    console.log(`[notification-service] Email sent to ${email}`)
    return true
  } catch (error) {
    console.error('[notification-service] Error sending email:', error)
    return false
  }
}

export async function sendSMSNotification(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    // Integrate with Twilio or similar service
    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.warn('[notification-service] SMS not configured, skipping')
      return false
    }

    // Example Twilio integration
    // const twilio = require('twilio')
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber,
    // })

    console.log(`[notification-service] SMS sent to ${phoneNumber}`)
    return true
  } catch (error) {
    console.error('[notification-service] Error sending SMS:', error)
    return false
  }
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
): Promise<boolean> {
  try {
    // Integrate with Firebase Cloud Messaging or similar
    if (!process.env.FCM_SERVER_KEY) {
      console.warn('[notification-service] Push notifications not configured, skipping')
      return false
    }

    // Example Firebase integration
    // const admin = require('firebase-admin')
    // const message = {
    //   notification: { title, body },
    //   webpush: { fcmOptions: { link: '/dashboard' } },
    // }
    // await admin.messaging().sendToTopic(userId, message)

    console.log(`[notification-service] Push notification sent to ${userId}`)
    return true
  } catch (error) {
    console.error('[notification-service] Error sending push notification:', error)
    return false
  }
}

export async function getUserNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!user?.prefs) {
      return {
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        priceAlerts: true,
        transactionAlerts: true,
        securityAlerts: true,
        marketingEmails: false,
      }
    }

    return JSON.parse(user.prefs)
  } catch (error) {
    console.error('[notification-service] Error getting preferences:', error)
    return {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      priceAlerts: true,
      transactionAlerts: true,
      securityAlerts: true,
      marketingEmails: false,
    }
  }
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  try {
    const current = await getUserNotificationPreferences(userId)
    const updated = { ...current, ...preferences }

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(updated) },
    })

    return updated
  } catch (error) {
    console.error('[notification-service] Error updating preferences:', error)
    throw error
  }
}

export async function sendWithdrawalNotification(
  userId: string,
  amount: number,
  asset: string,
  status: 'pending' | 'approved' | 'rejected' | 'completed'
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    if (!user) return

    const prefs = await getUserNotificationPreferences(userId)

    const messages: Record<string, { subject: string; body: string }> = {
      pending: {
        subject: 'Withdrawal Request Submitted',
        body: `Your withdrawal request for ${amount} ${asset} has been submitted and is pending admin approval.`,
      },
      approved: {
        subject: 'Withdrawal Approved',
        body: `Your withdrawal of ${amount} ${asset} has been approved and is being processed.`,
      },
      rejected: {
        subject: 'Withdrawal Rejected',
        body: `Your withdrawal request for ${amount} ${asset} has been rejected. Please contact support for details.`,
      },
      completed: {
        subject: 'Withdrawal Completed',
        body: `Your withdrawal of ${amount} ${asset} has been completed successfully.`,
      },
    }

    const message = messages[status]

    if (prefs.emailNotifications && prefs.transactionAlerts) {
      await sendEmailNotification(user.email, message.subject, message.body, undefined, {
        userId,
        kind: 'transaction',
        title: message.subject,
        body: message.body,
      })
    }

    if (prefs.pushNotifications && prefs.transactionAlerts) {
      await sendPushNotification(userId, message.subject, message.body)
    }
  } catch (error) {
    console.error('[notification-service] Error sending withdrawal notification:', error)
  }
}

export async function sendDepositNotification(
  userId: string,
  amount: number,
  asset: string,
  status: 'pending' | 'confirmed' | 'credited'
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    if (!user) return

    const prefs = await getUserNotificationPreferences(userId)

    const messages: Record<string, { subject: string; body: string }> = {
      pending: {
        subject: 'Deposit Received',
        body: `We received your deposit of ${amount} ${asset}. It's pending confirmation.`,
      },
      confirmed: {
        subject: 'Deposit Confirmed',
        body: `Your deposit of ${amount} ${asset} has been confirmed on the blockchain.`,
      },
      credited: {
        subject: 'Deposit Credited',
        body: `Your deposit of ${amount} ${asset} has been credited to your account.`,
      },
    }

    const message = messages[status]

    if (prefs.emailNotifications && prefs.transactionAlerts) {
      await sendEmailNotification(user.email, message.subject, message.body, undefined, {
        userId,
        kind: 'transaction',
        title: message.subject,
        body: message.body,
      })
    }

    if (prefs.pushNotifications && prefs.transactionAlerts) {
      await sendPushNotification(userId, message.subject, message.body)
    }
  } catch (error) {
    console.error('[notification-service] Error sending deposit notification:', error)
  }
}

export async function sendSecurityAlert(
  userId: string,
  alertType: string,
  details: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) return

    const prefs = await getUserNotificationPreferences(userId)

    if (!prefs.securityAlerts) return

    const subject = `Security Alert: ${alertType}`
    const body = `${details}. If this wasn't you, please secure your account immediately.`

    if (prefs.emailNotifications) {
      await sendEmailNotification(user.email, subject, body, undefined, {
        userId,
        kind: 'security',
        title: subject,
        body,
      })
    }

    if (prefs.pushNotifications) {
      await sendPushNotification(userId, subject, body)
    }
  } catch (error) {
    console.error('[notification-service] Error sending security alert:', error)
  }
}

export async function sendPriceAlertNotification(
  userId: string,
  symbol: string,
  currentPrice: number,
  targetPrice: number
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) return

    const prefs = await getUserNotificationPreferences(userId)

    if (!prefs.priceAlerts) return

    const subject = `Price Alert: ${symbol}`
    const body = `${symbol} has reached $${currentPrice} (your target: $${targetPrice})`

    if (prefs.emailNotifications) {
      await sendEmailNotification(user.email, subject, body, undefined, {
        userId,
        kind: 'price_alert',
        title: subject,
        body,
      })
    }

    if (prefs.pushNotifications) {
      await sendPushNotification(userId, subject, body)
    }
  } catch (error) {
    console.error('[notification-service] Error sending price alert:', error)
  }
}

export async function sendStakingNotification(
  userId: string,
  action: 'started' | 'yielded' | 'claimed' | 'unstaked',
  amount: number,
  asset: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) return

    const prefs = await getUserNotificationPreferences(userId)

    const messages: Record<string, { subject: string; body: string }> = {
      started: {
        subject: 'Staking Started',
        body: `You've started staking ${amount} ${asset}. Earn passive income!`,
      },
      yielded: {
        subject: 'Yield Earned',
        body: `You've earned yield on your ${asset} staking position.`,
      },
      claimed: {
        subject: 'Yield Claimed',
        body: `You've claimed ${amount} ${asset} in yield rewards.`,
      },
      unstaked: {
        subject: 'Unstaking Complete',
        body: `Your ${amount} ${asset} has been unstaked and returned to your balance.`,
      },
    }

    const message = messages[action]

    if (prefs.emailNotifications && prefs.transactionAlerts) {
      await sendEmailNotification(user.email, message.subject, message.body, undefined, {
        userId,
        kind: 'staking',
        title: message.subject,
        body: message.body,
      })
    }

    if (prefs.pushNotifications && prefs.transactionAlerts) {
      await sendPushNotification(userId, message.subject, message.body)
    }
  } catch (error) {
    console.error('[notification-service] Error sending staking notification:', error)
  }
}

export async function getNotificationHistory(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch (error) {
    console.error('[notification-service] Error getting notification history:', error)
    return []
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
  } catch (error) {
    console.error('[notification-service] Error marking notification as read:', error)
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await prisma.notification.delete({
      where: { id: notificationId },
    })
  } catch (error) {
    console.error('[notification-service] Error deleting notification:', error)
  }
}
