// REAL USAGE EXAMPLES - Copy and paste into your frontend/app

// 1. NEW USER REGISTRATION
const registerNewUser = async () => {
  const response = await fetch('http://localhost:3004/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'john@example.com',
      phoneNumber: '+1234567890',
      password: 'SecurePass123!',
      name: 'John Doe'
    })
  });
  
  const result = await response.json();
  console.log(result);
  // Response: { success: true, message: 'OTP sent...', tempKey: '...' }
};

// 2. VERIFY NEW USER OTP
const verifyNewUserOTP = async () => {
  const response = await fetch('http://localhost:3004/api/verify-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: '+1234567890',
      otp: '123456'  // OTP received via SMS
    })
  });
  
  const result = await response.json();
  console.log(result);
  // Response: { success: true, message: 'Registration completed...', userSub: '...' }
};

// 3. EXISTING USER LOGIN (NO OTP)
const loginExistingUser = async () => {
  const response = await fetch('http://localhost:3004/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'john@example.com',
      password: 'SecurePass123!'
    })
  });
  
  const result = await response.json();
  console.log(result);
  // Response: { success: true, tokens: {...}, message: 'Login successful...' }
};

// 4. ADMIN LOGIN (NO OTP)
const adminLogin = async () => {
  const response = await fetch('http://localhost:3004/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@verdexis.com',
      password: 'AdminPass123!'
    })
  });
  
  const result = await response.json();
  console.log(result);
  // Response: { success: true, tokens: {...}, message: 'Login successful...' }
};

// 5. GET USER PROFILE (PROTECTED)
const getUserProfile = async (accessToken) => {
  const response = await fetch('http://localhost:3004/api/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log(result);
  // Response: { success: true, user: {...} }
};

// 6. LOGOUT
const logout = async () => {
  const response = await fetch('http://localhost:3004/api/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  const result = await response.json();
  console.log(result);
  // Response: { success: true, message: 'Logged out successfully' }
};

console.log('✅ All authentication functions ready for use');
console.log('📌 Update API URL based on your deployment (localhost:3004 is for local development)');
