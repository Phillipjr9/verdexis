import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { env } from '../env.js'
import { sendEmailNotification } from '../notificationService.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { companyInfo } from '../config/company.js'
import { customerEmailFooter, emailLinks, emailLogoUrl } from '../config/email.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  userId?: string
  kind?: string
  title?: string
  createWebNotification?: boolean
}

class EmailService {
  private transporter: Transporter | null = null
  private templates: Map<string, string> = new Map()

  constructor() {
    this.initTransporter()
    this.loadTemplates()
  }

  private smtpAuth(): { user: string; pass: string } | null {
    const user = (env.SMTP_USER || '').trim()
    const pass = (env.SMTP_PASS || '').trim()
    if (!user || !pass) return null
    return { user, pass }
  }

  private buildTransport(port: number): Transporter | null {
    const auth = this.smtpAuth()
    if (!auth) return null
    const host = (env.SMTP_HOST || 'smtp.gmail.com').trim()
    const secure = port === 465 || String(env.SMTP_SECURE || 'false').toLowerCase() === 'true'
    const emailConfig: SMTPTransport.Options = {
      host,
      port,
      secure,
      auth,
      requireTLS: !secure && (host.includes('mailgun') || port === 587 || port === 2525 || port === 2587),
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    }
    return nodemailer.createTransport(emailConfig)
  }

  private initTransporter() {
    const auth = this.smtpAuth()
    if (!auth) {
      console.warn('[email] SMTP credentials missing, emails will be logged only', {
        hostSet: Boolean(env.SMTP_HOST),
        userSet: Boolean(env.SMTP_USER),
        passSet: Boolean(env.SMTP_PASS),
      })
      return
    }
    const host = (env.SMTP_HOST || '').toLowerCase()
    const configured = Number(env.SMTP_PORT) || 0
    const port = configured || (host.includes('mailgun') ? 2525 : 587)
    this.transporter = this.buildTransport(port)
    console.log('[email] SMTP transporter ready', { host: env.SMTP_HOST, port, user: auth.user })
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter
    this.initTransporter()
    return this.transporter
  }

  private smtpPortCandidates(): number[] {
    const configured = Number(env.SMTP_PORT) || 0
    const host = (env.SMTP_HOST || '').toLowerCase()
    const preferred = configured || (host.includes('mailgun') ? 2525 : 587)
    const rest = [2525, 587, 465].filter((p) => p !== preferred)
    return [preferred, ...rest]
  }

  private loadTemplates() {
    const candidates = [
      path.join(__dirname, '../../templates'),
      path.join(__dirname, '../templates'),
      path.join(__dirname, '../../../templates'),
      path.join(process.cwd(), 'templates'),
      path.join(process.cwd(), 'server/templates'),
    ]
    let templateDir: string | null = null
    for (const dir of candidates) {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          templateDir = dir
          break
        }
      } catch {
        // try next
      }
    }
    if (!templateDir) {
      console.warn('[email] No templates directory found; using inline fallbacks')
      return
    }
    try {
      const files = fs.readdirSync(templateDir)
      for (const file of files) {
        if (!/^email_.+\.html$/i.test(file)) continue
        try {
          const content = fs.readFileSync(path.join(templateDir, file), 'utf-8')
          const name = file.replace(/^email_/, '').replace(/\.html$/i, '')
          this.templates.set(name, content)
        } catch {
          // skip
        }
      }
      console.log(`[email] Loaded ${this.templates.size} template(s) from ${templateDir}`)
    } catch (err) {
      console.warn('[email] Failed to load templates:', err)
    }
  }

  private replaceVariables(html: string, vars: Record<string, string>): string {
    const defaultVars = {
      COMPANY_NAME: companyInfo.name,
      COMPANY_ADDRESS: companyInfo.getFormattedAddress(),
      COMPANY_PHONE: companyInfo.contact.phone,
      PRIVACY_LINK: companyInfo.links.privacy,
      TERMS_LINK: companyInfo.links.terms,
      CONTACT_LINK: companyInfo.links.contact,
      SECURITY_LINK: companyInfo.links.security,
      LINKEDIN: companyInfo.social.linkedin,
      TWITTER: companyInfo.social.twitter,
      FACEBOOK: companyInfo.social.facebook,
      YEAR: new Date().getFullYear().toString(),
      LOGO_URL: emailLogoUrl,
      LOGO_CID: 'cid:verdexis-logo',
      SUPPORT_LINK: emailLinks.support,
      WEBSITE_LINK: emailLinks.website,
      ...vars,
    }
    return Object.entries(defaultVars).reduce(
      (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value ?? ''),
      html,
    )
  }

  private appBase(): string {
    return (env.APP_BASE_URL || emailLinks.website).replace(/\/$/, '')
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      const plainText = options.text ?? options.subject
      const success = await sendEmailNotification(options.to, options.subject, plainText, options.html, {
        userId: options.userId,
        kind: options.kind,
        title: options.title ?? options.subject,
        body: plainText,
        createWebNotification: options.createWebNotification,
      })
      if (success) console.log('[email] Sent to:', options.to)
      else console.error('[email] sendEmailNotification returned false for:', options.to, 'kind:', options.kind)
      return success
    } catch (error) {
      console.error('[email] Failed:', error)
      return false
    }
  }

  async sendOTP(to: string, userName: string, otp: string, expirationMinutes: number, userId?: string): Promise<boolean> {
    const template = this.templates.get('otp_verification')
    const expiresAt = new Date(Date.now() + expirationMinutes * 60000)
    const base = this.appBase()
    const html = template
      ? this.replaceVariables(template, {
          USER_NAME: userName,
          OTP_CODE: otp,
          EXPIRATION_MINUTES: expirationMinutes.toString(),
          EXPIRATION_TIME: expiresAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
          CONTEXT_SECTION: '',
          ACTION_BUTTONS: '',
          BACKUP_CODES_SECTION: '',
          TWO_FA_APP_SECTION: '',
          SECURITY_ALERT_URL: `${base}/security/alert`,
          HELP_VERIFICATION_URL: `${base}/help/verification`,
          CONTACT_SUPPORT_URL: emailLinks.support || `${base}/contact`,
        })
      : `<div style="font-family:sans-serif;padding:24px"><h2>Your verification code</h2><p>Hi ${userName},</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</p><p>Expires in ${expirationMinutes} minutes. Do not share this code.</p></div>`

    const subject = 'Your Verdexis verification code'
    const text = `Your Verdexis verification code is ${otp}. It expires in ${expirationMinutes} minutes. Do not share this code.`

    const direct = await this.sendOtpDirect(to, subject, text, html)
    if (direct) return true

    console.warn('[email] Direct OTP SMTP failed; falling back to notificationService for', to)
    return this.send({
      to,
      subject,
      html,
      text,
      userId,
      kind: 'otp',
      title: 'Verification Code',
      createWebNotification: false,
    })
  }

  private async sendOtpDirect(to: string, subject: string, text: string, html: string): Promise<boolean> {
    if (!this.smtpAuth()) {
      console.error('[email] OTP direct send aborted: no SMTP transporter', {
        hostSet: Boolean(env.SMTP_HOST),
        userSet: Boolean(env.SMTP_USER),
        passSet: Boolean(env.SMTP_PASS),
      })
      return false
    }

    const fromAddress = (env.EMAIL_FROM_ADDRESS || env.SMTP_FROM || env.SMTP_USER || '').trim()
    const fromName = (env.EMAIL_FROM_NAME || env.SMTP_FROM_NAME || 'Verdexis').trim()
    if (!fromAddress) {
      console.error('[email] OTP direct send aborted: EMAIL_FROM_ADDRESS / SMTP_FROM missing')
      return false
    }

    const from = `${fromName} <${fromAddress}>`
    const envelopeFrom = (env.SMTP_USER || fromAddress).trim()
    const replyTo = (env.EMAIL_REPLY_TO || env.SMTP_REPLY_TO || '').trim() || undefined
    const mail = {
      from,
      to,
      replyTo,
      subject,
      text,
      html,
      headers: {
        'X-Mailer': 'Verdexis',
        'Auto-Submitted': 'no',
        ...(replyTo ? { 'Reply-To': replyTo } : {}),
      },
      envelope: { from: envelopeFrom, to },
    }

    let lastError: unknown
    for (const port of this.smtpPortCandidates()) {
      try {
        const transporter = this.buildTransport(port)
        if (!transporter) continue
        const info = await transporter.sendMail(mail)
        this.transporter = transporter
        console.log('[email] OTP sent directly', {
          to,
          port,
          messageId: info.messageId,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected,
        })
        return true
      } catch (error) {
        lastError = error
        const err = error as { message?: string; code?: string }
        const msg = String(err?.message || error)
        const isTimeout = /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg)
        console.error('[email] OTP direct SMTP error', {
          to,
          port,
          message: err?.message,
          code: err?.code,
          willRetry: isTimeout,
          host: env.SMTP_HOST,
        })
        if (!isTimeout) break
      }
    }

    const err = lastError as { message?: string; code?: string; response?: string; responseCode?: number }
    console.error('[email] OTP direct SMTP exhausted ports', {
      to,
      message: err?.message,
      code: err?.code,
      response: err?.response,
      responseCode: err?.responseCode,
      fromAddress,
      envelopeFrom,
      host: env.SMTP_HOST,
    })
    return false
  }

  async sendWelcome(to: string, userName: string, userId?: string): Promise<boolean> {
    const template = this.templates.get('welcome')
    if (!template) return false
    const base = this.appBase()
    const html = this.replaceVariables(template, {
      USER_NAME: userName,
      ONBOARDING_URL: `${base}/onboarding`,
      DASHBOARD_URL: `${base}/dashboard`,
      MARKETS_URL: `${base}/markets`,
      PORTFOLIO_URL: `${base}/portfolio`,
      HELP_CENTER_URL: `${base}/help`,
      SUPPORT_EMAIL: companyInfo.contact.email || emailLinks.support,
    })
    return this.send({
      to,
      subject: 'Welcome to Verdexis!',
      html,
      text: 'Welcome to Verdexis! Complete your onboarding to get started.',
      userId,
      kind: 'welcome',
      title: 'Welcome to Verdexis!',
      createWebNotification: true,
    })
  }

  async sendPasswordReset(to: string, userName: string, resetUrl: string, userId?: string): Promise<boolean> {
    const template = this.templates.get('password_reset') || this.templates.get('colorlib_simple')
    if (!template) {
      const html = `
        <h2>Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
      return this.send({
        to,
        subject: 'Reset your Verdexis password',
        html,
        text: `Use this link to reset your password: ${resetUrl}`,
        userId,
        kind: 'password_reset',
        title: 'Reset your Verdexis password',
        createWebNotification: true,
      })
    }
    const html = this.replaceVariables(template, {
      USER_NAME: userName,
      RESET_URL: resetUrl,
      REQUEST_TIME: new Date().toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      }),
      EXPIRY_TIME: new Date(Date.now() + 60 * 60 * 1000).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      }),
      USER_EMAIL: to,
      USER_AGENT: 'Unknown',
      LOCATION: 'Unknown',
    })
    return this.send({
      to,
      subject: 'Reset your Verdexis password',
      html,
      text: `Use this link to reset your password: ${resetUrl}`,
      userId,
      kind: 'password_reset',
      title: 'Reset your Verdexis password',
      createWebNotification: true,
    })
  }

  async sendTransactionConfirmation(
    to: string,
    userName: string,
    transaction: {
      id: string; type: string; amount: string; currency: string
      from: string; to: string; fee: string; date: string; time: string
    },
    userId?: string,
  ): Promise<boolean> {
    const template = this.templates.get('transaction_confirmation')
    if (!template) return false
    const base = this.appBase()
    const html = this.replaceVariables(template, {
      USER_NAME: userName,
      TRANSACTION_ID: transaction.id,
      TRANSACTION_TYPE: transaction.type,
      AMOUNT: transaction.amount,
      CURRENCY: transaction.currency,
      FROM_ACCOUNT: transaction.from,
      TO_ACCOUNT: transaction.to,
      FEE: transaction.fee,
      TRANSACTION_DATE: transaction.date,
      TRANSACTION_TIME: transaction.time,
      FEE_WARNING: '',
      DASHBOARD_URL: `${base}/dashboard`,
      TRANSACTION_DETAILS_URL: `${base}/transactions/${transaction.id}`,
      SUPPORT_URL: emailLinks.support || `${base}/support`,
    })
    return this.send({
      to,
      subject: `Transaction confirmed: ${transaction.amount} ${transaction.currency} (${transaction.type})`,
      html,
      text: `Your ${transaction.type} of ${transaction.amount} ${transaction.currency} was confirmed. ID: ${transaction.id}`,
      userId,
      kind: 'transaction',
      title: 'Transaction Confirmed',
      createWebNotification: true,
    })
  }

  async sendSecurityAlert(
    to: string,
    userName: string,
    alert: { title: string; message: string; location?: string; ip?: string; device?: string; time?: string },
    userId?: string,
  ): Promise<boolean> {
    const template = this.templates.get('security')
    const base = this.appBase()
    const eventTime =
      alert.time ||
      new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    const html = template
      ? this.replaceVariables(template, {
          USER_NAME: userName,
          ALERT_TITLE: alert.title,
          ALERT_MESSAGE: alert.message,
          EVENT_TIME: eventTime,
          LOCATION: alert.location || 'Unknown',
          IP_ADDRESS: alert.ip || 'Unknown',
          DEVICE: alert.device || 'Unknown',
          SECURITY_URL: `${base}/security`,
          CHANGE_PASSWORD_URL: `${base}/settings/security`,
          SUPPORT_URL: emailLinks.support || `${base}/support`,
        })
      : `<div style="font-family:sans-serif;padding:24px"><h2>Security alert</h2><p>Hi ${userName},</p><p><strong>${alert.title}</strong></p><p>${alert.message}</p><p>Time: ${eventTime}<br/>Location: ${alert.location || 'Unknown'}<br/>IP: ${alert.ip || 'Unknown'}</p></div>`
    return this.send({
      to,
      subject: `Security alert: ${alert.title}`,
      html,
      text: `Security alert: ${alert.title}. ${alert.message} Time: ${eventTime}. Location: ${alert.location || 'Unknown'}. IP: ${alert.ip || 'Unknown'}.`,
      userId,
      kind: 'security',
      title: alert.title,
      createWebNotification: true,
    })
  }
}

export const emailService = new EmailService()
