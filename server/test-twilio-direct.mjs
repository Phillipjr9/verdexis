import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhone = process.env.TWILIO_PHONE_NUMBER
const testPhone = process.env.TEST_PHONE_NUMBER

console.log('🔍 Twilio SMS OTP Configuration Test\n')
console.log('Configuration:')
console.log(`  Account SID: ${accountSid.substring(0, 10)}...`)
console.log(`  Auth Token: ✅ SET`)
console.log(`  Twilio Phone: ${twilioPhone}`)
console.log(`  Test Phone: ${testPhone}\n`)

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
