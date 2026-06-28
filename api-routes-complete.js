const express = require('express');
const router = express.Router();
const ComprehensiveSecurityService = require('./security-service-complete');
const AdminPanelService = require('./admin-panel');
const { 
  loginLimiter, 
  passwordResetLimiter, 
  registerLimiter,
  otpLimiter,
  BruteForceProtection 
} = require('./rate-limiting-complete');

const security = new ComprehensiveSecurityService();
const adminPanel = new AdminPanelService();
const bruteForce = new BruteForceProtection();

// Helper middleware
const getClientIP = (req) => req.ip || req.connection.remoteAddress;

// ===== AUTHENTICATION ROUTES =====

// Login
router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIP(req);

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing credentials' });
    }

    const result = await security.handleLogin(email, password, ipAddress);
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register
router.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const ipAddress = getClientIP(req);

    // Validate password
    const passwordValidation = security.validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password',
        issues: passwordValidation.issues
      });
    }

    // Register user (would integrate with Cognito)
    const registerResult = {
      success: true,
      user: { email, name }
    };

    // Send welcome email
    await security.sendWelcomeEmail(email, name);

    res.status(201).json(registerResult);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify 2FA
router.post('/auth/verify-2fa', otpLimiter, async (req, res) => {
  try {
    const { email, token, sessionToken } = req.body;
    const ipAddress = getClientIP(req);

    if (!email || !token) {
      return res.status(400).json({ success: false, error: 'Missing credentials' });
    }

    const result = await security.handleTwoFactorAuth(email, token, sessionToken, ipAddress);
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== PASSWORD RESET ROUTES =====

// Initiate password reset
router.post('/password/forgot', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = getClientIP(req);

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    const result = await security.initiateForgotPassword(email, ipAddress);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset password with token
router.post('/password/reset', passwordResetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const ipAddress = getClientIP(req);

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const passwordValidation = security.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password',
        issues: passwordValidation.issues
      });
    }

    const result = await security.completeForgotPassword(token, newPassword, ipAddress);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password (authenticated)
router.post('/password/change', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const ipAddress = getClientIP(req);

    // Verify user is authenticated (would check JWT)

    const result = await security.changePassword(email, currentPassword, newPassword, ipAddress);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== TWO-FACTOR AUTH ROUTES =====

// Enable 2FA
router.post('/security/2fa/enable', async (req, res) => {
  try {
    const { email, method = 'totp' } = req.body;

    const result = await security.enableTwoFactorAuth(email, method);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm 2FA setup
router.post('/security/2fa/confirm', async (req, res) => {
  try {
    const { email, token } = req.body;

    const result = await security.confirmTwoFactorSetup(email, token);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disable 2FA
router.post('/security/2fa/disable', async (req, res) => {
  try {
    const { email } = req.body;

    const result = await security.disableTwoFactorAuth(email);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== SECURITY & AUDIT ROUTES =====

// Get security report
router.get('/security/report/:userId', async (req, res) => {
  try {
    const report = security.generateSecurityReport(req.params.userId);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get audit logs
router.get('/security/audit-logs/:userId', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = security.getAuditLogs(req.params.userId, limit);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get failed login attempts
router.get('/security/failed-logins/:userId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const attempts = security.getFailedLoginAttempts(req.params.userId, hours);
    res.json({ success: true, attempts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export audit logs
router.get('/security/export-logs/:userId', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const logs = security.exportAuditLogs(req.params.userId, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    }
    
    res.send(logs);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ADMIN ROUTES =====

// Get all users
router.get('/admin/users', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 60, 100);
    const token = req.query.nextToken || null;

    const result = await adminPanel.getAllUsers(limit, token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user details
router.get('/admin/users/:email', async (req, res) => {
  try {
    const result = await adminPanel.getUserDetails(req.params.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get users by status
router.get('/admin/users-by-status/:status', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 60, 100);
    const result = await adminPanel.getUsersByStatus(req.params.status, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Suspend user
router.post('/admin/users/:email/suspend', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await adminPanel.suspendUser(req.params.email, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reactivate user
router.post('/admin/users/:email/reactivate', async (req, res) => {
  try {
    const result = await adminPanel.reactivateUser(req.params.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lock user account
router.post('/admin/users/:email/lock', async (req, res) => {
  try {
    const { reason, duration } = req.body;
    const result = await adminPanel.lockUserAccount(req.params.email, reason, duration);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unlock user account
router.post('/admin/users/:email/unlock', async (req, res) => {
  try {
    const result = await adminPanel.unlockUserAccount(req.params.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
router.delete('/admin/users/:email', async (req, res) => {
  try {
    const result = await adminPanel.deleteUser(req.params.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset user password
router.post('/admin/users/:email/reset-password', async (req, res) => {
  try {
    const result = await adminPanel.resetUserPassword(req.params.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user tier
router.post('/admin/users/:email/tier', async (req, res) => {
  try {
    const { tier } = req.body;
    const result = await adminPanel.updateUserTier(req.params.email, tier);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify user KYC
router.post('/admin/users/:email/kyc/verify', async (req, res) => {
  try {
    const { level } = req.body;
    const result = await adminPanel.verifyUserKYC(req.params.email, { level });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject user KYC
router.post('/admin/users/:email/kyc/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await adminPanel.rejectUserKYC(req.params.email, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user statistics
router.get('/admin/statistics', async (req, res) => {
  try {
    const result = await adminPanel.getUserStatistics();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get admin dashboard
router.get('/admin/dashboard', async (req, res) => {
  try {
    const result = await adminPanel.getAdminDashboard();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create bulk report
router.post('/admin/reports', async (req, res) => {
  try {
    const { type, filters } = req.body;
    const result = await adminPanel.createBulkReport(type, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search users
router.get('/admin/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search term required' });
    }

    const result = await adminPanel.searchUsers(q);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
