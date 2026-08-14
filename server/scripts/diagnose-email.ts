#!/usr/bin/env tsx
/**
 * Email diagnostic script for Verdexis
 * Run this on your production server to diagnose email issues
 */

import nodemailer from 'nodemailer'
import { resolveEmailTransportConfig } from '../src/config/email.js'
import { env } from '../src/env.js'

async function diagnoseEmail() {
  console.log('=== Verdexis Email Diagnostic ===\n')

  // 1. Check environment variables
  console.log('1. Environment Variables:')
  console.log(`   NODE_ENV: ${env.NODE_ENV}`)
  console.log(`   SMTP_HOST: ${env.SMTP_HOST || 'NOT SET'}`)
  console.log(`   SMTP_PORT: ${env.SMTP_PORT || 'NOT SET'}`)
  console.log(`   SMTP_USER: ${env.SMTP_USER ? '***SET***' : 'NOT SET'}`)
  console.log(`   SMTP_PASS: ${env.SMTP_PASS ? '***SET***' : 'NOT SET'}`)
  console.log(`   SMTP_SECURE: ${env.SMTP_SECURE || 'NOT SET'}`)
  console.log(`   EMAIL_FROM_ADDRESS: ${env.EMAIL_FROM_ADDRESS || 'NOT SET'}`)
  console.log()

  // 2. Check resolved config
  console.log('2. Resolved Email Config:')
  const config = resolveEmailTransportConfig()
  console.log(`   Host: ${config.host}`)
  console.log(`   Port: ${config.port}`)
  console.log(`   Secure: ${config.secure}`)
  console.log(`   Auth User: ${config.auth.user ? '***SET***' : 'NOT SET'}`)
  console.log(`   Auth Pass: ${config.auth.pass ? '***SET***' : 'NOT SET'}`)
  console.log(`   From: ${config.from}`)
  console.log()

  // 3. Validate credentials
  if (!config.auth.user || !config.auth.pass) {
    console.error('❌ ERROR: SMTP credentials are missing!')
    console.log('   Emails will NOT be sent. Please set SMTP_USER and SMTP_PASS environment variables.')
    process.exit(1)
  }

  // 4. Test SMTP connection
  console.log('3. Testing SMTP Connection...')
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  try {
    const verifyResult = await transporter.verify()
    console.log(`   ✅ SMTP Connection: ${verifyResult ? 'SUCCESS' : 'FAILED'}`)
  } catch (error) {
    console.error('   ❌ SMTP Connection FAILED:')
    console.error(`      ${error instanceof Error ? error.message : String(error)}`)
    console.log()
    console.log('   Common causes:')
    console.log('   - Invalid Gmail App Password')
    console.log('   - 2FA not enabled on Gmail account')
    console.log('   - Gmail security blocking the connection')
    console.log('   - Network/firewall blocking SMTP port 587')
    process.exit(1)
  }

  // 5. Send test email
  console.log()
  console.log('4. Sending Test Email...')
  
  const testEmail = process.env.TEST_EMAIL || config.auth.user
  
  try {
    const result = await transporter.sendMail({
      from: config.from,
      to: testEmail,
      subject: 'Verdexis Email Test',
      text: 'This is a test email from your Verdexis production server.',
      html: '<h2>Email Test</h2><p>If you received this, your email configuration is working!</p>',
    })
    
    console.log(`   ✅ Test email sent successfully!`)
    console.log(`   Message ID: ${result.messageId}`)
    console.log(`   Accepted: ${result.accepted.join(', ')}`)
    if (result.rejected.length > 0) {
      console.log(`   Rejected: ${result.rejected.join(', ')}`)
    }
  } catch (error) {
    console.error('   ❌ Failed to send test email:')
    console.error(`      ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  console.log()
  console.log('=== Email Diagnostic Complete ===')
  console.log('Your email configuration is working correctly!')
  
  await transporter.close()
  process.exit(0)
}

diagnoseEmail().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
