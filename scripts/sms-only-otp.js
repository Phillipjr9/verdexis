const AWS = require('aws-sdk');

class SMSOnlyOTP {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION
    });
    this.sns = new AWS.SNS({
      region: process.env.AWS_REGION
    });
    
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
    this.otpStorage = new Map();
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  storeOTP(key, otp) {
    const expiry = Date.now() + (5 * 60 * 1000); // 5 minutes
    this.otpStorage.set(key, { otp, expiry });
    
    setTimeout(() => {
      this.otpStorage.delete(key);
    }, 5 * 60 * 1000);
  }

  verifyStoredOTP(key, providedOTP) {
    const stored = this.otpStorage.get(key);
    if (!stored) return { valid: false, error: 'OTP expired or not found' };
    
    if (Date.now() > stored.expiry) {
      this.otpStorage.delete(key);
      return { valid: false, error: 'OTP expired' };
    }
    
    if (stored.otp !== providedOTP) {
      return { valid: false, error: 'Invalid OTP code' };
    }
    
    this.otpStorage.delete(key);
    return { valid: true };
  }

  async sendSMS(phoneNumber, message) {
    const params = {
      PhoneNumber: phoneNumber,
      Message: message,
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
      console.error('SMS Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Register user with SMS OTP
  async registerUser(email, phoneNumber, password, name) {
    try {
      // Create user in Cognito
      const params = {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'phone_number', Value: phoneNumber },
          { Name: 'name', Value: name }
        ]
      };

      await this.cognito.signUp(params).promise();
      
      // Generate and send OTP via SMS
      const otp = this.generateOTP();
      const otpKey = `register_${email}`;
      this.storeOTP(otpKey, otp);

      const smsResult = await this.sendSMS(
        phoneNumber, 
        `Your Verdexis verification code: ${otp}. Valid for 5 minutes.`
      );

      if (smsResult.success) {
        return {
          success: true,
          message: 'SMS OTP sent to your phone',
          otpKey: otpKey
        };
      } else {
        return { success: false, error: 'Failed to send SMS OTP' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify registration OTP
  async verifyRegistration(email, otp) {
    const otpKey = `register_${email}`;
    const verification = this.verifyStoredOTP(otpKey, otp);
    
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    try {
      // Confirm user in Cognito
      await this.cognito.adminConfirmSignUp({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      return { success: true, message: 'Registration verified!' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send login OTP
  async sendLoginOTP(email) {
    try {
      const userInfo = await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      const phoneAttr = userInfo.UserAttributes.find(attr => attr.Name === 'phone_number');
      if (!phoneAttr) {
        return { success: false, error: 'No phone number on file' };
      }

      const otp = this.generateOTP();
      const otpKey = `login_${email}`;
      this.storeOTP(otpKey, otp);

      const smsResult = await this.sendSMS(
        phoneAttr.Value,
        `Verdexis login code: ${otp}. Valid for 5 minutes.`
      );

      if (smsResult.success) {
        return {
          success: true,
          message: 'Login OTP sent',
          session: otpKey
        };
      } else {
        return { success: false, error: 'Failed to send login OTP' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify login OTP
  async verifyLogin(session, otp) {
    const verification = this.verifyStoredOTP(session, otp);
    
    if (verification.valid) {
      return { success: true, message: 'Login successful!' };
    } else {
      return { success: false, error: verification.error };
    }
  }
}

module.exports = SMSOnlyOTP;