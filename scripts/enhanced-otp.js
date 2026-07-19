const AWS = require('aws-sdk');
const EmailNotificationService = require('./email-service');

class EnhancedOTPService {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION
    });
    this.sns = new AWS.SNS({
      region: process.env.AWS_REGION
    });
    this.emailService = new EmailNotificationService();
    
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
    this.otpStorage = new Map(); // Use Redis in production
  }

  // Generate 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP with expiration
  storeOTP(key, otp, expiryMinutes = 5) {
    const expiry = Date.now() + (expiryMinutes * 60 * 1000);
    this.otpStorage.set(key, { otp, expiry });
    
    // Auto cleanup after expiry
    setTimeout(() => {
      this.otpStorage.delete(key);
    }, expiryMinutes * 60 * 1000);
  }

  // Verify stored OTP
  verifyStoredOTP(key, providedOTP) {
    const stored = this.otpStorage.get(key);
    if (!stored) return { valid: false, error: 'OTP not found or expired' };
    
    if (Date.now() > stored.expiry) {
      this.otpStorage.delete(key);
      return { valid: false, error: 'OTP expired' };
    }
    
    if (stored.otp !== providedOTP) {
      return { valid: false, error: 'Invalid OTP' };
    }
    
    this.otpStorage.delete(key);
    return { valid: true };
  }

  // Send OTP via SMS
  async sendSMSOTP(phoneNumber, otp) {
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
      console.error('SMS failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Register user with dual notification
  async registerUserWithOTP(email, phoneNumber, password, name, preferredMethod = 'email') {
    try {
      // First try Cognito registration
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
      
      // Generate and send OTP via preferred method
      const otp = this.generateOTP();
      const otpKey = `register_${email}`;
      this.storeOTP(otpKey, otp);

      let result;
      if (preferredMethod === 'sms' && phoneNumber) {
        result = await this.sendSMSOTP(phoneNumber, otp);
      } else {
        result = await this.emailService.sendOTPEmail(email, otp, 'registration');
      }

      if (result.success) {
        return {
          success: true,
          message: `OTP sent via ${preferredMethod}`,
          method: preferredMethod
        };
      } else {
        // Fallback to other method
        const fallbackMethod = preferredMethod === 'sms' ? 'email' : 'sms';
        const fallbackResult = fallbackMethod === 'sms' 
          ? await this.sendSMSOTP(phoneNumber, otp)
          : await this.emailService.sendOTPEmail(email, otp, 'registration');
          
        if (fallbackResult.success) {
          return {
            success: true,
            message: `OTP sent via ${fallbackMethod} (fallback)`,
            method: fallbackMethod
          };
        } else {
          return { success: false, error: 'Failed to send OTP via any method' };
        }
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify registration OTP
  async verifyRegistrationOTP(email, otp) {
    // First check our stored OTP
    const otpKey = `register_${email}`;
    const verification = this.verifyStoredOTP(otpKey, otp);
    
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    // Confirm with Cognito
    try {
      const params = {
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: '000000' // Dummy code since we're handling OTP ourselves
      };

      // For custom OTP, we need to admin confirm the user
      await this.cognito.adminConfirmSignUp({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      // Send welcome email
      const userInfo = await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();
      
      const nameAttr = userInfo.UserAttributes.find(attr => attr.Name === 'name');
      await this.emailService.sendWelcomeEmail(email, nameAttr?.Value);

      return { success: true, message: 'Registration verified successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send login OTP
  async sendLoginOTP(email, method = 'email') {
    const otp = this.generateOTP();
    const otpKey = `login_${email}`;
    this.storeOTP(otpKey, otp);

    try {
      // Get user phone number from Cognito
      const userInfo = await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      const phoneAttr = userInfo.UserAttributes.find(attr => attr.Name === 'phone_number');
      
      let result;
      if (method === 'sms' && phoneAttr) {
        result = await this.sendSMSOTP(phoneAttr.Value, otp);
      } else {
        result = await this.emailService.sendOTPEmail(email, otp, 'login');
      }

      if (result.success) {
        return {
          success: true,
          message: `Login OTP sent via ${method}`,
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
  async verifyLoginOTP(session, otp) {
    const verification = this.verifyStoredOTP(session, otp);
    
    if (verification.valid) {
      return { success: true, message: 'Login OTP verified' };
    } else {
      return { success: false, error: verification.error };
    }
  }
}

module.exports = EnhancedOTPService;