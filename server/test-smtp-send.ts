import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const sendTestEmail = async () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  }

  try {
    const transporter = nodemailer.createTransport(config)
    
    console.log('Sending test email to dianasmith6525@gmail.com...')
    const result = await transporter.sendMail({
      from: config.auth.user,
      to: 'dianasmith6525@gmail.com',
      subject: 'Test Email from Verdexis',
      text: 'This is a test email from your Verdexis server.',
      html: '<h2>Test Email</h2><p>This is a test email from your Verdexis server.</p>',
    })
    
    console.log('✅ Email sent successfully')
    console.log(`   Message ID: ${result.messageId}`)
    console.log(`   From: ${config.auth.user}`)
    console.log(`   To: dianasmith6525@gmail.com`)
  } catch (err) {
    console.error('❌ Failed to send email:')
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

sendTestEmail()
