const AWS = require('aws-sdk');
const crypto = require('crypto');

class PasswordResetService {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION
    });
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION
    });
    
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
    this.resetTokens = new Map(); // Use Redis in production
  }

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  storeResetToken(email, token) {
    const expiry = Date.now() + (1 * 60 * 60 * 1000); // 1 hour
    this.resetTokens.set(token, { email, expiry });
    
    setTimeout(() => {
      this.resetTokens.delete(token);
    }, 1 * 60 * 60 * 1000);
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verdexis</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            </div>
            <p><strong>This link expires in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
            <p style="color: #999; font-size: 12px;">Or copy this link: ${resetLink}</p>
          </div>
        </body>
      </html>
    `;

    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: 'Reset Your Verdexis Password',
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
      await this.ses.sendEmail(params).promise();
      return { success: true };
    } catch (error) {
      console.error('Email error:', error);
      return { success: false, error: error.message };
    }
  }

  async requestPasswordReset(email) {
    try {
      // Check if user exists
      await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      // Generate and send reset token
      const token = this.generateResetToken();
      this.storeResetToken(email, token);
      
      const emailResult = await this.sendPasswordResetEmail(email, token);

      if (emailResult.success) {
        return {
          success: true,
          message: 'Password reset email sent successfully'
        };
      } else {
        return {
          success: false,
          error: 'Failed to send reset email'
        };
      }
    } catch (error) {
      if (error.code === 'UserNotFoundException') {
        // Don't reveal if user exists
        return {
          success: true,
          message: 'If email exists, reset link will be sent'
        };
      }
      return { success: false, error: error.message };
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const resetData = this.resetTokens.get(token);

      if (!resetData) {
        return { success: false, error: 'Invalid or expired reset token' };
      }

      if (Date.now() > resetData.expiry) {
        this.resetTokens.delete(token);
        return { success: false, error: 'Reset token has expired' };
      }

      const email = resetData.email;

      // Generate temporary password for admin
      const tempPassword = crypto.randomBytes(16).toString('hex');

      // Set new password
      await this.cognito.adminSetUserPassword({
        UserPoolId: this.userPoolId,
        Username: email,
        Password: newPassword,
        Permanent: true
      }).promise();

      // Clean up token
      this.resetTokens.delete(token);

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async changePassword(email, oldPassword, newPassword) {
    try {
      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: oldPassword
        }
      };

      const authResult = await this.cognito.initiateAuth(params).promise();

      if (!authResult.AuthenticationResult?.AccessToken) {
        return { success: false, error: 'Authentication failed' };
      }

      await this.cognito.changePassword({
        AccessToken: authResult.AuthenticationResult.AccessToken,
        PreviousPassword: oldPassword,
        ProposedPassword: newPassword
      }).promise();

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = PasswordResetService;