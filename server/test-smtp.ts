import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const testSMTP = async () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  }

  console.log('Testing SMTP with config:')
  console.log(`  Host: ${config.host}`)
  console.log(`  Port: ${config.port}`)
  console.log(`  Secure: ${config.secure}`)
  console.log(`  User: ${config.auth.user}`)
  console.log()

  if (!config.host || !config.auth.user || !config.auth.pass) {
    console.error('❌ Missing SMTP configuration in .env file')
    console.error('Required: SMTP_HOST, SMTP_USER, SMTP_PASS')
    process.exit(1)
  }

  try {
    const transporter = nodemailer.createTransport(config)
    
    console.log('Verifying connection...')
    await transporter.verify()
    console.log('✅ SMTP connection successful')

    console.log('\nSending test email...')
    const result = await transporter.sendMail({
      from: config.auth.user,
      to: config.auth.user,
      subject: 'SMTP Test',
      text: 'SMTP test successful',
      html: '<p>SMTP test successful</p>',
    })
    
    console.log('✅ Email sent successfully')
    console.log(`   Message ID: ${result.messageId}`)
  } catch (err) {
    console.error('❌ SMTP test failed:')
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

testSMTP()
