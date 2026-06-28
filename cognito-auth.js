const AWS = require('aws-sdk');
const crypto = require('crypto');

class VerdexisCognitoAuth {
  constructor() {
    this.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
  }

  // Calculate SECRET_HASH for Cognito
  calculateSecretHash(username) {
    if (!process.env.AWS_COGNITO_CLIENT_SECRET) return undefined;
    
    return crypto
      .createHmac('sha256', process.env.AWS_COGNITO_CLIENT_SECRET)
      .update(username + this.clientId)
      .digest('base64');
  }

  // Sign up new user with phone number
  async signUp(email, phoneNumber, password, name) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'phone_number', Value: phoneNumber },
        { Name: 'name', Value: name }
      ],
      SecretHash: this.calculateSecretHash(email)
    };

    try {
      const result = await this.cognitoIdentityServiceProvider.signUp(params).promise();
      return {
        success: true,
        userSub: result.UserSub,
        message: 'User created. Please verify phone number.'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Confirm sign up with SMS OTP
  async confirmSignUp(email, confirmationCode) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: confirmationCode,
      SecretHash: this.calculateSecretHash(email)
    };

    try {
      await this.cognitoIdentityServiceProvider.confirmSignUp(params).promise();
      return { success: true, message: 'Phone number verified successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Sign in user
  async signIn(email, password) {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: this.calculateSecretHash(email)
      }
    };

    try {
      const result = await this.cognitoIdentityServiceProvider.initiateAuth(params).promise();
      
      if (result.ChallengeName === 'SMS_MFA') {
        return {
          success: true,
          requiresOTP: true,
          session: result.Session,
          message: 'OTP sent to your phone'
        };
      }

      return {
        success: true,
        accessToken: result.AuthenticationResult.AccessToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        idToken: result.AuthenticationResult.IdToken,
        message: 'Signed in successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify OTP during sign in
  async verifyOTP(email, otpCode, session) {
    const params = {
      ClientId: this.clientId,
      ChallengeName: 'SMS_MFA',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        SMS_MFA_CODE: otpCode,
        SECRET_HASH: this.calculateSecretHash(email)
      }
    };

    try {
      const result = await this.cognitoIdentityServiceProvider.respondToAuthChallenge(params).promise();
      return {
        success: true,
        accessToken: result.AuthenticationResult.AccessToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        idToken: result.AuthenticationResult.IdToken,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get user info from token
  async getUserInfo(accessToken) {
    const params = {
      AccessToken: accessToken
    };

    try {
      const result = await this.cognitoIdentityServiceProvider.getUser(params).promise();
      const attributes = {};
      result.UserAttributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });

      return {
        success: true,
        username: result.Username,
        attributes: attributes
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Resend confirmation code
  async resendConfirmationCode(email) {
    const params = {
      ClientId: this.clientId,
      Username: email,
      SecretHash: this.calculateSecretHash(email)
    };

    try {
      await this.cognitoIdentityServiceProvider.resendConfirmationCode(params).promise();
      return { success: true, message: 'Confirmation code resent' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Enable MFA for existing user
  async enableMFA(accessToken) {
    const params = {
      AccessToken: accessToken,
      SMSMfaSettings: {
        Enabled: true,
        PreferredMfa: true
      }
    };

    try {
      await this.cognitoIdentityServiceProvider.setUserMFAPreference(params).promise();
      return { success: true, message: 'MFA enabled successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = VerdexisCognitoAuth;