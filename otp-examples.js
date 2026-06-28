/**
 * OTP Authentication Examples
 * Ready-to-use code snippets for common authentication scenarios
 */

const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OTPService, OTPEmailHelper } = require('./otp-service');

// ============================================
// SETUP & CONFIGURATION
// ============================================

const app = express();
app.use(express.json());

// Initialize OTP Service
const otpService = new OTPService({
  otpLength: 6,
  expirationTime: 10 * 60 * 1000, // 10 minutes
  maxAttempts: 5,
  lockoutDuration: 30 * 60 * 1000
});

// Configure Email Transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ============================================
// SCENARIO 1: PASSWORDLESS LOGIN
// ============================================

/**
 * Send OTP for passwordless login
 * POST /auth/passwordless/request
 */
async function passwordlessLoginRequest(req, res) {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: email.split('@')[0] });
      await user.save();
    }

    // Check if user is locked out
    if (otpService.isLockedOut(user.id)) {
      const lockoutTime = otpService.getLockoutTime(user.id);
      return res.status(429).json({
        error: 'Too many attempts. Try again later.',
        retryAfter: lockoutTime
      });
    }

    // Generate OTP
    const otpData = otpService.createOTP(user.id, 'login', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // Load and prepare email template
    const template = fs.readFileSync('email_otp_verification.html', 'utf8');
    const emailContext = OTPEmailHelper.generateEmailContext(
      user.id,
      otpData,
      template,
      'login'
    );

    let emailHtml = template;
    Object.entries(emailContext).forEach(([key, value]) => {
      emailHtml = emailHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Send email
    await emailTransporter.sendMail({
      from: 'noreply@verdexis.com',
      to: email,
      subject: '🔐 Your Verdexis Login Code',
      html: emailHtml,
      text: `Your verification code is: ${otpData.otp}`
    });

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresIn: otpData.expirationMinutes
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
}

/**
 * Verify OTP and login
 * POST /auth/passwordless/verify
 */
async function passwordlessLoginVerify(req, res) {
  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    try {
      const result = otpService.verifyOTP(user.id, code.toString(), 'login');
      
      // OTP verified successfully
      otpService.consumeOTP(user.id);

      // Create session/JWT
      const token = generateJWT({
        id: user.id,
        email: user.email
      });

      // Log successful authentication
      await AuthLog.create({
        userId: user.id,
        action: 'passwordless_login',
        success: true,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      // Log failed attempt
      await AuthLog.create({
        userId: user.id,
        action: 'passwordless_login',
        success: false,
        error: error.message,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(401).json({
        error: error.message,
        hint: 'Please check your code and try again'
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

// ============================================
// SCENARIO 2: TWO-FACTOR AUTHENTICATION
// ============================================

/**
 * Send OTP for 2FA
 * POST /auth/2fa/send
 */
async function send2FAOTP(req, res) {
  try {
    const userId = req.user.id; // From authentication middleware
    const user = await User.findById(userId);

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }

    // Generate OTP
    const otpData = otpService.createOTP(userId, 'twofa');

    // Send email
    const template = fs.readFileSync('email_otp_verification.html', 'utf8');
    const emailContext = OTPEmailHelper.generateEmailContext(
      userId,
      otpData,
      template,
      'twofa'
    );

    let emailHtml = template;
    Object.entries(emailContext).forEach(([key, value]) => {
      emailHtml = emailHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    await emailTransporter.sendMail({
      from: 'noreply@verdexis.com',
      to: user.email,
      subject: '🔐 Two-Factor Authentication Code',
      html: emailHtml
    });

    res.json({
      success: true,
      message: '2FA code sent to your email',
      expiresIn: otpData.expirationMinutes
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to send 2FA code' });
  }
}

/**
 * Verify 2FA OTP
 * POST /auth/2fa/verify
 */
async function verify2FAOTP(req, res) {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    const result = otpService.verifyOTP(userId, code.toString(), 'twofa');
    otpService.consumeOTP(userId);

    // Mark session as 2FA verified
    req.session.twoFAVerified = true;

    res.json({
      success: true,
      message: '2FA verification successful'
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}

// ============================================
// SCENARIO 3: TRANSACTION AUTHORIZATION
// ============================================

/**
 * Initiate transaction with OTP requirement
 * POST /transactions/initiate
 */
async function initiateTransaction(req, res) {
  try {
    const userId = req.user.id;
    const { amount, recipient, type } = req.body;

    // Validate transaction
    if (!amount || !recipient || !type) {
      return res.status(400).json({ error: 'Missing transaction details' });
    }

    // Create pending transaction
    const transaction = new Transaction({
      userId,
      amount,
      recipient,
      type,
      status: 'pending_verification',
      createdAt: new Date()
    });
    await transaction.save();

    // Generate OTP for this transaction
    const otpData = otpService.createOTP(userId, 'transaction', {
      transactionId: transaction.id,
      amount,
      recipient,
      type
    });

    // Prepare email context
    const template = fs.readFileSync('email_otp_verification.html', 'utf8');
    const emailContext = OTPEmailHelper.generateEmailContext(
      userId,
      otpData,
      template,
      'transaction'
    );

    // Add transaction-specific context
    let emailHtml = template;
    emailHtml = emailHtml.replace('{{TRANSACTION_AMOUNT}}', `${amount} BTC`);
    emailHtml = emailHtml.replace('{{RECIPIENT_ADDRESS}}', recipient.substring(0, 10) + '...');
    
    Object.entries(emailContext).forEach(([key, value]) => {
      emailHtml = emailHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Send email
    const user = await User.findById(userId);
    await emailTransporter.sendMail({
      from: 'noreply@verdexis.com',
      to: user.email,
      subject: `🔐 Confirm Transaction: ${amount} BTC`,
      html: emailHtml
    });

    res.json({
      success: true,
      transactionId: transaction.id,
      message: 'Verification code sent. Complete transaction authorization.',
      expiresIn: otpData.expirationMinutes
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to initiate transaction' });
  }
}

/**
 * Authorize transaction with OTP
 * POST /transactions/:id/authorize
 */
async function authorizeTransaction(req, res) {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;
    const { code } = req.body;

    // Find transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'pending_verification') {
      return res.status(400).json({ 
        error: 'Transaction cannot be authorized in current state' 
      });
    }

    // Verify OTP
    try {
      const result = otpService.verifyOTP(userId, code.toString(), 'transaction');
      otpService.consumeOTP(userId);

      // Update transaction
      transaction.status = 'authorized';
      transaction.authorizedAt = new Date();
      await transaction.save();

      // Process transaction asynchronously
      processTransactionAsync(transaction);

      res.json({
        success: true,
        message: 'Transaction authorized and processing',
        transactionId: transaction.id
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
}

// ============================================
// SCENARIO 4: EMAIL CHANGE VERIFICATION
// ============================================

/**
 * Request email change with verification
 * POST /account/email/change
 */
async function requestEmailChange(req, res) {
  try {
    const userId = req.user.id;
    const { newEmail } = req.body;

    // Validate new email
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Generate OTP
    const otpData = otpService.createOTP(userId, 'email_verification', {
      newEmail,
      action: 'email_change'
    });

    // Store pending email change
    const user = await User.findById(userId);
    user.pendingEmail = newEmail;
    user.emailChangeOTP = otpData.expiresAt;
    await user.save();

    // Send verification email to new address
    const template = fs.readFileSync('email_otp_verification.html', 'utf8');
    const emailContext = OTPEmailHelper.generateEmailContext(
      userId,
      otpData,
      template,
      'email_verification'
    );

    let emailHtml = template;
    emailHtml = emailHtml.replace('{{USER_EMAIL}}', newEmail);
    Object.entries(emailContext).forEach(([key, value]) => {
      emailHtml = emailHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    await emailTransporter.sendMail({
      from: 'noreply@verdexis.com',
      to: newEmail,
      subject: '🔐 Verify Your New Email Address',
      html: emailHtml
    });

    res.json({
      success: true,
      message: 'Verification code sent to new email address',
      expiresIn: otpData.expirationMinutes
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to request email change' });
  }
}

/**
 * Confirm email change
 * POST /account/email/confirm
 */
async function confirmEmailChange(req, res) {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    const user = await User.findById(userId);

    // Verify OTP
    try {
      const result = otpService.verifyOTP(userId, code.toString(), 'email_verification');
      otpService.consumeOTP(userId);

      // Update email
      user.email = user.pendingEmail;
      user.pendingEmail = null;
      user.emailChangeOTP = null;
      await user.save();

      res.json({
        success: true,
        message: 'Email address updated successfully'
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Email confirmation failed' });
  }
}

// ============================================
// SCENARIO 5: PASSWORD RESET
// ============================================

/**
 * Request password reset with OTP
 * POST /auth/password/reset-request
 */
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If email exists, reset code will be sent'
      });
    }

    // Generate OTP
    const otpData = otpService.createOTP(user.id, 'password_reset', {
      action: 'password_reset',
      ip: req.ip
    });

    // Send email
    const template = fs.readFileSync('email_security.html', 'utf8');
    const emailContext = OTPEmailHelper.generateEmailContext(
      user.id,
      otpData,
      template,
      'password_reset'
    );

    let emailHtml = template;
    emailHtml = emailHtml.replace('{{SECURITY_TITLE}}', 'Reset Your Password');
    emailHtml = emailHtml.replace('{{BUTTON_TEXT}}', 'Reset Password');
    Object.entries(emailContext).forEach(([key, value]) => {
      emailHtml = emailHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    await emailTransporter.sendMail({
      from: 'noreply@verdexis.com',
      to: email,
      subject: '🔐 Reset Your Verdexis Password',
      html: emailHtml
    });

    res.json({
      success: true,
      message: 'Password reset code sent to email'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to send reset code' });
  }
}

/**
 * Verify OTP and reset password
 * POST /auth/password/reset-confirm
 */
async function confirmPasswordReset(req, res) {
  try {
    const { email, code, newPassword } = req.body;

    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    try {
      const result = otpService.verifyOTP(user.id, code.toString(), 'password_reset');
      otpService.consumeOTP(user.id);

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateJWT(payload) {
  // Implementation specific - use your JWT library
  return 'jwt_token_here';
}

function hashPassword(password) {
  // Implementation specific - use bcrypt or similar
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function processTransactionAsync(transaction) {
  // Process transaction in background
  try {
    // Execute transaction logic
    transaction.status = 'completed';
    await transaction.save();
  } catch (error) {
    console.error('Transaction processing failed:', error);
    transaction.status = 'failed';
    transaction.error = error.message;
    await transaction.save();
  }
}

// ============================================
// ROUTE REGISTRATION
// ============================================

// Passwordless Login
app.post('/auth/passwordless/request', passwordlessLoginRequest);
app.post('/auth/passwordless/verify', passwordlessLoginVerify);

// Two-Factor Authentication
app.post('/auth/2fa/send', send2FAOTP);
app.post('/auth/2fa/verify', verify2FAOTP);

// Transactions
app.post('/transactions/initiate', initiateTransaction);
app.post('/transactions/:id/authorize', authorizeTransaction);

// Email Management
app.post('/account/email/change', requestEmailChange);
app.post('/account/email/confirm', confirmEmailChange);

// Password Reset
app.post('/auth/password/reset-request', requestPasswordReset);
app.post('/auth/password/reset-confirm', confirmPasswordReset);

// ============================================
// ERROR HANDLING & MIDDLEWARE
// ============================================

// Rate limit middleware
app.use((req, res, next) => {
  // Implement rate limiting here
  next();
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Export for use in other modules
module.exports = {
  passwordlessLoginRequest,
  passwordlessLoginVerify,
  send2FAOTP,
  verify2FAOTP,
  initiateTransaction,
  authorizeTransaction,
  requestEmailChange,
  confirmEmailChange,
  requestPasswordReset,
  confirmPasswordReset
};

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OTP Authentication server running on port ${PORT}`);
});
