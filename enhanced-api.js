require('dotenv').config();
const express = require('express');
const session = require('express-session');
const EnhancedOTPService = require('./enhanced-otp');

const app = express();
const otpService = new EnhancedOTPService();

app.use(express.json());
app.use(session({
  secret: 'verdexis-otp-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Register user with OTP choice
app.post('/api/register', async (req, res) => {
  const { email, phoneNumber, password, name, otpMethod = 'email' } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'Email, password, and name are required'
    });
  }

  const result = await otpService.registerUserWithOTP(
    email, phoneNumber, password, name, otpMethod
  );
  
  res.json(result);
});

// Verify registration OTP
app.post('/api/verify-registration', async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Email and OTP are required'
    });
  }

  const result = await otpService.verifyRegistrationOTP(email, otp);
  res.json(result);
});

// Request login OTP
app.post('/api/login-otp', async (req, res) => {
  const { email, method = 'email' } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const result = await otpService.sendLoginOTP(email, method);
  
  if (result.success) {
    req.session.otpSession = result.session;
    req.session.userEmail = email;
  }
  
  res.json(result);
});

// Verify login OTP
app.post('/api/verify-login', async (req, res) => {
  const { otp } = req.body;
  const session = req.session.otpSession;
  
  if (!otp || !session) {
    return res.status(400).json({
      success: false,
      error: 'OTP and valid session required'
    });
  }

  const result = await otpService.verifyLoginOTP(session, otp);
  
  if (result.success) {
    req.session.authenticated = true;
    delete req.session.otpSession;
  }
  
  res.json(result);
});

// Protected route example
app.get('/api/profile', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
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
    service: 'Verdexis OTP API',
    features: ['email-otp', 'sms-fallback', 'cognito-integration'],
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Enhanced OTP API running on port ${PORT}`);
  console.log(`📧 Email OTP: Ready`);
  console.log(`📱 SMS Fallback: Ready`);
  console.log(`🔐 Cognito Integration: Active`);
});

module.exports = app;