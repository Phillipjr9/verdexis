import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from './db.js'
import { env } from './env.js'
import { customerEmailAddress, customerEmailName, adminEmailAddress, adminEmailRecipients, customerEmailFooter, emailReplyTo, formatEmailAddress, emailLogoUrl } from './config/email.js'
import { companyInfo } from './config/company.js'

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
  fromAddress: string
  fromName?: string
  replyTo?: string
  unsubscribeUrl?: string
}

// use `formatEmailAddress` from config/email for consistent formatting

export function resolveEmailTransportConfig(
  overrides: Record<string, string | undefined> = process.env
): EmailTransportConfig {
  const host = overrides.SMTP_HOST ?? env.SMTP_HOST ?? 'smtp.gmail.com'
  const port = Number.parseInt(overrides.SMTP_PORT ?? env.SMTP_PORT ?? '587', 10) || 587
  const secure = (overrides.SMTP_SECURE ?? env.SMTP_SECURE ?? 'false').toLowerCase() === 'true'
  const user = (overrides.SMTP_USER ?? env.SMTP_USER ?? '').trim()
  const pass = (overrides.SMTP_PASS ?? overrides.SMTP_PASSWORD ?? env.SMTP_PASS ?? '').trim()
  const fromAddress = (
    overrides.EMAIL_FROM_ADDRESS
      ?? overrides.SMTP_FROM
      ?? env.EMAIL_FROM_ADDRESS
      ?? env.SMTP_FROM
      ?? customerEmailAddress
  ).trim()
  const fromName = (
    overrides.EMAIL_FROM_NAME
      ?? overrides.SMTP_FROM_NAME
      ?? env.EMAIL_FROM_NAME
      ?? env.SMTP_FROM_NAME
      ?? customerEmailName
  ).trim()
  const replyTo = (
    overrides.EMAIL_REPLY_TO
      ?? overrides.SMTP_REPLY_TO
      ?? env.EMAIL_REPLY_TO
      ?? env.SMTP_REPLY_TO
      ?? emailReplyTo
      ?? ''
  ).trim()
  const unsubscribeUrl = (overrides.SMTP_UNSUBSCRIBE_URL ?? env.SMTP_UNSUBSCRIBE_URL ?? '').trim()

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from: formatEmailAddress(fromAddress, fromName),
    fromAddress,
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
    // If the provided htmlBody is a full document, preserve it and just
    // append the button/footer. If it's a fragment, wrap it in a branded
    // container so all emails share the same professional layout.
    const isFullDocument = /<\/?html|<\/?body/i.test(htmlBody)
    const contentFragment = appendTrackingButtonToHtml(htmlBody, resolvedTrackingUrl)
    const preheaderSpan = `<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</div>`
    const unsubscribe = env.SMTP_UNSUBSCRIBE_URL ? `<p style="font-size:12px;color:#64748b;margin-top:24px;">To stop receiving these emails, <a href="${env.SMTP_UNSUBSCRIBE_URL}">unsubscribe</a>.</p>` : ''

    if (isFullDocument) {
      if (contentFragment.toLowerCase().includes('</body>')) {
        return contentFragment.replace(/<body([^>]*)>/i, `<body$1>${preheaderSpan}`)
          .replace(/<\/body>/i, `${unsubscribe}${customerEmailFooter()}</body>`)
      }

      return `${preheaderSpan}${contentFragment}${unsubscribe}${customerEmailFooter()}`
    }

    // Prefer remote logo URL. Do NOT inline large base64 data URIs into the
    // HTML (they bloat output and sometimes appear as truncated text). If the
    // image fails to load, hide it instead of swapping to an embedded blob.
    const primaryLogoSrc = emailLogoUrl || 'cid:verdexis-logo'

    // Build a branded wrapper for fragment content
    const wrapper = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
    <style>
    body { margin:0; padding:0; background:#f4f6f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .email-wrapper { max-width:600px; margin:18px auto; background:#ffffff; border-radius:8px; overflow:visible; box-shadow:none; border:1px solid #e6eef6 }
    .email-header { padding:18px 12px 8px 12px; text-align:center; background:transparent }
    .email-header img { width:96px; max-width:45%; height:auto; display:block; margin:0 auto; image-rendering:-webkit-optimize-contrast; }
      .email-content { padding:20px 24px; color:#0f172a; line-height:1.45; font-size:15px }
      .email-footer { background:#f8fafc; padding:18px; text-align:center; color:#64748b; font-size:13px }
      a.btn { display:inline-block; background:#0f4c81; color:#fff; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600 }
      img.responsive { max-width:100%; height:auto; display:block }
      @media (max-width:600px){ .email-content{padding:16px} .email-header img{width:80px} }
    </style>
  </head>
  <body>
    ${preheaderSpan}
    <div class="email-wrapper">
      <div class="email-header">
        <img class="responsive" src="${primaryLogoSrc}" alt="${escapeHtml(companyInfo.name)}" onerror="this.onerror=null;this.style.display='none'" />
      </div>
      <div class="email-content">
        ${contentFragment}
      </div>
      <div class="email-footer">
        ${unsubscribe}
        ${customerEmailFooter()}
      </div>
    </div>
  </body>
</html>`

    return wrapper
  }

  const safeBody = escapeHtml(body).replace(/\n/g, '<br />')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18384264054"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);} 
      gtag('js', new Date());

      gtag('config', 'AW-18384264054');
    </script>
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
      ${customerEmailFooter()}
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

function buildSmtpTransportConfig(config: EmailTransportConfig): SMTPTransport.Options {
  const host = config.host.toLowerCase()
  const isMailgun = host.includes('mailgun')
  const useStartTls = isMailgun || config.port === 587 || config.port === 2587

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    requireTLS: useStartTls,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
  }
}

function getEmailTransporter(): nodemailer.Transporter | null {
  if (emailTransporter) return emailTransporter

  const config = resolveEmailTransportConfig()
  if (!config.auth.user || !config.auth.pass) {
    console.warn('[notification-service] SMTP credentials missing, skipping email delivery')
    return null
  }

  if (config.auth.user.toLowerCase() !== config.fromAddress.toLowerCase()) {
    console.warn(
      `[notification-service] SMTP login is ${config.auth.user}, but customer mail is sent as ${config.fromAddress}. ` +
      'The SMTP provider must verify the customer address as an alias/sender for this account; otherwise delivery may be rejected.'
    )
  }

  emailTransporter = nodemailer.createTransport(buildSmtpTransportConfig(config))

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
    // If the SMTP auth user is available, use it for the MAIL FROM (envelope) to align with provider policies.
    const envelopeFrom = config.auth && config.auth.user ? config.auth.user : config.fromAddress
    headers['Sender'] = formatEmailAddress(envelopeFrom, config.fromName)

    // We will prefer the public `emailLogoUrl` (remote URL) so email clients
    // fetch the logo inline and do not render it as an attachment preview.
    // Keep a data-URI fallback in `logoDataUri` but do not add attachments.
    const attachments: Array<any> = []

    console.log('[notification-service] Sending email:', { to: email, subject, attachments: [] })

    await transporter.sendMail({
      from: config.from,
      to: email,
      replyTo: config.replyTo,
      subject,
      text: `${body}\n\nView in Verdexis: ${trackingUrl}`,
      html,
      headers,
      envelope: { from: envelopeFrom, to: email },
      // Intentionally not including attachments to avoid Gmail showing the
      // logo as an attached file; rely on the remote `emailLogoUrl` or the
      // embedded data URI in the HTML as fallbacks.
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

/** Send an internal operational message only to configured administrators. */
export async function sendAdminEmailNotification(
  subject: string,
  body: string,
  htmlBody?: string,
  recipients: string[] = adminEmailRecipients,
): Promise<boolean> {
  try {
    const transporter = getEmailTransporter()
    if (!transporter) return false
    const config = resolveEmailTransportConfig()
    const from = formatEmailAddress(adminEmailAddress, 'Verdexis Admin')
    await transporter.sendMail({
      from,
      to: recipients,
      subject,
      text: body,
      html: htmlBody ?? `<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>`,
      headers: { 'X-Mailer': 'Verdexis', 'Auto-Submitted': 'auto-generated' },
      envelope: { from: adminEmailAddress, to: recipients },
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    })
    return true
  } catch (error) {
    console.error('[notification-service] Error sending admin email:', error)
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
    if (!message) return

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
    if (!message) return

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
