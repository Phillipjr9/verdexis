require('dotenv').config();
const express = require('express');
const session = require('express-session');
const NewUserOTPAuth = require('./new-user-otp');
const PasswordResetService = require('./password-reset-service');
const EmailNotificationService = require('./email-notifications');
const TwoFactorAuthService = require('./two-factor-auth');
const AuditLoggingService = require('./audit-logging');
const AdminPanelService = require('./admin-panel');
const { loginLimiter, registerLimiter, otpLimiter, passwordResetLimiter, bruteForceMiddleware, BruteForceProtection } = require('./rate-limiting');

const app = express();
const authService = new NewUserOTPAuth();
const passwordService = new PasswordResetService();
const emailService = new EmailNotificationService();
const twoFAService = new TwoFactorAuthService();
const auditService = new AuditLoggingService();
const adminService = new AdminPanelService();
const bruteForce = new BruteForceProtection();

app.use(express.json());
app.use(session({
  secret: 'verdexis-complete-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middleware
app.use(bruteForceMiddleware(bruteForce));

console.log(`
🚀 Verdexis Complete Authentication System
✅ OTP Verification
✅ Password Reset
✅ Email Notifications
✅ 2FA/TOTP
✅ Audit Logging
✅ Admin Panel
✅ Rate Limiting
`);

// Auth Routes
app.post('/api/check-user', async (req, res) => {
  const { email } = req.body;
  const userCheck = await authService.checkUserExists(email);
  res.json({ success: true, exists: userCheck.exists });
});

app.post('/api/register', registerLimiter, async (req, res) => {
  const { email, phoneNumber, password, name } = req.body;
  const result = await authService.registerNewUser(email, phoneNumber, password, name);
  
  if (result.success) {
    await auditService.logAuthEvent(email, 'registration', { method: 'otp' }, req.ip);
  }
  
  res.json(result);
});

app.post('/api/verify-registration', otpLimiter, async (req, res) => {
  const { phoneNumber, otp } = req.body;
  const result = await authService.verifyAndCompleteRegistration(phoneNumber, otp);
  
  if (result.success) {
    const userCheck = await authService.checkUserExists(phoneNumber);
    await emailService.sendWelcomeEmail(phoneNumber, 'New User');
    await auditService.logAuthEvent(phoneNumber, 'registration', { status: 'verified' }, req.ip);
  }
  
  res.json(result);
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  
  if (result.success) {
    req.session.authenticated = true;
    req.session.userEmail = email;
    req.session.requiresTwoFA = false;
    
    await auditService.logAuthEvent(email, 'login', {}, req.ip);
    bruteForce.reset(req.ip);
  } else {
    bruteForce.recordAttempt(req.ip, 'login');
    await auditService.logAuthEvent(email, 'failedLogin', { reason: result.error }, req.ip);
  }
  
  res.json(result);
});

app.post('/api/logout', (req, res) => {
  const email = req.session.userEmail;
  auditService.logAuthEvent(email, 'logout', {}, req.ip);
  
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

// Password Reset Routes
app.post('/api/forgot-password', passwordResetLimiter, async (req, res) => {
  const { email } = req.body;
  const result = await passwordService.requestPasswordReset(email);
  res.json(result);
});

app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await passwordService.resetPassword(token, newPassword);
  
  if (result.success) {
    await auditService.logAuthEvent(token, 'passwordReset', { method: 'token' }, req.ip);
  }
  
  res.json(result);
});

app.post('/api/change-password', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const { oldPassword, newPassword } = req.body;
  const result = await passwordService.changePassword(req.session.userEmail, oldPassword, newPassword);
  
  if (result.success) {
    await auditService.logAuthEvent(req.session.userEmail, 'passwordChange', {}, req.ip);
    await emailService.sendSecurityAlert(req.session.userEmail, 'passwordChange', 'Your password was changed');
  }
  
  res.json(result);
});

// 2FA Routes
app.post('/api/enable-2fa', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const { method = 'totp' } = req.body;
  const result = await twoFAService.enableTwoFactorAuth(req.session.userEmail, method);
  res.json(result);
});

app.post('/api/confirm-2fa', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const { token } = req.body;
  const result = await twoFAService.confirmTwoFactorSetup(req.session.userEmail, token);
  
  if (result.success) {
    await auditService.logAuthEvent(req.session.userEmail, '2faEnabled', {}, req.ip);
  }
  
  res.json(result);
});

app.post('/api/verify-2fa', async (req, res) => {
  const { email, token } = req.body;
  const result = twoFAService.verifyTwoFactor(email, token);
  res.json(result);
});

app.post('/api/disable-2fa', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const result = twoFAService.disableTwoFactorAuth(req.session.userEmail);
  
  if (result.success) {
    await auditService.logAuthEvent(req.session.userEmail, '2faDisabled', {}, req.ip);
  }
  
  res.json(result);
});

// Admin Routes
app.get('/api/admin/users', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const result = await adminService.getAllUsers();
  res.json(result);
});

app.get('/api/admin/user/:email', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const result = await adminService.getUserDetails(req.params.email);
  res.json(result);
});

app.post('/api/admin/suspend-user', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const { email, reason } = req.body;
  const result = await adminService.suspendUser(email, reason);
  
  if (result.success) {
    await auditService.logAdminAction(req.session.userEmail, email, 'suspend', { reason }, req.ip);
  }
  
  res.json(result);
});

app.post('/api/admin/reactivate-user', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const { email } = req.body;
  const result = await adminService.reactivateUser(email);
  
  if (result.success) {
    await auditService.logAdminAction(req.session.userEmail, email, 'reactivate', {}, req.ip);
  }
  
  res.json(result);
});

app.get('/api/admin/statistics', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const result = await adminService.getUserStatistics();
  res.json(result);
});

// Audit Routes
app.get('/api/audit/logs', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const logs = auditService.getAuditLogs(req.session.userEmail, 50);
  res.json({ success: true, logs });
});

app.get('/api/audit/suspicious', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const suspicious = auditService.getSuspiciousActivities(req.session.userEmail);
  res.json({ success: true, suspicious });
});

// Profile Routes
app.get('/api/profile', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  res.json({
    success: true,
    user: {
      email: req.session.userEmail,
      authenticated: true
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Verdexis Complete Authentication System',
    features: [
      'OTP Verification',
      'Password Reset',
      'Email Notifications',
      '2FA/TOTP',
      'Audit Logging',
      'Admin Panel',
      'Rate Limiting',
      'Brute Force Protection'
    ],
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`\n🌐 Complete API running on: http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;