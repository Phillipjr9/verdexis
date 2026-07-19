const AWS = require('aws-sdk');

class CognitoOTP {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
  }

  // Register user with phone verification
  async registerUser(email, phoneNumber, password) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'phone_number', Value: phoneNumber }
      ]
    };

    try {
      const result = await this.cognito.signUp(params).promise();
      return { success: true, message: 'OTP sent to phone' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify phone with OTP
  async verifyOTP(email, otpCode) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: otpCode
    };

    try {
      await this.cognito.confirmSignUp(params).promise();
      return { success: true, message: 'Phone verified' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Login with MFA
  async login(email, password) {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    try {
      const result = await this.cognito.initiateAuth(params).promise();
      
      if (result.ChallengeName === 'SMS_MFA') {
        return {
          success: true,
          requiresOTP: true,
          session: result.Session
        };
      }

      return {
        success: true,
        tokens: result.AuthenticationResult
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify login OTP
  async verifyLoginOTP(email, otpCode, session) {
    const params = {
      ClientId: this.clientId,
      ChallengeName: 'SMS_MFA',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        SMS_MFA_CODE: otpCode
      }
    };

    try {
      const result = await this.cognito.respondToAuthChallenge(params).promise();
      return {
        success: true,
        tokens: result.AuthenticationResult
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = CognitoOTP;