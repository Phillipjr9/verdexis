/**
 * OTP (One-Time Password) Authentication Service
 * Handles generation, validation, storage, and delivery of OTP codes
 * 
 * Features:
 * - 6-digit numeric OTP generation
 * - Configurable expiration times
 * - Rate limiting and brute-force protection
 * - Multiple OTP methods (email, SMS, TOTP)
 * - Secure storage and validation
 */

const crypto = require('crypto');

class OTPService {
  constructor(config = {}) {
    this.config = {
      otpLength: config.otpLength || 6,
      expirationTime: config.expirationTime || 10 * 60 * 1000, // 10 minutes
      maxAttempts: config.maxAttempts || 5,
      lockoutDuration: config.lockoutDuration || 30 * 60 * 1000, // 30 minutes
      rateLimit: config.rateLimit || 5, // max OTP requests per hour
      rateLimitWindow: config.rateLimitWindow || 60 * 60 * 1000, // 1 hour
      ...config
    };
    
    // In-memory storage (use database in production)
    this.otpStore = new Map();
    this.attemptStore = new Map();
    this.rateLimitStore = new Map();
  }

  /**
   * Generate a random OTP code
   */
  generateOTP(length = this.config.otpLength) {
    if (length === 6) {
      // Numeric 6-digit code
      return Math.floor(100000 + Math.random() * 900000).toString();
    } else if (length === 8) {
      // Alphanumeric code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }
    // Default to numeric
    return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1))).toString();
  }

  /**
   * Hash OTP code for secure storage
   */
  hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Create OTP for a user
   */
  createOTP(userId, purpose = 'verification', metadata = {}) {
    // Check rate limit
    if (this.isRateLimited(userId)) {
      throw new Error(`Too many OTP requests. Try again in ${this.getRetryAfter(userId)} seconds.`);
    }

    // Check if user is locked out
    if (this.isLockedOut(userId)) {
      throw new Error(`Too many failed attempts. Try again in ${this.getLockoutTime(userId)} seconds.`);
    }

    const otp = this.generateOTP();
    const hashedOtp = this.hashOTP(otp);
    const expiresAt = Date.now() + this.config.expirationTime;

    // Store OTP
    this.otpStore.set(userId, {
      hashedOtp,
      purpose,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      metadata,
      used: false
    });

    // Track rate limit
    this.trackRateLimit(userId);

    return {
      otp,
      expiresAt,
      expirationMinutes: Math.ceil(this.config.expirationTime / 60000),
      userId
    };
  }

  /**
   * Verify OTP code
   */
  verifyOTP(userId, otp, purpose = null) {
    const record = this.otpStore.get(userId);

    // Check if OTP exists
    if (!record) {
      this.recordFailedAttempt(userId);
      throw new Error('Invalid verification code');
    }

    // Check if expired
    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(userId);
      throw new Error('Verification code has expired');
    }

    // Check if already used
    if (record.used) {
      this.recordFailedAttempt(userId);
      throw new Error('Verification code has already been used');
    }

    // Check purpose if specified
    if (purpose && record.purpose !== purpose) {
      this.recordFailedAttempt(userId);
      throw new Error('Invalid verification code for this action');
    }

    // Increment attempts
    record.attempts += 1;

    // Check max attempts
    if (record.attempts > this.config.maxAttempts) {
      this.otpStore.delete(userId);
      this.lockOutUser(userId);
      throw new Error(`Too many failed attempts. Please try again later.`);
    }

    // Verify OTP
    const hashedInput = this.hashOTP(otp);
    if (hashedInput !== record.hashedOtp) {
      this.otpStore.set(userId, record);
      throw new Error('Invalid verification code');
    }

    // Mark as used
    record.used = true;
    record.verifiedAt = Date.now();

    return {
      success: true,
      userId,
      purpose: record.purpose,
      metadata: record.metadata,
      verifiedAt: record.verifiedAt
    };
  }

  /**
   * Consume OTP after verification
   */
  consumeOTP(userId) {
    this.otpStore.delete(userId);
    this.attemptStore.delete(userId);
  }

  /**
   * Record failed authentication attempt
   */
  recordFailedAttempt(userId) {
    const attempts = this.attemptStore.get(userId) || [];
    attempts.push(Date.now());
    
    // Clean old attempts
    const recentAttempts = attempts.filter(t => Date.now() - t < this.config.lockoutDuration);
    
    if (recentAttempts.length >= this.config.maxAttempts) {
      this.lockOutUser(userId);
    }
    
    this.attemptStore.set(userId, recentAttempts);
  }

  /**
   * Lock out a user temporarily
   */
  lockOutUser(userId) {
    const lockUntil = Date.now() + this.config.lockoutDuration;
    this.attemptStore.set(`${userId}_lockout`, lockUntil);
  }

  /**
   * Check if user is locked out
   */
  isLockedOut(userId) {
    const lockout = this.attemptStore.get(`${userId}_lockout`);
    if (!lockout) return false;
    
    if (Date.now() > lockout) {
      this.attemptStore.delete(`${userId}_lockout`);
      return false;
    }
    
    return true;
  }

  /**
   * Get remaining lockout time in seconds
   */
  getLockoutTime(userId) {
    const lockout = this.attemptStore.get(`${userId}_lockout`);
    if (!lockout) return 0;
    return Math.ceil((lockout - Date.now()) / 1000);
  }

  /**
   * Track rate limit attempts
   */
  trackRateLimit(userId) {
    const requests = this.rateLimitStore.get(userId) || [];
    requests.push(Date.now());
    
    // Clean old requests
    const recentRequests = requests.filter(t => Date.now() - t < this.config.rateLimitWindow);
    
    this.rateLimitStore.set(userId, recentRequests);
  }

  /**
   * Check if user is rate limited
   */
  isRateLimited(userId) {
    const requests = this.rateLimitStore.get(userId) || [];
    const recentRequests = requests.filter(t => Date.now() - t < this.config.rateLimitWindow);
    return recentRequests.length >= this.config.rateLimit;
  }

  /**
   * Get retry after time in seconds
   */
  getRetryAfter(userId) {
    const requests = this.rateLimitStore.get(userId) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = requests[0];
    const retryAfter = (oldestRequest + this.config.rateLimitWindow) - Date.now();
    return Math.ceil(retryAfter / 1000);
  }

  /**
   * Get OTP info (without revealing the code)
   */
  getOTPInfo(userId) {
    const record = this.otpStore.get(userId);
    if (!record) return null;
    
    return {
      expiresAt: record.expiresAt,
      expirationMinutes: Math.ceil((record.expiresAt - Date.now()) / 60000),
      purpose: record.purpose,
      attempts: record.attempts,
      maxAttempts: this.config.maxAttempts,
      used: record.used
    };
  }

  /**
   * Clear OTP for user
   */
  clearOTP(userId) {
    this.otpStore.delete(userId);
  }

  /**
   * Clear all data (for testing/reset)
   */
  clear() {
    this.otpStore.clear();
    this.attemptStore.clear();
    this.rateLimitStore.clear();
  }
}

/**
 * OTP Email Helper
 * Handles OTP email template rendering and context
 */
class OTPEmailHelper {
  /**
   * Generate email context for OTP verification
   */
  static generateEmailContext(userId, otpData, emailTemplate, purpose = 'login') {
    const expiresAt = new Date(otpData.expiresAt);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const contextSections = {
      login: {
        title: '🔐 Verify Your Login',
        context: `<div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Action:</span>
            <span class="detail-value">Sign in</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Device:</span>
            <span class="detail-value">{{DEVICE_INFO}}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Location:</span>
            <span class="detail-value">{{LOCATION}}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">{{REQUEST_TIME}}</span>
          </div>
        </div>`
      },
      transaction: {
        title: '🔐 Verify Transaction',
        context: `<div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Action:</span>
            <span class="detail-value">Authorize Transaction</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount:</span>
            <span class="detail-value">{{TRANSACTION_AMOUNT}}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Recipient:</span>
            <span class="detail-value">{{RECIPIENT_ADDRESS}}</span>
          </div>
        </div>`
      },
      twofa: {
        title: '🔐 Two-Factor Authentication',
        context: `<div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Action:</span>
            <span class="detail-value">2FA Verification</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Device:</span>
            <span class="detail-value">{{DEVICE_INFO}}</span>
          </div>
        </div>`
      },
      email_verification: {
        title: '🔐 Verify Email Address',
        context: `<div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Action:</span>
            <span class="detail-value">Email Verification</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">{{USER_EMAIL}}</span>
          </div>
        </div>`
      },
      password_reset: {
        title: '🔐 Confirm Password Reset',
        context: `<div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Action:</span>
            <span class="detail-value">Password Reset</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">{{REQUEST_TIME}}</span>
          </div>
        </div>`
      }
    };

    const config = contextSections[purpose] || contextSections.login;

    return {
      USER_NAME: '{{USER_NAME}}',
      OTP_CODE: otpData.otp,
      EXPIRATION_MINUTES: otpData.expirationMinutes,
      EXPIRATION_TIME: expiresAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      }),
      TIMEZONE: timezone,
      CONTEXT_SECTION: config.context,
      SECURITY_ALERT_URL: '{{SECURITY_ALERT_URL}}',
      HELP_VERIFICATION_URL: '{{HELP_VERIFICATION_URL}}',
      CONTACT_SUPPORT_URL: '{{CONTACT_SUPPORT_URL}}',
      COMPANY_ADDRESS: '{{COMPANY_ADDRESS}}',
      SECURITY_LINK: '{{SECURITY_LINK}}',
      PRIVACY_LINK: '{{PRIVACY_LINK}}',
      TERMS_LINK: '{{TERMS_LINK}}',
      CONTACT_LINK: '{{CONTACT_LINK}}',
      YEAR: new Date().getFullYear().toString()
    };
  }

  /**
   * Generate backup codes for 2FA
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase();
      codes.push(`${code.slice(0, 3)}-${code.slice(3)}`);
    }
    return codes;
  }

  /**
   * Generate backup codes section HTML
   */
  static generateBackupCodesSection(codes) {
    return `<div class="backup-codes">
      <div class="backup-codes-title">💾 Save Your Backup Codes</div>
      <p style="font-size: 14px; color: #777; margin: 0 0 12px 0;">
        Keep these codes in a safe place. You can use them to access your account if you lose access to your authentication app.
      </p>
      <div class="backup-codes-list">
        ${codes.map(code => `<div>${code}</div>`).join('')}
      </div>
      <p style="font-size: 12px; color: #777; margin: 12px 0 0 0;">
        Each code can only be used once. Print or save them somewhere secure.
      </p>
    </div>`;
  }

  /**
   * Generate action buttons based on purpose
   */
  static generateActionButtons(purpose = 'login') {
    const buttons = {
      login: `<div class="action-buttons">
        <a href="{{VERIFY_URL}}" class="button">Verify & Sign In</a>
      </div>`,
      transaction: `<div class="action-buttons">
        <a href="{{APPROVE_URL}}" class="button">Approve Transaction</a>
        <a href="{{DECLINE_URL}}" class="button button-danger">Decline</a>
      </div>`,
      email_verification: `<div class="action-buttons">
        <a href="{{VERIFY_URL}}" class="button">Verify Email</a>
      </div>`
    };

    return buttons[purpose] || buttons.login;
  }
}

/**
 * TOTP (Time-based One-Time Password) Service
 * For authenticator apps like Google Authenticator, Authy, Microsoft Authenticator
 */
class TOTPService {
  /**
   * Generate a secret key for TOTP
   */
  static generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Generate QR code URL for TOTP setup
   */
  static generateQRCodeURL(secret, userEmail, issuer = 'Verdexis') {
    const encodedSecret = Buffer.from(secret).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/${issuer}:${userEmail}?secret=${encodedSecret}&issuer=${issuer}`;
  }

  /**
   * Verify TOTP code
   */
  static verify(secret, code, window = 1) {
    const crypto = require('crypto');
    const base32 = require('base32.js');
    
    const decodedSecret = base32.decode(secret);
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = -window; i <= window; i++) {
      const counter = Math.floor((now + i * 30) / 30);
      const hmac = crypto.createHmac('sha1', Buffer.from(decodedSecret));
      hmac.update(Buffer.from([0, 0, 0, 0]));
      hmac.update(Buffer.from([counter >> 24 & 0xFF, counter >> 16 & 0xFF, counter >> 8 & 0xFF, counter & 0xFF]));
      
      const digest = hmac.digest();
      const offset = digest[digest.length - 1] & 0x0f;
      const value = (digest[offset] & 0x7f) << 24 | (digest[offset + 1] & 0xff) << 16 | (digest[offset + 2] & 0xff) << 8 | (digest[offset + 3] & 0xff);
      
      if ((value % 1000000).toString().padStart(6, '0') === code) {
        return true;
      }
    }
    
    return false;
  }
}

// Export classes
module.exports = {
  OTPService,
  OTPEmailHelper,
  TOTPService
};
