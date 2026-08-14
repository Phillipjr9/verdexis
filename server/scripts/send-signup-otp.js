import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

async function main() {
  const emailArg = process.argv[2] || process.env.TO
  if (!emailArg) {
    console.error('Usage: node send-signup-otp.js user@example.com')
    process.exit(2)
  }

  const email = String(emailArg).trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('User not found:', email)
    process.exit(1)
  }

  if (user.emailVerified) {
    console.log('User already verified:', email)
    process.exit(0)
  }

  // OTP cooldown check (60s)
  const cooldownMs = 60 * 1000
  const recent = await prisma.otp.findFirst({
    where: {
      userId: user.id,
      purpose: 'email_verification',
      used: false,
      createdAt: { gte: new Date(Date.now() - cooldownMs) },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recent) {
    const secondsLeft = Math.ceil((recent.createdAt.getTime() + cooldownMs - Date.now()) / 1000)
    console.error(`Please wait ${secondsLeft}s before requesting a new code`)
    process.exit(1)
  }

  await prisma.otp.deleteMany({ where: { userId: user.id, purpose: 'email_verification', used: false } })

  const code = crypto.randomInt(100000, 1000000).toString()
  const hashed = crypto.createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otp.create({ data: { userId: user.id, hashedOtp: hashed, purpose: 'email_verification', expiresAt, attempts: 0, maxAttempts: 5 } })

  // Build email
  const subject = `Your Verdexis verification code: ${code}`
  const text = `Your verification code is ${code}. It expires in 10 minutes. Do not share this code.`

  // Optional nice HTML template
  let html = `<div style="font-family:Arial, sans-serif;padding:24px"><h2>Verify your email</h2><p>Hi ${user.name || ''},</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</div><p>This code expires in 10 minutes. Do not share this code.</p></div>`
  try {
    const tpl = path.join(process.cwd(), 'server', 'templates', 'email_otp_verification.html')
    if (fs.existsSync(tpl)) {
      const tplContent = fs.readFileSync(tpl, 'utf8')
      html = tplContent.replace(/{{OTP_CODE}}/g, code).replace(/{{USER_NAME}}/g, user.name || '')
    }
  } catch (err) {
    // ignore template errors
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const secure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
  const userAuth = process.env.SMTP_USER
  const passAuth = process.env.SMTP_PASS

  if (!userAuth || !passAuth) {
    console.error('SMTP credentials missing in env; cannot send email')
    process.exit(1)
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user: userAuth, pass: passAuth } })

  await transporter.verify()

  await transporter.sendMail({
    from: `${process.env.SMTP_FROM_NAME || 'Verdexis'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: user.email,
    subject,
    text,
    html,
    envelope: { from: process.env.SMTP_USER, to: user.email },
  })

  console.log('Sent OTP to', user.email)
  if ((process.env.NODE_ENV || 'development') !== 'production') console.log('Dev OTP:', code)
}

main().catch((err) => { console.error('Error:', err instanceof Error ? err.message : String(err)); process.exit(1) })

