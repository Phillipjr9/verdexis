const AWS = require('aws-sdk');

class EmailNotificationService {
  constructor() {
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.emailLogs = [];
  }

  // Send generic email
  async sendEmail(email, subject, htmlBody, textBody = null) {
    const params = {
      Source: process.env.SES_FROM_EMAIL || 'noreply@verdexis.com',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: subject,
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

    if (textBody) {
      params.Message.Body.Text = {
        Data: textBody,
        Charset: 'UTF-8'
      };
    }

    try {
      const result = await this.ses.sendEmail(params).promise();
      this.logEmailSent(email, subject, 'success');
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      this.logEmailSent(email, subject, 'failed', error.message);
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
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Quick Start:</h3>
              <ul>
                <li>Complete your profile information</li>
                <li>Enable two-factor authentication</li>
                <li>Make your first deposit</li>
                <li>Start trading</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/dashboard" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Access Dashboard</a>
            </div>
            <p style="color: #666; font-size: 14px;">Questions? Check out our help center or contact support.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'Welcome to Verdexis!', htmlBody);
  }

  // Send OTP email
  async sendOTPEmail(email, otp, type = 'login') {
    const subject = type === 'login' ? 'Your Verdexis Login Code' : 'Your Verdexis Verification Code';
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
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, subject, htmlBody);
  }

  // Send transaction confirmation email
  async sendTransactionConfirmationEmail(email, transactionData) {
    const { type, amount, currency, date, reference, status } = transactionData;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Transaction Confirmation</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #667eea; margin-top: 0;">${type === 'deposit' ? '💰 Deposit' : '📤 Withdrawal'}</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">Amount:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;"><strong>${amount} ${currency}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">Date:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${new Date(date).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">Reference:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;"><code>${reference}</code></td>
                </tr>
                <tr>
                  <td style="padding: 8px;">Status:</td>
                  <td style="padding: 8px; text-align: right;">
                    <span style="background: ${status === 'completed' ? '#28a745' : '#ffc107'}; color: white; padding: 4px 8px; border-radius: 4px;">
                      ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            <p style="color: #666; font-size: 14px;">Thank you for using Verdexis!</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} Confirmation`, htmlBody);
  }

  // Send alert email
  async sendAlertEmail(email, alertData) {
    const { alertType, title, message, severity, action } = alertData;
    const severityColor = severity === 'critical' ? '#d9534f' : severity === 'warning' ? '#f0ad4e' : '#5cb85c';
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${severityColor}; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">${title}</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <p>${message}</p>
            <div style="background: white; padding: 15px; border-left: 4px solid ${severityColor}; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #333;">${alertType}</p>
            </div>
            ${action ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${action.url}" style="background: ${severityColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">${action.text}</a>
            </div>
            ` : ''}
            <p style="color: #666; font-size: 12px;">Severity: <strong>${severity.toUpperCase()}</strong></p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, title, htmlBody);
  }

  // Send KYC status email
  async sendKYCStatusEmail(email, kycData) {
    const { status, reason, nextSteps } = kycData;
    const statusColor = status === 'approved' ? '#28a745' : status === 'rejected' ? '#d9534f' : '#5bc0de';
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">KYC Status Update</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: ${statusColor}; margin-top: 0;">Status: ${status.toUpperCase()}</h2>
              ${reason ? `<p style="color: #666;">${reason}</p>` : ''}
              ${nextSteps ? `
              <div style="background: #f0f0f0; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin-top: 0;">Next Steps:</h3>
                <p style="color: #333; white-space: pre-wrap;">${nextSteps}</p>
              </div>
              ` : ''}
            </div>
            <div style="text-align: center;">
              <a href="${process.env.APP_URL}/verification" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, 'KYC Status Update', htmlBody);
  }

  // Send security alert email
  async sendSecurityAlertEmail(email, securityData) {
    const { eventType, timestamp, location, device, action } = securityData;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #d9534f; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Security Alert</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #d9534f; margin-top: 0;">Unusual Activity Detected</h2>
              <p><strong>Event:</strong> ${eventType}</p>
              <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
              ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
              ${device ? `<p><strong>Device:</strong> ${device}</p>` : ''}
            </div>
            <p style="color: #666;">If this wasn't you, please secure your account immediately:</p>
            <div style="text-align: center; margin: 30px 0;">
              ${action === 'verify' ? `
              <a href="${process.env.APP_URL}/verify-login" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Activity</a>
              ` : `
              <a href="${process.env.APP_URL}/change-password" style="background: #d9534f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Change Password</a>
              `}
            </div>
            <p style="color: #666; font-size: 12px;">Questions? Contact our support team immediately.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, '🔒 Security Alert - Unusual Activity', htmlBody);
  }

  // Send trading alert email
  async sendTradingAlertEmail(email, tradeData) {
    const { symbol, type, quantity, price, total, status, message } = tradeData;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Trade Executed</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: ${type === 'BUY' ? '#28a745' : '#d9534f'}; margin-top: 0;">${type} - ${symbol}</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">Quantity:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${quantity}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">Price:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(price).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">Total:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;"><strong>$${parseFloat(total).toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px;">Status:</td>
                  <td style="padding: 8px; text-align: right;">
                    <span style="background: ${status === 'completed' ? '#28a745' : '#ffc107'}; color: white; padding: 4px 8px; border-radius: 4px;">
                      ${status}
                    </span>
                  </td>
                </tr>
              </table>
              ${message ? `<p style="margin-top: 15px; color: #666;">${message}</p>` : ''}
            </div>
            <div style="text-align: center;">
              <a href="${process.env.APP_URL}/portfolio" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Portfolio</a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(email, `${type} Order - ${symbol}`, htmlBody);
  }

  // Send bulk email
  async sendBulkEmail(emails, subject, htmlBody) {
    const results = [];
    for (const email of emails) {
      const result = await this.sendEmail(email, subject, htmlBody);
      results.push({ email, ...result });
    }
    return results;
  }

  // Log email sent
  logEmailSent(email, subject, status, error = null) {
    this.emailLogs.push({
      timestamp: new Date().toISOString(),
      email,
      subject,
      status,
      error
    });
  }

  // Get email logs
  getEmailLogs(filter = {}) {
    let logs = [...this.emailLogs];
    
    if (filter.email) {
      logs = logs.filter(l => l.email === filter.email);
    }
    
    if (filter.status) {
      logs = logs.filter(l => l.status === filter.status);
    }
    
    if (filter.daysOld) {
      const cutoff = Date.now() - (filter.daysOld * 24 * 60 * 60 * 1000);
      logs = logs.filter(l => new Date(l.timestamp).getTime() > cutoff);
    }
    
    return logs.slice(-100).reverse();
  }

  // Get email statistics
  getEmailStats() {
    const stats = {
      total: this.emailLogs.length,
      sent: this.emailLogs.filter(l => l.status === 'success').length,
      failed: this.emailLogs.filter(l => l.status === 'failed').length,
      failureRate: this.emailLogs.length > 0 ? 
        ((this.emailLogs.filter(l => l.status === 'failed').length / this.emailLogs.length) * 100).toFixed(2) + '%'
        : '0%'
    };
    return stats;
  }
}

module.exports = EmailNotificationService;
