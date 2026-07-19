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
    this.resetTokens = new Map(); // Use DynamoDB in production
  }

  // Generate reset token
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Initiate password reset
  async initiatePasswordReset(email) {
    try {
      const token = this.generateResetToken();
      const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour

      this.resetTokens.set(token, {
        email,
        expiryTime,
        used: false,
        createdAt: Date.now()
      });

      // Verify user exists
      await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      // Send reset email
      const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;
      await this.sendPasswordResetEmail(email, resetLink);

      return {
        success: true,
        message: 'Password reset link sent to email'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code === 'UserNotFoundException' ? 'User not found' : error.message
      };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, resetLink) {
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verdexis</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            </div>
            <p><strong>This link expires in 1 hour.</strong></p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
            <p style="color: #666; font-size: 12px;">Or paste this link: ${resetLink}</p>
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

    return this.ses.sendEmail(params).promise();
  }

  // Validate reset token
  validateResetToken(token) {
    const tokenData = this.resetTokens.get(token);

    if (!tokenData) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    if (tokenData.used) {
      return { valid: false, error: 'Token already used' };
    }

    if (Date.now() > tokenData.expiryTime) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, email: tokenData.email };
  }

  // Reset password with token
  async resetPasswordWithToken(token, newPassword) {
    try {
      const validation = this.validateResetToken(token);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const email = validation.email;

      // Set permanent password
      await this.cognito.adminSetUserPassword({
        UserPoolId: this.userPoolId,
        Username: email,
        Password: newPassword,
        Permanent: true
      }).promise();

      // Mark token as used
      const tokenData = this.resetTokens.get(token);
      tokenData.used = true;
      tokenData.usedAt = Date.now();

      // Send confirmation email
      await this.sendPasswordResetConfirmationEmail(email);

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send password reset confirmation email
  async sendPasswordResetConfirmationEmail(email) {
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verdexis</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Password Changed Successfully</h2>
            <p>Your password has been successfully reset.</p>
            <p>You can now log in with your new password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/login" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Login</a>
            </div>
            <p style="color: #666; font-size: 14px;">If you didn't make this change, please contact support immediately.</p>
          </div>
        </body>
      </html>
    `;

    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: 'Your Password Has Been Changed',
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

    return this.ses.sendEmail(params).promise();
  }

  // Change password (authenticated user)
  async changePassword(email, currentPassword, newPassword) {
    try {
      const result = await this.cognito.changePassword({
        AccessToken: await this.getAccessToken(email, currentPassword),
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword
      }).promise();

      // Send notification email
      await this.sendPasswordChangeNotificationEmail(email);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code === 'NotAuthorizedException' ? 'Current password is incorrect' : error.message
      };
    }
  }

  // Send password change notification email
  async sendPasswordChangeNotificationEmail(email) {
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verdexis</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Security Alert</h2>
            <p>Your password was changed on ${new Date().toLocaleString()}</p>
            <p>If you didn't make this change, please reset your password immediately.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/forgot-password" style="background: #d9534f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            </div>
          </div>
        </body>
      </html>
    `;

    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: 'Password Change Notification',
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

    return this.ses.sendEmail(params).promise();
  }

  // Clean up expired tokens
  cleanupExpiredTokens() {
    let cleaned = 0;
    for (const [token, data] of this.resetTokens.entries()) {
      if (Date.now() > data.expiryTime) {
        this.resetTokens.delete(token);
        cleaned++;
      }
    }
    return { cleaned, remaining: this.resetTokens.size };
  }

  // Get reset token status
  getResetTokenStatus(token) {
    const tokenData = this.resetTokens.get(token);
    
    if (!tokenData) {
      return { exists: false };
    }

    return {
      exists: true,
      email: tokenData.email,
      expiresIn: Math.max(0, tokenData.expiryTime - Date.now()),
      used: tokenData.used,
      createdAt: new Date(tokenData.createdAt).toISOString()
    };
  }
}

module.exports = PasswordResetService;
