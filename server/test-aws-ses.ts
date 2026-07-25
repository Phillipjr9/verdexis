import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const testAWSSES = async () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  }

  console.log('Testing AWS SES SMTP:\n')
  console.log(`  Host: ${config.host}`)
  console.log(`  Port: ${config.port}`)
  console.log(`  User: ${config.auth.user}\n`)

  try {
    const transporter = nodemailer.createTransport(config)
    
    console.log('Verifying connection...')
    await transporter.verify()
    console.log('✅ AWS SES connection successful\n')

    console.log('Sending test email to dianasmith6525@gmail.com...')
    const result = await transporter.sendMail({
      from: 'noreply@verdexis.com',
      to: 'dianasmith6525@gmail.com',
      subject: 'Test Email from Verdexis via AWS SES',
      text: 'This is a test email from your Verdexis server using AWS SES.',
      html: '<h2>Test Email</h2><p>This is a test email from your Verdexis server using AWS SES.</p>',
    })
    
    console.log('✅ Email sent successfully via AWS SES')
    console.log(`   Message ID: ${result.messageId}`)
    console.log(`   From: noreply@verdexis.com`)
    console.log(`   To: dianasmith6525@gmail.com`)
  } catch (err) {
    console.error('❌ Error:')
    console.error(err instanceof Error ? err.message : String(err))
    console.error('\n⚠️  Note: Make sure the sender email is verified in AWS SES')
    process.exit(1)
  }
}

testAWSSES()
