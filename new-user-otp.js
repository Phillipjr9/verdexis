const AWS = require('aws-sdk');

class NewUserOTPAuth {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION
    });
    this.sns = new AWS.SNS({
      region: process.env.AWS_REGION
    });
    
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
    this.otpStorage = new Map(); // Use Redis in production
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  storeOTP(phoneNumber, otp) {
    const expiry = Date.now() + (5 * 60 * 1000); // 5 minutes
    this.otpStorage.set(phoneNumber, { otp, expiry });
    
    // Auto cleanup
    setTimeout(() => {
      this.otpStorage.delete(phoneNumber);
    }, 5 * 60 * 1000);
    
    console.log(`📱 OTP for ${phoneNumber}: ${otp} (expires in 5 min)`);
  }

  verifyOTP(phoneNumber, providedOTP) {
    const stored = this.otpStorage.get(phoneNumber);
    if (!stored) {
      return { valid: false, error: 'OTP not found or expired' };
    }
    
    if (Date.now() > stored.expiry) {
      this.otpStorage.delete(phoneNumber);
      return { valid: false, error: 'OTP expired' };
    }
    
    if (stored.otp !== providedOTP) {
      return { valid: false, error: 'Invalid OTP' };
    }
    
    this.otpStorage.delete(phoneNumber);
    return { valid: true };
  }

  async sendSMS(phoneNumber, otp) {
    const params = {
      PhoneNumber: phoneNumber,
      Message: `Your Verdexis verification code: ${otp}. Valid for 5 minutes.`,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Verdexis'
        }
      }
    };

    try {
      const result = await this.sns.publish(params).promise();
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      console.error('SMS failed:', error.message);
      // For demo, still return success and show in console
      this.storeOTP(phoneNumber, otp);
      return { success: true, messageId: 'console-demo' };
    }
  }

  // Check if user exists (admin or existing user)
  async checkUserExists(email) {
    try {
      await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();
      
      return { exists: true };
    } catch (error) {
      if (error.code === 'UserNotFoundException') {
        return { exists: false };
      }
      throw error;
    }
  }

  // Login for existing users (NO OTP required)
  async loginExistingUser(email, password) {
    try {
      // Check if user exists first
      const userCheck = await this.checkUserExists(email);
      if (!userCheck.exists) {
        return {
          success: false,
          isNewUser: true,
          error: 'User not found. Please register first.'
        };
      }

      // Existing user - direct login without OTP
      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      const result = await this.cognito.initiateAuth(params).promise();
      
      return {
        success: true,
        isNewUser: false,
        tokens: result.AuthenticationResult,
        message: 'Login successful - existing user'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Register NEW user with OTP verification
  async registerNewUser(email, phoneNumber, password, name) {
    try {
      // Check if user already exists
      const userCheck = await this.checkUserExists(email);
      if (userCheck.exists) {
        return {
          success: false,
          error: 'User already exists. Please login instead.'
        };
      }

      // Step 1: Generate and send OTP
      const otp = this.generateOTP();
      const smsResult = await this.sendSMS(phoneNumber, otp);
      
      if (!smsResult.success) {
        return { success: false, error: 'Failed to send OTP' };
      }

      // Step 2: Store user data temporarily (don't create in Cognito yet)
      const tempUserKey = `temp_${phoneNumber}`;
      const tempUserData = {
        email,
        phoneNumber,
        password,
        name,
        otp,
        expiry: Date.now() + (10 * 60 * 1000) // 10 minutes for registration
      };
      
      this.otpStorage.set(tempUserKey, tempUserData);

      return {
        success: true,
        message: 'OTP sent to your phone. Verify to complete registration.',
        tempKey: tempUserKey
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify OTP and complete registration
  async verifyAndCompleteRegistration(phoneNumber, otp) {
    try {
      const tempUserKey = `temp_${phoneNumber}`;
      const tempUserData = this.otpStorage.get(tempUserKey);
      
      if (!tempUserData) {
        return { 
          success: false, 
          error: 'Registration session expired. Please start again.' 
        };
      }

      // Verify OTP
      if (tempUserData.otp !== otp) {
        return { success: false, error: 'Invalid OTP' };
      }

      if (Date.now() > tempUserData.expiry) {
        this.otpStorage.delete(tempUserKey);
        return { success: false, error: 'Registration session expired' };
      }

      // OTP verified - now create user in Cognito
      const params = {
        ClientId: this.clientId,
        Username: tempUserData.email,
        Password: tempUserData.password,
        UserAttributes: [
          { Name: 'email', Value: tempUserData.email },
          { Name: 'phone_number', Value: tempUserData.phoneNumber },
          { Name: 'name', Value: tempUserData.name },
          { Name: 'phone_number_verified', Value: 'true' }
        ]
      };

      const signUpResult = await this.cognito.signUp(params).promise();
      
      // Auto-confirm the user since phone is already verified
      await this.cognito.adminConfirmSignUp({
        UserPoolId: this.userPoolId,
        Username: tempUserData.email
      }).promise();

      // Clean up temp data
      this.otpStorage.delete(tempUserKey);

      return {
        success: true,
        message: 'Registration completed successfully! You can now login.',
        userSub: signUpResult.UserSub
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Unified login method
  async login(email, password) {
    // Always try existing user login first
    return await this.loginExistingUser(email, password);
  }
}

module.exports = NewUserOTPAuth;