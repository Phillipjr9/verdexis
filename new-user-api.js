require('dotenv').config();
const express = require('express');
const session = require('express-session');
const NewUserOTPAuth = require('./new-user-otp');

const app = express();
const authService = new NewUserOTPAuth();

app.use(express.json());
app.use(session({
  secret: 'verdexis-new-user-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

console.log(`
🚀 Verdexis Authentication API
📱 NEW users: OTP verification required
🔐 EXISTING users: Direct login (no OTP)
👨‍💼 ADMINS: Direct login (no OTP)
`);

// Check if user exists (for frontend to decide flow)
app.post('/api/check-user', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  try {
    const userCheck = await authService.checkUserExists(email);
    res.json({
      success: true,
      exists: userCheck.exists,
      message: userCheck.exists ? 'Existing user - proceed to login' : 'New user - registration required'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NEW USER: Start registration with OTP
app.post('/api/register', async (req, res) => {
  const { email, phoneNumber, password, name } = req.body;
  
  if (!email || !phoneNumber || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'All fields required: email, phoneNumber, password, name'
    });
  }

  const result = await authService.registerNewUser(email, phoneNumber, password, name);
  
  if (result.success) {
    req.session.registrationPhone = phoneNumber;
  }
  
  res.json(result);
});

// NEW USER: Verify OTP and complete registration
app.post('/api/verify-registration', async (req, res) => {
  const { phoneNumber, otp } = req.body;
  
  if (!phoneNumber || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Phone number and OTP are required'
    });
  }

  const result = await authService.verifyAndCompleteRegistration(phoneNumber, otp);
  
  if (result.success) {
    delete req.session.registrationPhone;
  }
  
  res.json(result);
});

// EXISTING USERS & ADMINS: Direct login (no OTP)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  const result = await authService.login(email, password);
  
  if (result.success) {
    req.session.authenticated = true;
    req.session.userEmail = email;
    req.session.isNewUser = false;
  }
  
  res.json(result);
});

// Get user profile (protected route)
app.get('/api/profile', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const userInfo = await authService.cognito.adminGetUser({
      UserPoolId: authService.userPoolId,
      Username: req.session.userEmail
    }).promise();

    const attributes = {};
    userInfo.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });

    res.json({
      success: true,
      user: {
        email: req.session.userEmail,
        attributes: attributes,
        userStatus: userInfo.UserStatus,
        createdDate: userInfo.UserCreateDate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Verdexis New User OTP API',
    features: {
      newUsers: 'OTP verification required',
      existingUsers: 'Direct login (no OTP)',
      admins: 'Direct login (no OTP)'
    },
    endpoints: {
      '/api/check-user': 'Check if user exists',
      '/api/register': 'New user registration with OTP',
      '/api/verify-registration': 'Verify OTP and complete registration',
      '/api/login': 'Existing user/admin login',
      '/api/profile': 'Get user profile (protected)',
      '/api/logout': 'Logout user'
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`\n🌐 API running on: http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;