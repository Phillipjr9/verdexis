require('dotenv').config();
const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_REGION
});

// Test registration
async function testRegister() {
  const params = {
    ClientId: process.env.AWS_COGNITO_CLIENT_ID,
    Username: 'test@verdexis.com',
    Password: 'TempPass123!',
    UserAttributes: [
      { Name: 'email', Value: 'test@verdexis.com' },
      { Name: 'phone_number', Value: '+1234567890' }
    ]
  };

  try {
    const result = await cognito.signUp(params).promise();
    console.log('✅ Registration successful:', result.UserSub);
    return result;
  } catch (error) {
    console.log('❌ Registration failed:', error.message);
  }
}

testRegister();