const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const AWS = require('aws-sdk');

class TwoFactorAuthService {
  constructor() {
    this.sns = new AWS.SNS({
      region: process.env.AWS_REGION
    });
    this.twoFactorStorage = new Map(); // Use Redis in production
  }

  // Generate TOTP secret
  async generateTOTPSecret(email) {
    const secret = speakeasy.generateSecret({
      name: `Verdexis (${email})`,
      issuer: 'Verdexis',
      length: 32
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes: this.generateBackupCodes()
    };
  }

  // Verify TOTP token
  verifyTOTPToken(secret, token) {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time windows tolerance
      });

      return verified ? { valid: true } : { valid: false, error: 'Invalid TOTP code' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  // Enable 2FA
  async enableTwoFactorAuth(email, method = 'totp') {
    try {
      if (method === 'totp') {
        const totpData = await this.generateTOTPSecret(email);
        this.twoFactorStorage.set(`2fa_${email}`, {
          method: 'totp',
          secret: totpData.secret,
          backupCodes: totpData.backupCodes,
          enabled: false,
          createdAt: Date.now()
        });

        return {
          success: true,
          method: 'totp',
          secret: totpData.secret,
          qrCode: totpData.qrCode,
          backupCodes: totpData.backupCodes
        };
      } else if (method === 'sms') {
        this.twoFactorStorage.set(`2fa_${email}`, {
          method: 'sms',
          enabled: false,
          createdAt: Date.now()
        });

        return {
          success: true,
          method: 'sms',
          message: 'SMS 2FA will be configured'
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Confirm 2FA setup
  confirmTwoFactorSetup(email, token) {
    try {
      const twoFAData = this.twoFactorStorage.get(`2fa_${email}`);

      if (!twoFAData) {
        return { success: false, error: '2FA setup not found' };
      }

      if (twoFAData.method === 'totp') {
        const verification = this.verifyTOTPToken(twoFAData.secret, token);

        if (!verification.valid) {
          return verification;
        }

        twoFAData.enabled = true;
        return {
          success: true,
          message: '2FA enabled successfully',
          backupCodes: twoFAData.backupCodes
        };
      }

      return { success: false, error: 'Unknown 2FA method' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify 2FA during login
  verifyTwoFactor(email, token, method = 'totp') {
    try {
      const twoFAData = this.twoFactorStorage.get(`2fa_${email}`);

      if (!twoFAData || !twoFAData.enabled) {
        return { valid: false, error: '2FA not enabled' };
      }

      if (method === 'totp') {
        return this.verifyTOTPToken(twoFAData.secret, token);
      }

      // Check backup codes
      if (twoFAData.backupCodes.includes(token)) {
        twoFAData.backupCodes = twoFAData.backupCodes.filter(code => code !== token);
        return { valid: true, message: 'Backup code used' };
      }

      return { valid: false, error: 'Invalid 2FA code' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Send SMS 2FA code
  async sendSMS2FACode(phoneNumber) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const params = {
      PhoneNumber: phoneNumber,
      Message: `Your Verdexis 2FA code: ${code}. Valid for 5 minutes.`,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Verdexis'
        }
      }
    };

    try {
      await this.sns.publish(params).promise();
      
      // Store code temporarily
      this.twoFactorStorage.set(`2fa_sms_${phoneNumber}`, {
        code,
        expiry: Date.now() + (5 * 60 * 1000)
      });

      return { success: true, message: 'SMS code sent' };
    } catch (error) {
      console.error('SMS error:', error);
      return { success: false, error: error.message };
    }
  }

  // Disable 2FA
  disableTwoFactorAuth(email) {
    this.twoFactorStorage.delete(`2fa_${email}`);
    return { success: true, message: '2FA disabled' };
  }

  // Get 2FA status
  getTwoFactorStatus(email) {
    const twoFAData = this.twoFactorStorage.get(`2fa_${email}`);

    if (!twoFAData) {
      return { enabled: false };
    }

    return {
      enabled: twoFAData.enabled,
      method: twoFAData.method,
      backupCodesCount: twoFAData.backupCodes ? twoFAData.backupCodes.length : 0
    };
  }
}

module.exports = TwoFactorAuthService;