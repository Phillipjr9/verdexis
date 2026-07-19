// VERDEXIS SECURITY FEATURES - PRACTICAL INTEGRATION EXAMPLES
// Real-world usage patterns and complete workflows

const ComprehensiveSecurityService = require('./security-service-complete');
const AdminPanelService = require('./admin-panel');
const EmailNotificationService = require('./email-notifications-complete');

/**
 * ============================================================================
 * EXAMPLE 1: COMPLETE USER REGISTRATION WITH EMAIL VERIFICATION
 * ============================================================================
 */

async function completeUserRegistrationFlow(req, res) {
  const { email, password, name } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Validate password meets security requirements
    const passwordValidation = security.validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        requirements: passwordValidation.issues
      });
    }

    // Step 2: Create user in Cognito (integration code here)
    const userCreated = await cognitoCreateUser(email, password, name);
    if (!userCreated.success) {
      return res.status(400).json({ success: false, error: userCreated.error });
    }

    // Step 3: Send welcome email
    const emailResult = await security.sendWelcomeEmail(email, name);
    if (!emailResult.success) {
      console.warn('Welcome email failed but user created:', emailResult.error);
    }

    // Step 4: Log registration event
    await security.auditLogging.logAction(email, 'User Registration', {
      name,
      source: 'web',
      ipAddress
    }, ipAddress, 'success');

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Welcome email sent.',
      user: { email, name }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 2: FORGOT PASSWORD FLOW WITH VERIFICATION
 * ============================================================================
 */

async function forgotPasswordFlow(req, res) {
  const { email } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Rate limit check (5 requests per hour)
    const recentAttempts = security.getFailedLoginAttempts(email, 1);
    if (recentAttempts.length > 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many password reset attempts. Try again in 1 hour.'
      });
    }

    // Initiate password reset
    const resetResult = await security.initiateForgotPassword(email, ipAddress);

    // Response doesn't reveal if user exists (security best practice)
    return res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function resetPasswordWithToken(req, res) {
  const { token, newPassword } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Validate password
    const passwordValidation = security.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password',
        requirements: passwordValidation.issues
      });
    }

    // Step 2: Validate token
    const tokenData = security.passwordReset.validateResetToken(token);
    if (!tokenData.valid) {
      return res.status(400).json({ success: false, error: tokenData.error });
    }

    // Step 3: Reset password
    const resetResult = await security.completeForgotPassword(token, newPassword, ipAddress);

    if (!resetResult.success) {
      return res.status(400).json(resetResult);
    }

    // Step 4: Send confirmation email
    // Already sent by security service

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now login.'
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 3: LOGIN WITH OPTIONAL 2FA
 * ============================================================================
 */

async function enhancedLoginFlow(req, res) {
  const { email, password } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Check if IP is blocked
    if (security.bruteForce.isBlocked(ipAddress)) {
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. IP blocked for 30 minutes.',
        code: 'IP_BLOCKED'
      });
    }

    // Step 2: Authenticate user
    const loginResult = await security.handleLogin(email, password, ipAddress);

    if (!loginResult.success) {
      return res.status(401).json(loginResult);
    }

    // Step 3: Check if 2FA is required
    if (loginResult.requiresTwoFactor) {
      return res.json({
        success: true,
        requiresTwoFactor: true,
        sessionToken: loginResult.sessionToken,
        message: 'Enter your 2FA code to complete login'
      });
    }

    // Step 4: Send login alert email (optional)
    const alertResult = await security.sendAlert(email, {
      alertType: 'Login Successful',
      title: 'New Login',
      message: `New login from ${ipAddress} at ${new Date().toLocaleString()}`,
      severity: 'info'
    });

    // Step 5: Return session
    return res.json({
      success: true,
      user: loginResult.user,
      accessToken: loginResult.accessToken
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function verify2FAAndCompleteLogin(req, res) {
  const { email, token, sessionToken } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Verify 2FA code (rate limited to 3 attempts)
    const twoFAResult = await security.handleTwoFactorAuth(email, token, sessionToken, ipAddress);

    if (!twoFAResult.success) {
      return res.status(401).json(twoFAResult);
    }

    // Step 2: Generate session
    const sessionToken = generateSessionToken(email);

    // Step 3: Log successful login
    await security.auditLogging.logAuthEvent(email, 'login', {
      method: 'password + 2FA',
      ipAddress
    }, ipAddress);

    return res.json({
      success: true,
      message: '2FA verified successfully',
      accessToken: sessionToken
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 4: ENABLE & CONFIRM 2FA
 * ============================================================================
 */

async function enableTwoFactorAuthFlow(req, res) {
  const { email } = req.body;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Generate TOTP secret
    const enableResult = await security.enableTwoFactorAuth(email, 'totp');

    if (!enableResult.success) {
      return res.status(400).json(enableResult);
    }

    // Step 2: Return QR code and backup codes
    return res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app',
      secret: enableResult.secret,
      qrCode: enableResult.qrCode,
      backupCodes: enableResult.backupCodes,
      instructions: 'Enter a code from your authenticator app to confirm setup'
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function confirmTwoFactorAuthSetup(req, res) {
  const { email, token } = req.body;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Verify the token
    const confirmResult = await security.confirmTwoFactorSetup(email, token);

    if (!confirmResult.success) {
      return res.status(400).json(confirmResult);
    }

    // Step 2: Return backup codes for saving
    return res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes: confirmResult.backupCodes,
      warning: 'Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator app.'
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 5: ADMIN - SUSPEND SUSPICIOUS USER
 * ============================================================================
 */

async function adminSuspendUserFlow(req, res) {
  const { email, reason } = req.body;
  const adminId = req.user.id; // From JWT
  const ipAddress = req.ip;

  try {
    const admin = new AdminPanelService();
    const security = new ComprehensiveSecurityService();

    // Step 1: Get user details for verification
    const userResult = await admin.getUserDetails(email);
    if (!userResult.success) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Step 2: Suspend user
    const suspendResult = await admin.suspendUser(email, reason);

    if (!suspendResult.success) {
      return res.status(400).json(suspendResult);
    }

    // Step 3: Send notification email to user
    await security.sendAlert(email, {
      alertType: 'Account Suspended',
      title: 'Your Account Has Been Suspended',
      message: `Your account has been suspended due to: ${reason}. Please contact support.`,
      severity: 'critical',
      action: {
        text: 'Contact Support',
        url: `${process.env.APP_URL}/support`
      }
    });

    // Step 4: Log admin action
    await security.auditLogging.logAdminAction(adminId, email, 'Suspend', {
      reason,
      timestamp: Date.now()
    }, ipAddress);

    return res.json({
      success: true,
      message: `User ${email} suspended successfully`,
      user: userResult.user
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 6: TRANSACTION WITH NOTIFICATION & AUDIT
 * ============================================================================
 */

async function processDepositWithNotifications(req, res) {
  const { email, amount, currency, reference } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Process deposit (your business logic here)
    const depositResult = await processDeposit(email, amount, currency, reference);

    if (!depositResult.success) {
      return res.status(400).json(depositResult);
    }

    // Step 2: Log transaction event
    await security.auditLogging.logTransactionEvent(email, {
      type: 'deposit',
      amount,
      currency,
      status: 'completed'
    }, ipAddress);

    // Step 3: Send confirmation email
    const emailResult = await security.sendTransactionConfirmation(email, {
      type: 'deposit',
      amount,
      currency,
      date: Date.now(),
      reference,
      status: 'completed'
    });

    // Step 4: Send alert if large amount
    if (amount > 10000) {
      await security.sendAlert(email, {
        alertType: 'Large Deposit',
        title: `Large Deposit Received - $${amount}`,
        message: `A large deposit of $${amount} ${currency} has been received and is being processed.`,
        severity: 'info'
      });
    }

    return res.json({
      success: true,
      message: 'Deposit processed successfully',
      transaction: depositResult.transaction
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 7: SECURITY REPORT FOR USER
 * ============================================================================
 */

async function getUserSecurityReport(req, res) {
  const { userId } = req.params;

  try {
    const security = new ComprehensiveSecurityService();

    // Generate comprehensive security report
    const report = security.generateSecurityReport(userId);

    return res.json({
      success: true,
      report: {
        userId: report.userId,
        generatedAt: report.generatedAt,
        summary: report.summary,
        recentAlerts: report.alerts.slice(-10),
        recommendations: report.recommendations,
        exportUrl: `/api/security/export-logs/${userId}?format=csv`
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 8: ADMIN DASHBOARD
 * ============================================================================
 */

async function getAdminDashboard(req, res) {
  try {
    const admin = new AdminPanelService();

    // Step 1: Get dashboard data
    const dashboardResult = await admin.getAdminDashboard();

    if (!dashboardResult.success) {
      return res.status(400).json(dashboardResult);
    }

    // Step 2: Get statistics
    const statsResult = await admin.getUserStatistics();

    // Step 3: Combine data
    const dashboard = {
      ...dashboardResult.dashboard,
      stats: statsResult.stats
    };

    return res.json({
      success: true,
      dashboard
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 9: KYC VERIFICATION FLOW
 * ============================================================================
 */

async function approveUserKYC(req, res) {
  const { email } = req.params;
  const { level } = req.body;
  const adminId = req.user.id;
  const ipAddress = req.ip;

  try {
    const admin = new AdminPanelService();
    const security = new ComprehensiveSecurityService();

    // Step 1: Verify KYC
    const kycResult = await admin.verifyUserKYC(email, { level });

    if (!kycResult.success) {
      return res.status(400).json(kycResult);
    }

    // Step 2: Send notification to user
    const emailResult = await security.sendKYCStatusUpdate(email, {
      status: 'approved',
      reason: `Your KYC has been approved at level ${level}`,
      nextSteps: 'You can now access all features of the platform'
    });

    // Step 3: Log admin action
    await security.auditLogging.logAdminAction(adminId, email, 'KYC Approved', {
      level,
      timestamp: Date.now()
    }, ipAddress);

    return res.json({
      success: true,
      message: `KYC approved for ${email}`
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function rejectUserKYC(req, res) {
  const { email } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;
  const ipAddress = req.ip;

  try {
    const admin = new AdminPanelService();
    const security = new ComprehensiveSecurityService();

    // Step 1: Reject KYC
    const kycResult = await admin.rejectUserKYC(email, reason);

    if (!kycResult.success) {
      return res.status(400).json(kycResult);
    }

    // Step 2: Send notification to user
    const emailResult = await security.sendKYCStatusUpdate(email, {
      status: 'rejected',
      reason: reason,
      nextSteps: 'Please resubmit your KYC with the correct documents or contact support'
    });

    // Step 3: Log admin action
    await security.auditLogging.logAdminAction(adminId, email, 'KYC Rejected', {
      reason,
      timestamp: Date.now()
    }, ipAddress);

    return res.json({
      success: true,
      message: `KYC rejected for ${email}`
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * EXAMPLE 10: SECURITY EVENT LOGGING
 * ============================================================================
 */

async function detectAndLogSuspiciousActivity(req, res) {
  const { userId, activityType } = req.body;
  const ipAddress = req.ip;

  try {
    const security = new ComprehensiveSecurityService();

    // Step 1: Detect suspicious pattern
    const suspiciousResult = await security.detectSuspiciousActivity(
      userId,
      activityType,
      ipAddress
    );

    if (suspiciousResult.suspicious) {
      // Step 2: Send security alert
      const alertResult = await security.sendSecurityAlertEmail(userId, {
        eventType: activityType,
        timestamp: Date.now(),
        location: 'Detected by system',
        device: 'Unknown',
        action: 'verify'
      });

      return res.json({
        success: true,
        suspicious: true,
        message: 'Suspicious activity detected and user notified'
      });
    }

    return res.json({
      success: true,
      suspicious: false
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

function generateSessionToken(email) {
  // Implement JWT token generation
  const jwt = require('jsonwebtoken');
  return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '30m' });
}

async function cognitoCreateUser(email, password, name) {
  // Implement Cognito user creation
  // This would use AWS SDK
  return { success: true, user: { email, name } };
}

async function processDeposit(email, amount, currency, reference) {
  // Implement deposit processing logic
  return {
    success: true,
    transaction: {
      id: reference,
      email,
      amount,
      currency,
      status: 'completed',
      timestamp: Date.now()
    }
  };
}

module.exports = {
  completeUserRegistrationFlow,
  forgotPasswordFlow,
  resetPasswordWithToken,
  enhancedLoginFlow,
  verify2FAAndCompleteLogin,
  enableTwoFactorAuthFlow,
  confirmTwoFactorAuthSetup,
  adminSuspendUserFlow,
  processDepositWithNotifications,
  getUserSecurityReport,
  getAdminDashboard,
  approveUserKYC,
  rejectUserKYC,
  detectAndLogSuspiciousActivity
};
