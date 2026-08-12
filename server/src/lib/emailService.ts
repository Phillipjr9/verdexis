import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { customerEmailAddress, customerEmailFooter, customerEmailName, emailLinks, emailReplyTo, formatEmailAddress } from '../config/email.js'
import { sendEmailNotification } from '../notificationService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface EmailConfig {
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

const DEFAULT_CONFIG: EmailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  from: customerEmailAddress,
  fromName: customerEmailName,
  replyTo: emailReplyTo || '',
  unsubscribeUrl: process.env.SMTP_UNSUBSCRIBE_URL || '',
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig
  private enabled: boolean

  constructor(config: Partial<EmailConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.enabled = !!(this.config.auth.user && this.config.auth.pass)

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      })
    }
  }

  private loadTemplate(templateName: string): string {
    const templatePath = path.resolve(__dirname, '../../templates', `${templateName}.html`)
    try {
      return fs.readFileSync(templatePath, 'utf8')
    } catch (error) {
      console.warn(`[EmailService] Template ${templateName} not found, using fallback`)
      return this.getFallbackTemplate()
    }
  }

  private getFallbackTemplate(): string {
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
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
    body { margin: 0; padding: 20px; background: #f4f6f8; font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; }
    .code { font-size: 32px; font-weight: bold; color: #0077d9; text-align: center; letter-spacing: 8px; margin: 30px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="color: #0f4c81;">{{TITLE}}</h1>
    <p>{{MESSAGE}}</p>
    <div class="code">{{OTP_CODE}}</div>
    <p style="color: #777; font-size: 14px;">This code expires in {{EXPIRATION_MINUTES}} minutes.</p>
    <div class="footer">
      <p>© {{YEAR}} Verdexis. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  }

  private replaceVariables(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce((result, [key, value]) => {
      return result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''))
    }, template)
  }

  async sendOTPEmail(
    to: string,
    otp: string,
    purpose: string,
    expirationMinutes: number,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      console.log(`[EmailService] Email not configured. OTP for ${to}: ${otp}`)
      return false
    }

    const purposeTitles: Record<string, string> = {
      login: 'Verify Your Login',
      '2fa': 'Two-Factor Authentication',
      transaction: 'Verify Transaction',
      email_verification: 'Verify Email Address',
      password_reset: 'Password Reset Code',
    }

    const purposeMessages: Record<string, string> = {
      login: 'Use this code to complete your login:',
      '2fa': 'Your two-factor authentication code:',
      transaction: 'Confirm your transaction with this code:',
      email_verification: 'Verify your email address with this code:',
      password_reset: 'Reset your password with this code:',
    }

    const title = purposeTitles[purpose] || 'Verification Code'
    const message = purposeMessages[purpose] || 'Your verification code:'

    const template = this.loadTemplate('email_otp_verification')
    
    const variables: Record<string, string> = {
      TITLE: title,
      MESSAGE: message,
      OTP_CODE: otp,
      EXPIRATION_MINUTES: expirationMinutes.toString(),
      YEAR: new Date().getFullYear().toString(),
      USER_EMAIL: to,
      COMPANY_NAME: 'Verdexis',
      COMPANY_ADDRESS: '123 Finance Way, New York, NY 10001',
      SECURITY_LINK: emailLinks.security,
      PRIVACY_LINK: emailLinks.privacy,
      TERMS_LINK: emailLinks.terms,
      CONTACT_LINK: emailLinks.support,
      SECURITY_ALERT_URL: `${emailLinks.security}/alert`,
      HELP_VERIFICATION_URL: `${emailLinks.support}/verification`,
      CONTACT_SUPPORT_URL: emailLinks.support,
      ...Object.entries(metadata).reduce((acc, [key, value]) => {
        acc[key.toUpperCase()] = String(value)
        return acc
      }, {} as Record<string, string>),
    }

    const renderedHtml = this.replaceVariables(template, variables)
    const html = renderedHtml.replace(/<\/body>/i, `${customerEmailFooter()}</body>`)

    try {
      return await sendEmailNotification(
        to,
        `🔐 ${title} - Verdexis`,
        `${message}\n\nYour verification code: ${otp}\n\nThis code expires in ${expirationMinutes} minutes.\n\n© ${new Date().getFullYear()} Verdexis`,
        html,
      )
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error)
      return false
    }
  }

  async sendTransactionOTP(
    to: string,
    otp: string,
    expirationMinutes: number,
    transactionDetails: {
      amount: string
      currency: string
      recipient: string
      type: string
    }
  ): Promise<boolean> {
    return this.sendOTPEmail(to, otp, 'transaction', expirationMinutes, transactionDetails)
  }

  async send2FAOTP(to: string, otp: string, expirationMinutes: number): Promise<boolean> {
    return this.sendOTPEmail(to, otp, '2fa', expirationMinutes)
  }

  async sendPasswordResetOTP(to: string, otp: string, expirationMinutes: number): Promise<boolean> {
    return this.sendOTPEmail(to, otp, 'password_reset', expirationMinutes)
  }
}

export const emailService = new EmailService()
