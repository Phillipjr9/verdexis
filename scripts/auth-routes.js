const express = require('express');
const VerdexisCognitoAuth = require('./cognito-auth');

const router = express.Router();
const cognitoAuth = new VerdexisCognitoAuth();

// Sign up endpoint
router.post('/signup', async (req, res) => {
  const { email, phoneNumber, password, name } = req.body;

  if (!email || !phoneNumber || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, phoneNumber, password, name'
    });
  }

  const result = await cognitoAuth.signUp(email, phoneNumber, password, name);
  
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Confirm sign up with OTP
router.post('/confirm-signup', async (req, res) => {
  const { email, otpCode } = req.body;

  if (!email || !otpCode) {
    return res.status(400).json({
      success: false,
      error: 'Email and OTP code are required'
    });
  }

  const result = await cognitoAuth.confirmSignUp(email, otpCode);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Sign in endpoint
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  const result = await cognitoAuth.signIn(email, password);
  
  if (result.success) {
    if (result.requiresOTP) {
      // Store session in memory/Redis for production
      req.session.cognitoSession = result.session;
      req.session.userEmail = email;
    }
    res.status(200).json(result);
  } else {
    res.status(401).json(result);
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  const { otpCode } = req.body;
  const email = req.session.userEmail;
  const session = req.session.cognitoSession;

  if (!otpCode || !email || !session) {
    return res.status(400).json({
      success: false,
      error: 'OTP code required and valid session needed'
    });
  }

  const result = await cognitoAuth.verifyOTP(email, otpCode, session);
  
  if (result.success) {
    // Clear session data
    delete req.session.cognitoSession;
    delete req.session.userEmail;
    
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  const accessToken = authHeader.substring(7);
  const result = await cognitoAuth.getUserInfo(accessToken);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(401).json(result);
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const result = await cognitoAuth.resendConfirmationCode(email);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Enable MFA
router.post('/enable-mfa', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  const accessToken = authHeader.substring(7);
  const result = await cognitoAuth.enableMFA(accessToken);
  
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

module.exports = router;