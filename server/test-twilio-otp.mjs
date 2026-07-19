import 'dotenv/config'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhone = process.env.TWILIO_PHONE_NUMBER
const testPhone = '+17372583742' // Your phone number for testing

console.log('🔍 Twilio SMS OTP Configuration Test\n')
console.log('Configuration:')
console.log(`  Account SID: ${accountSid ? accountSid.substring(0, 10) + '...' : '❌ NOT SET'}`)
console.log(`  Auth Token: ${authToken ? '✅ SET' : '❌ NOT SET'}`)
console.log(`  Twilio Phone: ${twilioPhone || '❌ NOT SET'}`)
console.log(`  Test Phone: ${testPhone}\n`)

if (!accountSid || !authToken || !twilioPhone) {
  console.error('❌ Missing Twilio credentials in .env.local')
  process.exit(1)
}

try {
  console.log('📱 Initializing Twilio client...')
  const client = twilio(accountSid, authToken)
  
  console.log('✅ Twilio client initialized\n')
  
  console.log('📤 Sending test SMS with OTP code...')
  const testCode = '123456'
  const message = `Your Verdexis verification code is: ${testCode}. Valid for 10 minutes. Never share this code.`
  
  const result = await client.messages.create({
    body: message,
    from: twilioPhone,
    to: testPhone
  })
  
  console.log('✅ SMS sent successfully!')
  console.log(`  Message SID: ${result.sid}`)
  console.log(`  Status: ${result.status}`)
  console.log(`  From: ${result.from}`)
  console.log(`  To: ${result.to}\n`)
  
  console.log('🎉 Twilio SMS OTP is working correctly!')
  console.log('Check your phone for the test message.')
  
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
