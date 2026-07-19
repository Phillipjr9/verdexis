require('dotenv').config();
const express = require('express');
const session = require('express-session');
const ConsoleOTP = require('./console-otp');

const app = express();
const otpService = new ConsoleOTP();

app.use(express.json());
app.use(session({
  secret: 'test-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

console.log(`
🚀 Verdexis Test OTP API
📱 No SMS/Email required - OTP codes shown in console
🔐 Perfect for development and testing
`);

// Register user
app.post('/api/register', async (req, res) => {
  const { email, phoneNumber, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'Email, password, and name are required'
    });
  }

  const result = await otpService.registerUser(email, phoneNumber, password, name);
  res.json(result);
});

// Verify registration
app.post('/api/verify-registration', async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Email and OTP are required'
    });
  }

  const result = await otpService.verifyRegistration(email, otp);
  res.json(result);
});

// Request login OTP
app.post('/api/login-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const result = await otpService.sendLoginOTP(email);
  
  if (result.success) {
    req.session.otpSession = result.session;
    req.session.userEmail = email;
  }
  
  res.json(result);
});

// Verify login
app.post('/api/verify-login', async (req, res) => {
  const { otp } = req.body;
  const session = req.session.otpSession;
  
  if (!otp || !session) {
    return res.status(400).json({
      success: false,
      error: 'OTP and session required'
    });
  }

  const result = await otpService.verifyLogin(session, otp);
  
  if (result.success) {
    req.session.authenticated = true;
  }
  
  res.json(result);
});

// Protected route
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
      authenticated: true,
      message: 'Welcome to Verdexis!'
    }
  });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`\n🌐 API running on: http://localhost:${PORT}`);
  console.log(`📋 Ready for testing! OTP codes will appear in this console.\n`);
});

module.exports = app;