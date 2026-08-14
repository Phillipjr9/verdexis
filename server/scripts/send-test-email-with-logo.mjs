import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { resolveEmailTransportConfig } from '../dist/notificationService.js'
import { companyInfo } from '../dist/config/company.js'
import { emailLogoUrl, customerEmailFooter } from '../dist/config/email.js'

async function main() {
  const config = resolveEmailTransportConfig()
  console.log('[test-email] resolved SMTP config host:', config.host)
  if (!config.auth.user || !config.auth.pass) {
    console.warn('[test-email] SMTP credentials missing — will only write preview to /tmp/email_test_with_logo.html')
  }

  // Build HTML by reusing the template used earlier
  const tplPath = path.resolve(process.cwd(), 'templates', 'email_colorlib_simple.html')
  const tpl = fs.existsSync(tplPath) ? fs.readFileSync(tplPath, 'utf8') : '<p>Template missing</p>'
  const html = tpl
    .replace(/{{COMPANY_NAME}}/g, companyInfo.name)
    .replace(/{{COMPANY_ADDRESS}}/g, companyInfo.getFormattedAddress())
    .replace(/{{YEAR}}/g, new Date().getFullYear().toString())
    .replace(/{{LOGO_URL}}/g, emailLogoUrl)
    .replace(/{{USER_NAME}}/g, 'Diana Smith')
    .replace(/{{RESET_URL}}/g, 'http://localhost:5173/reset?token=test-inline-logo')
    .replace(/{{REQUEST_TIME}}/g, new Date().toString())
    .replace(/{{EXPIRY_TIME}}/g, new Date(Date.now()+3600*1000).toString())
    .replace(/{{CONTACT_LINK}}/g, companyInfo.links.contact)
    .replace(/{{TERMS_LINK}}/g, companyInfo.links.terms)
    .replace(/{{PRIVACY_LINK}}/g, companyInfo.links.privacy)
    .replace(/{{SECURITY_LINK}}/g, companyInfo.links.security)

  // Write preview
  fs.writeFileSync('/tmp/email_test_with_logo.html', html)
  console.log('Wrote preview to /tmp/email_test_with_logo.html')

  if (!config.auth.user || !config.auth.pass) return

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  const localLogo = path.resolve(process.cwd(), '..', 'app', 'public', 'assets', 'logo-icon-transparent.png')
  const attachments = []
  if (fs.existsSync(localLogo)) {
    attachments.push({ filename: 'logo.png', path: localLogo, cid: 'verdexis-logo' })
  }

  const mail = {
    from: config.from,
    to: 'dianasmith7482@gmail.com',
    subject: 'Test — Verdexis password reset (logo inline)',
    html: html.replace(/{{LOGO_URL}}/g, 'cid:verdexis-logo'),
    text: 'Password reset. Open the HTML version to view the logo.',
    attachments,
  }

  const info = await transporter.sendMail(mail)
  console.log('Sent message:', info && info.messageId)
}

main().catch(err=>{ console.error('error:', err); process.exit(1) })
