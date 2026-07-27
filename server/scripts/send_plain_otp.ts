import dotenv from 'dotenv'
dotenv.config()
import { resolveEmailTransportConfig } from '../src/notificationService.js'
import nodemailer from 'nodemailer'

async function main() {
  const cfg = resolveEmailTransportConfig()
  if (!cfg.auth.user || !cfg.auth.pass) {
    console.error('SMTP credentials missing')
    process.exit(1)
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  })

  await transporter.verify()
  const envelopeFrom = cfg.auth.user || cfg.from
  const to = 'dianasmith6525@gmail.com'
  const otp = Math.floor(100000 + Math.random() * 900000).toString()

  await transporter.sendMail({
    from: `${cfg.fromName || 'Verdexis'} <${envelopeFrom}>`,
    to,
    subject: 'Your Verdexis verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
    headers: {
      'X-Mailer': 'Verdexis',
      'Auto-Submitted': 'no',
      'Sender': envelopeFrom,
    },
    envelope: { from: envelopeFrom, to },
  })

  console.log('sent:', to, 'otp:', otp)
}

main().catch((e) => {
  console.error('error', e)
  process.exit(1)
})
