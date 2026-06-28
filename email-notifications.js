const AWS = require('aws-sdk');

class EmailNotificationService {
  constructor() {
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION
    });
  }

  async sendEmail(email, subject, htmlBody) {
    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } }
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

  // Welcome email for new users
  async sendWelcomeEmail(email, name) {
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to Verdexis!</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Hello ${name}!</h2>
            <p>Your account has been successfully created and verified.</p>
            <p>You can now access all features of Verdexis:</p>
            <ul>
              <li>Trading & Portfolio Management</li>
              <li>Real-time Market Data</li>
              <li>Advanced Analytics</li>
              <li>Crypto Wallet</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/dashboard" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'Welcome to Verdexis!', htmlBody);
  }

  // Login alert
  async sendLoginAlert(email, ipAddress, deviceInfo) {
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f9f9f9; padding: 20px;">
            <h2>New Login Detected</h2>
            <p>Your account was accessed from:</p>
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>IP Address:</strong> ${ipAddress}</p>
              <p><strong>Device:</strong> ${deviceInfo}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>If this wasn't you, please <a href="${process.env.APP_URL}/security">secure your account</a> immediately.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'New Login to Your Verdexis Account', htmlBody);
  }

  // Trade confirmation
  async sendTradeConfirmation(email, tradeDetails) {
    const { symbol, type, quantity, price, total } = tradeDetails;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f9f9f9; padding: 20px;">
            <h2>Trade Confirmation</h2>
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Action:</strong> ${type.toUpperCase()}</p>
              <p><strong>Asset:</strong> ${symbol}</p>
              <p><strong>Quantity:</strong> ${quantity}</p>
              <p><strong>Price:</strong> $${price}</p>
              <p><strong>Total:</strong> $${total}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, `Trade Confirmation - ${symbol}`, htmlBody);
  }

  // Deposit confirmation
  async sendDepositConfirmation(email, depositDetails) {
    const { amount, currency, status } = depositDetails;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f9f9f9; padding: 20px;">
            <h2>Deposit Confirmation</h2>
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Amount:</strong> ${amount} ${currency}</p>
              <p><strong>Status:</strong> ${status}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'Deposit Received', htmlBody);
  }

  // Withdrawal confirmation
  async sendWithdrawalConfirmation(email, withdrawalDetails) {
    const { amount, currency, address, status } = withdrawalDetails;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f9f9f9; padding: 20px;">
            <h2>Withdrawal Initiated</h2>
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Amount:</strong> ${amount} ${currency}</p>
              <p><strong>To Address:</strong> ${address.substring(0, 10)}...</p>
              <p><strong>Status:</strong> ${status}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'Withdrawal Initiated', htmlBody);
  }

  // Security alert
  async sendSecurityAlert(email, alertType, details) {
    const messages = {
      passwordChange: 'Your password was changed',
      ipChange: 'Login from new IP address',
      deviceChange: 'Login from new device',
      suspiciousActivity: 'Suspicious activity detected'
    };

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Security Alert</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>${messages[alertType] || 'Security Alert'}</h2>
            <p>${details}</p>
            <p>If this wasn't you, please contact support immediately.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/security" style="background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Security</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, '🔒 Security Alert - Action Required', htmlBody);
  }

  // KYC status update
  async sendKYCUpdate(email, status) {
    const statusMessages = {
      pending: 'Your KYC submission is being reviewed',
      approved: 'Your account has been verified!',
      rejected: 'Your KYC submission was rejected. Please try again.',
      needsUpdate: 'We need additional information for KYC'
    };

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f9f9f9; padding: 20px;">
            <h2>KYC Status Update</h2>
            <p>${statusMessages[status] || 'KYC status updated'}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/kyc" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Check Status</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'KYC Status Update', htmlBody);
  }
}

module.exports = EmailNotificationService;