const NewUserOTPAuth = require('./new-user-otp');

async function testOTPVerification() {
  const authService = new NewUserOTPAuth();
  
  // Register user
  const registerResult = await authService.registerNewUser(
    'testuser@verdexis.com',
    '+11234567890',
    'TestPass123!',
    'Test User'
  );
  
  console.log('Registration Result:', registerResult);
  
  // Get OTP from storage
  const tempKey = 'temp_+11234567890';
  const tempData = authService.otpStorage.get(tempKey);
  
  if (tempData) {
    console.log('OTP Generated:', tempData.otp);
    
    // Verify OTP
    const verifyResult = await authService.verifyAndCompleteRegistration(
      '+11234567890',
      tempData.otp
    );
    
    console.log('Verification Result:', verifyResult);
    
    if (verifyResult.success) {
      console.log('\n✅ NEW USER REGISTRATION: SUCCESS!');
      
      // Now try to login (should work without OTP)
      console.log('\n🔐 Testing login as existing user...');
      const loginResult = await authService.login('testuser@verdexis.com', 'TestPass123!');
      console.log('Login Result:', loginResult);
      
      if (loginResult.success) {
        console.log('✅ EXISTING USER LOGIN: SUCCESS!');
      }
    }
  }
}

testOTPVerification().catch(console.error);