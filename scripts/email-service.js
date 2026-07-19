const AWS = require('aws-sdk');

class EmailNotificationService {
  constructor() {
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  // Send OTP via email
  async sendOTPEmail(email, otp, type = 'login') {
    const subject = type === 'login' ? 'Verdexis Login Code' : 'Verdexis Verification Code';
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verdexis</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Your Verification Code</h2>
            <p>Use this code to ${type === 'login' ? 'complete your login' : 'verify your account'}:</p>
            <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #667eea; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p><strong>This code expires in 5 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div style="padding: 10px; text-align: center; color: #666; font-size: 12px;">
            <p>© 2024 Verdexis. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: `Your Verdexis verification code is: ${otp}. This code expires in 5 minutes.`,
            Charset: 'UTF-8'
          }
        }
      }
    };

    try {
      const result = await this.ses.sendEmail(params).promise();
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send welcome email
  async sendWelcomeEmail(email, name) {
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to Verdexis!</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Hello ${name || 'there'}!</h2>
            <p>Welcome to Verdexis! Your account has been successfully verified.</p>
            <p>You can now access all features of our platform.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://verdexis.com/dashboard" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Access Dashboard</a>
            </div>
            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
        </body>
      </html>
    `;

    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: 'Welcome to Verdexis!',
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          }
        }
      }
    };

    try {
      const result = await this.ses.sendEmail(params).promise();
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailNotificationService;