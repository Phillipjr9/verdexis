const PasswordResetService = require('./password-reset-complete');
const TwoFactorAuthService = require('./two-factor-auth');
const EmailNotificationService = require('./email-notifications-complete');
const AuditLoggingService = require('./audit-logging');
const { BruteForceProtection } = require('./rate-limiting-complete');

class ComprehensiveSecurityService {
  constructor() {
    this.passwordReset = new PasswordResetService();
    this.twoFactorAuth = new TwoFactorAuthService();
    this.emailNotifications = new EmailNotificationService();
    this.auditLogging = new AuditLoggingService();
    this.bruteForce = new BruteForceProtection();
    this.securityConfig = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxLoginAttempts: 5,
      passwordMinLength: 12,
      requireSpecialChars: true,
      require2FA: false
    };
  }

  // ===== AUTHENTICATION FLOW =====

  async handleLogin(email, password, ipAddress) {
    // Check if IP is blocked
    if (this.bruteForce.isBlocked(ipAddress)) {
      await this.auditLogging.logAuthEvent(email, 'failedLogin', {
        reason: 'IP blocked due to brute force',
        ipAddress
      }, ipAddress);

      return {
        success: false,
        error: 'Too many login attempts. Please try again later.',
        code: 'BLOCKED'
      };
    }

    try {
      // Authenticate user
      // This would integrate with Cognito
      const authResult = await this.authenticateUser(email, password);

      if (!authResult.success) {
        this.bruteForce.recordAttempt(ipAddress, 'login');
        await this.auditLogging.logAuthEvent(email, 'failedLogin', {
          reason: authResult.error
        }, ipAddress);

        return { success: false, error: authResult.error };
      }

      // Check if 2FA is required
      if (this.securityConfig.require2FA || authResult.user2FAEnabled) {
        return {
          success: true,
          requiresTwoFactor: true,
          sessionToken: authResult.sessionToken
        };
      }

      // Reset brute force counter on successful login
      this.bruteForce.reset(ipAddress, 'login');

      // Log successful login
      await this.auditLogging.logAuthEvent(email, 'login', {
        method: 'password',
        ipAddress
      }, ipAddress);

      return {
        success: true,
        user: authResult.user,
        accessToken: authResult.accessToken
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleTwoFactorAuth(email, token, sessionToken, ipAddress) {
    try {
      const verification = this.twoFactorAuth.verifyTwoFactor(email, token);

      if (!verification.valid) {
        await this.auditLogging.logAuthEvent(email, 'failedLogin', {
          reason: '2FA verification failed'
        }, ipAddress);

        return { success: false, error: verification.error };
      }

      // Log successful 2FA
      await this.auditLogging.logAuthEvent(email, 'login', {
        method: 'password + 2FA',
        ipAddress
      }, ipAddress);

      return {
        success: true,
        message: '2FA verified successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== PASSWORD MANAGEMENT =====

  async initiateForgotPassword(email, ipAddress) {
    try {
      const result = await this.passwordReset.initiatePasswordReset(email);

      await this.auditLogging.logAuthEvent(email, 'passwordReset', {
        step: 'initiated',
        ipAddress
      }, ipAddress);

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async completeForgotPassword(token, newPassword, ipAddress) {
    try {
      const result = await this.passwordReset.resetPasswordWithToken(token, newPassword);

      if (result.success) {
        const tokenData = this.passwordReset.validateResetToken(token);
        if (tokenData.valid) {
          await this.auditLogging.logAuthEvent(tokenData.email, 'passwordReset', {
            step: 'completed',
            ipAddress
          }, ipAddress);
        }
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async changePassword(email, currentPassword, newPassword, ipAddress) {
    try {
      const result = await this.passwordReset.changePassword(email, currentPassword, newPassword);

      if (result.success) {
        await this.auditLogging.logAuthEvent(email, 'passwordChange', {
          ipAddress
        }, ipAddress);
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== TWO-FACTOR AUTHENTICATION =====

  async enableTwoFactorAuth(email, method = 'totp') {
    try {
      const result = await this.twoFactorAuth.enableTwoFactorAuth(email, method);

      if (result.success) {
        await this.auditLogging.logAuthEvent(email, '2faEnabled', {
          method
        }, 'system');
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async confirmTwoFactorSetup(email, token) {
    try {
      const result = this.twoFactorAuth.confirmTwoFactorSetup(email, token);

      if (result.success) {
        await this.auditLogging.logAuthEvent(email, '2faEnabled', {
          confirmed: true
        }, 'system');
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async disableTwoFactorAuth(email) {
    try {
      const result = this.twoFactorAuth.disableTwoFactorAuth(email);

      await this.auditLogging.logAuthEvent(email, '2faDisabled', {
        timestamp: Date.now()
      }, 'system');

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== SECURITY EVENTS =====

  async logSecurityEvent(userId, eventType, details, ipAddress, severity = 'info') {
    try {
      await this.auditLogging.logSecurityEvent(userId, eventType, details, ipAddress, severity);

      // Send alert email for critical events
      if (severity === 'critical') {
        await this.emailNotifications.sendSecurityAlertEmail(userId, {
          eventType,
          timestamp: Date.now(),
          location: details.location,
          device: details.device,
          action: details.action || 'verify'
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async detectSuspiciousActivity(userId, activityPattern, ipAddress) {
    const suspiciousPatterns = [
      { pattern: 'rapid_login_failures', threshold: 5 },
      { pattern: 'unusual_location', threshold: 1 },
      { pattern: 'multiple_ips_same_time', threshold: 3 },
      { pattern: 'large_withdrawal', threshold: 1 }
    ];

    const matchedPattern = suspiciousPatterns.find(p => p.pattern === activityPattern);

    if (matchedPattern) {
      await this.logSecurityEvent(userId, `Suspicious - ${activityPattern}`, {
        pattern: activityPattern
      }, ipAddress, 'warning');

      return { suspicious: true, pattern: activityPattern };
    }

    return { suspicious: false };
  }

  // ===== EMAIL NOTIFICATIONS =====

  async sendWelcomeEmail(email, name) {
    return this.emailNotifications.sendWelcomeEmail(email, name);
  }

  async sendTransactionConfirmation(email, transactionData) {
    return this.emailNotifications.sendTransactionConfirmationEmail(email, transactionData);
  }

  async sendAlert(email, alertData) {
    return this.emailNotifications.sendAlertEmail(email, alertData);
  }

  async sendKYCStatusUpdate(email, kycData) {
    return this.emailNotifications.sendKYCStatusEmail(email, kycData);
  }

  // ===== AUDIT & LOGGING =====

  getAuditLogs(userId, limit = 100) {
    return this.auditLogging.getAuditLogs(userId, limit);
  }

  getFailedLoginAttempts(userId, hours = 24) {
    return this.auditLogging.getFailedLoginAttempts(userId, hours);
  }

  getSuspiciousActivities(userId) {
    return this.auditLogging.getSuspiciousActivities(userId);
  }

  exportAuditLogs(userId, format = 'json') {
    return this.auditLogging.exportAuditLogs(userId, format);
  }

  // ===== CONFIGURATION =====

  updateSecurityConfig(config) {
    this.securityConfig = { ...this.securityConfig, ...config };
    return { success: true, config: this.securityConfig };
  }

  getSecurityConfig() {
    return this.securityConfig;
  }

  validatePassword(password) {
    const issues = [];

    if (password.length < this.securityConfig.passwordMinLength) {
      issues.push(`Password must be at least ${this.securityConfig.passwordMinLength} characters`);
    }

    if (this.securityConfig.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
      issues.push('Password must contain special characters (!@#$%^&*)');
    }

    if (!/[A-Z]/.test(password)) {
      issues.push('Password must contain uppercase letters');
    }

    if (!/[0-9]/.test(password)) {
      issues.push('Password must contain numbers');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // ===== HELPER METHODS =====

  async authenticateUser(email, password) {
    // This would integrate with actual authentication system
    // For now, return mock response
    return {
      success: true,
      user: { email, id: '123' },
      accessToken: 'token_' + Date.now(),
      sessionToken: 'session_' + Date.now(),
      user2FAEnabled: false
    };
  }

  // Generate security report
  generateSecurityReport(userId) {
    const failedLogins = this.getFailedLoginAttempts(userId, 30);
    const suspiciousActivities = this.getSuspiciousActivities(userId);
    const auditLogs = this.getAuditLogs(userId, 100);

    return {
      userId,
      generatedAt: new Date().toISOString(),
      summary: {
        failedLoginAttempts: failedLogins.length,
        suspiciousActivities: suspiciousActivities.length,
        totalEvents: auditLogs.length
      },
      alerts: [
        ...failedLogins.slice(-5),
        ...suspiciousActivities.slice(-5)
      ],
      recommendations: this.generateSecurityRecommendations(failedLogins, suspiciousActivities)
    };
  }

  generateSecurityRecommendations(failedLogins, suspiciousActivities) {
    const recommendations = [];

    if (failedLogins.length > 10) {
      recommendations.push('Multiple failed login attempts detected. Consider changing your password.');
    }

    if (suspiciousActivities.length > 0) {
      recommendations.push('Suspicious activities detected on your account. Review recent activity.');
    }

    if (!this.twoFactorAuth.getTwoFactorStatus) {
      recommendations.push('Enable two-factor authentication for enhanced security.');
    }

    return recommendations;
  }

  // Cleanup expired data
  cleanup() {
    const cleanupResults = {
      resetTokens: this.passwordReset.cleanupExpiredTokens(),
      bruteForce: this.bruteForce.cleanup()
    };

    return cleanupResults;
  }
}

module.exports = ComprehensiveSecurityService;
