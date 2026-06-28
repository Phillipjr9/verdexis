import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../env.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { companyInfo } from '../config/company.js'
import { companyInfo } from '../config/company.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface EmailOptions {
  to: string
  subject: string
  html: string
}

class EmailService {
  private transporter: Transporter | null = null
  private templates: Map<string, string> = new Map()

  constructor() {
    this.initTransporter()
    this.loadTemplates()
  }

  private initTransporter() {
    const emailConfig = {
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === 'true',
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    }

    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      console.warn('[email] SMTP credentials missing, emails will be logged only')
      return
    }

    this.transporter = nodemailer.createTransport(emailConfig)
  }

  private loadTemplates() {
    const templateDir = path.join(__dirname, '../../../')
    const templateFiles = [
      'email_otp_verification.html',
      'email_welcome.html',
      'email_transaction_confirmation.html',
      'email_security.html',
      'email_error_notification.html',
    ]

    for (const file of templateFiles) {
      try {
        const content = fs.readFileSync(path.join(templateDir, file), 'utf-8')
        const name = file.replace('email_', '').replace('.html', '')
        this.templates.set(name, content)
      } catch {
        // Template file doesn't exist, skip
      }
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
      ...vars,
    }

    return Object.entries(defaultVars).reduce(
      (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value ?? ''),
      html
    )
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        console.log('[email] Would send to:', options.to)
        console.log('[email] Subject:', options.subject)
        return true
      }

      await this.transporter.sendMail({
        from: `Verdexis <${env.SMTP_USER}>`,
        ...options,
      })

      console.log('[email] Sent to:', options.to)
      return true
    } catch (error) {
      console.error('[email] Failed:', error)
      return false
    }
  }

  async sendOTP(to: string, userName: string, otp: string, expirationMinutes: number): Promise<boolean> {
    const template = this.templates.get('otp_verification')
    if (!template) return false

    const expiresAt = new Date(Date.now() + expirationMinutes * 60000)
    const html = this.replaceVariables(template, {
      USER_NAME: userName,
      OTP_CODE: otp,
      EXPIRATION_MINUTES: expirationMinutes.toString(),
      EXPIRATION_TIME: expiresAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
      CONTEXT_SECTION: '',
      ACTION_BUTTONS: '',
      BACKUP_CODES_SECTION: '',
      TWO_FA_APP_SECTION: '',
      SECURITY_ALERT_URL: `${env.APP_BASE_URL}/security/alert`,
      HELP_VERIFICATION_URL: `${env.APP_BASE_URL}/help/verification`,
      CONTACT_SUPPORT_URL: `${env.APP_BASE_URL}/contact`,
    })

    return this.send({
      to,
      subject: `Your Verdexis verification code: ${otp}`,
      html,
    })
  }

  async sendWelcome(to: string, userName: string): Promise<boolean> {
    const template = this.templates.get('welcome')
    if (!template) return false

    const html = this.replaceVariables(template, {
      USER_NAME: userName,
      ONBOARDING_URL: `${env.APP_BASE_URL}/onboarding`,
      HELP_CENTER_URL: `${env.APP_BASE_URL}/help`,
      SUPPORT_EMAIL: env.SMTP_USER || 'support@verdexis.com',
    })

    return this.send({
      to,
      subject: 'Welcome to Verdexis!',
      html,
    })
  }

  async sendPasswordReset(to: string, userName: string, resetUrl: string): Promise<boolean> {
    const template = this.templates.get('security')
    if (!template) return false

    const html = this.replaceVariables(template, {
      USER_NAME: userName,
      SECURITY_TITLE: 'Password Reset Request',
      SECURITY_CONTENT: '<p>We received a request to reset your password. Click the button below to choose a new password.</p>',
      EXPIRATION_TIME: '1',
      ACTION_URL: resetUrl,
      BUTTON_TEXT: 'Reset Password',
      SECURITY_HELP_URL: `${env.APP_BASE_URL}/security/help`,
    })

    return this.send({
      to,
      subject: 'Reset your Verdexis password',
      html,
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
      DASHBOARD_URL: `${env.APP_BASE_URL}/dashboard`,
      TRANSACTION_DETAILS_URL: `${env.APP_BASE_URL}/transactions/${transaction.id}`,
      SUPPORT_URL: `${env.APP_BASE_URL}/support`,
    })

    return this.send({
      to,
      subject: `Transaction Confirmed: ${transaction.amount} ${transaction.currency}`,
      html,
    })
  }
}

export const emailService = new EmailService()
