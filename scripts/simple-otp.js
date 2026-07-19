const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const sns = new AWS.SNS();

class SimpleOTP {
  // Generate 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP via SMS
  async sendOTP(phoneNumber, otp) {
    const params = {
      PhoneNumber: phoneNumber,
      Message: `Your Verdexis verification code: ${otp}`,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Verdexis'
        }
      }
    };

    try {
      const result = await sns.publish(params).promise();
      console.log('SMS sent:', result.MessageId);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      console.error('SMS failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Complete flow
  async requestOTP(phoneNumber) {
    const otp = this.generateOTP();
    
    // Store OTP in memory/database (add your storage logic)
    // For production, use Redis or DynamoDB
    
    const result = await this.sendOTP(phoneNumber, otp);
    
    if (result.success) {
      return { success: true, message: 'OTP sent successfully' };
    } else {
      return { success: false, error: result.error };
    }
  }
}

module.exports = SimpleOTP;

// Usage example:
// const otpService = new SimpleOTP();
// otpService.requestOTP('+1234567890');