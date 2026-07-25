import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const diagnose = async () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  }

  console.log('=== ETHEREAL SMTP DIAGNOSTIC ===\n')
  console.log('Configuration:')
  console.log(`  Host: ${config.host}`)
  console.log(`  Port: ${config.port}`)
  console.log(`  Secure: ${config.secure}`)
  console.log(`  User: ${config.auth.user}\n`)

  try {
    const transporter = nodemailer.createTransport(config)
    
    console.log('1. Testing connection...')
    await transporter.verify()
    console.log('   ✅ Connection verified\n')

    console.log('2. Sending email to external address (dianasmith6525@gmail.com)...')
    const result = await transporter.sendMail({
      from: config.auth.user,
      to: 'dianasmith6525@gmail.com',
      subject: 'Ethereal Test - External Delivery',
      text: 'Testing if Ethereal can send to external Gmail addresses.',
      html: '<p>Testing if Ethereal can send to external Gmail addresses.</p>',
    })
    
    console.log('   ✅ Email accepted by SMTP server')
    console.log(`   Message ID: ${result.messageId}`)
    console.log(`   Response: ${result.response}\n`)

    console.log('3. Sending email to Ethereal test address...')
    const result2 = await transporter.sendMail({
      from: config.auth.user,
      to: config.auth.user,
      subject: 'Ethereal Test - Internal Delivery',
      text: 'Testing internal Ethereal delivery.',
      html: '<p>Testing internal Ethereal delivery.</p>',
    })
    
    console.log('   ✅ Email sent to Ethereal account')
    console.log(`   Message ID: ${result2.messageId}`)
    console.log(`   Preview URL: https://ethereal.email/message/${result2.messageId}\n`)

    console.log('⚠️  IMPORTANT: Ethereal is a TEST service only!')
    console.log('   - It does NOT deliver to real email addresses (Gmail, etc.)')
    console.log('   - Emails sent to external addresses are accepted but NOT delivered')
    console.log('   - Only emails sent to Ethereal accounts are viewable at ethereal.email\n')
    console.log('   To send real emails, use: Gmail, SendGrid, AWS SES, or Mailgun')

  } catch (err) {
    console.error('❌ Error:')
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

diagnose()
