require('dotenv').config();
const express = require('express');
const session = require('express-session');
const CognitoOTP = require('./cognito-otp');

const app = express();
const cognitoOTP = new CognitoOTP();

app.use(express.json());
app.use(session({
  secret: 'verdexis-cognito-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Register new user
app.post('/api/register', async (req, res) => {
  const { email, phoneNumber, password } = req.body;
  
  const result = await cognitoOTP.registerUser(email, phoneNumber, password);
  res.json(result);
});

// Verify registration OTP
app.post('/api/verify-registration', async (req, res) => {
  const { email, otpCode } = req.body;
  
  const result = await cognitoOTP.verifyOTP(email, otpCode);
  res.json(result);
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  const result = await cognitoOTP.login(email, password);
  
  if (result.requiresOTP) {
    req.session = { session: result.session, email };
  }
  
  res.json(result);
});

// Verify login OTP
app.post('/api/verify-login', async (req, res) => {
  const { otpCode } = req.body;
  const { session, email } = req.session || {};
  
  if (!session || !email) {
    return res.json({ success: false, error: 'No active session' });
  }
  
  const result = await cognitoOTP.verifyLoginOTP(email, otpCode, session);
  res.json(result);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Cognito OTP API running on port ${PORT}`);
});

module.exports = app;