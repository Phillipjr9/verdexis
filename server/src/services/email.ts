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

  private initTransporter() {
    const host = env.SMTP_HOST || 'smtp.gmail.com'
    const port = Number(env.SMTP_PORT) || 587
    const secure = env.SMTP_SECURE === 'true'
    const auth = {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    }
    const emailConfig: SMTPTransport.Options = {
      host,
      port,
      secure,
      auth,
      requireTLS: host.includes('mailgun') || port === 587 || port === 2587,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 20_000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    }

    if (!auth.user || !auth.pass) {
      console.warn('[email] SMTP credentials missing, emails will be logged only')
      return
    }

    this.transporter = nodemailer.createTransport(emailConfig)
  }

  private loadTemplates() {
    const templateDir = path.join(__dirname, '../../templates')
    try {
      const files = fs.readdirSync(templateDir)
      for (const file of files) {
        if (!/^email_.+\.html$/i.test(file)) continue
        try {
          const content = fs.readFileSync(path.join(templateDir, file), 'utf-8')
          const name = file.replace(/^email_/, '').replace(/\.html$/i, '')
          this.templates.set(name, content)
        } catch (err) {
          // skip unreadable
        }
      }
    } catch (err) {
      // templates directory may not exist
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
      html
    )
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

      console.log('[email] Sent to:', options.to)
      return success
    } catch (error) {
      console.error('[email] Failed:', error)
      return false
    }
  }

  async sendOTP(to: string, userName: string, otp: string, expirationMinutes: number, userId?: string): Promise<boolean> {
    const template = this.templates.get('otp_verification')

    const expiresAt = new Date(Date.now() + expirationMinutes * 60000)
    const base = (env.APP_BASE_URL || emailLinks.website).replace(/\/$/, '')

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

    return this.send({
      to,
      subject: `Your Verdexis verification code: ${otp}`,
      html,
      text: `Your OTP is ${otp}. It expires in ${expirationMinutes} minutes.`,
      userId,
      kind: 'otp',
      title: 'Verification Code',
      createWebNotification: false,
    })
  }

  async sendWelcome(to: string, userName: string, userId?: string): Promise<boolean> {
    const template = this.templates.get('welcome')
    if (!template) return false

    const base = (env.APP_BASE_URL || emailLinks.website).replace(/\/$/, '')

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
    // Prefer the full standalone password_reset template; fall back to colorlib fragment
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
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
      EXPIRY_TIME: new Date(Date.now() + 60 * 60 * 1000).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
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
      id: string
      type: string
      amount: string
      currency: string
      from: string
      to: string
      fee: string
      date: string
      time: string
    }
  ): Promise<boolean> {
    const template = this.templates.get('transaction_confirmation')
    if (!template) return false

    const base = (env.APP_BASE_URL || emailLinks.website).replace(/\/$/, '')

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
      SUPPORT_URL: `${base}/support`,
    })

    return this.send({
      to,
      subject: `Transaction Confirmed: ${transaction.amount} ${transaction.currency}`,
      html,
    })
  }
}

export const emailService = new EmailService()
