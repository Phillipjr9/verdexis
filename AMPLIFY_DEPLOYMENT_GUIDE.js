// VERDEXIS SECURITY FEATURES - AMPLIFY DEPLOYMENT GUIDE
// Deployment to: https://main.d28t5x0lqjdtjj.amplifyapp.com

/**
 * ============================================================================
 * DEPLOYMENT OVERVIEW
 * ============================================================================
 * 
 * Current Setup:
 * - Frontend: React/TypeScript via Amplify
 * - Backend: Express.js server (likely Lambda or EC2)
 * - Domain: https://main.d28t5x0lqjdtjj.amplifyapp.com
 * - Auth: AWS Cognito (configured)
 * 
 * Deployment Strategy:
 * 1. Deploy backend services (security-complete files)
 * 2. Update Amplify backend configuration
 * 3. Deploy API routes
 * 4. Test all endpoints
 * 5. Deploy frontend integration
 * 
 * ============================================================================
 */

/**
 * ============================================================================
 * STEP 1: PREPARE BACKEND FOR DEPLOYMENT
 * ============================================================================
 */

// File Structure for Deployment:
const fileStructure = `
server/
├── src/
│   ├── services/
│   │   ├── password-reset-complete.js      [NEW]
│   │   ├── email-notifications-complete.js [NEW]
│   │   ├── rate-limiting-complete.js       [NEW]
│   │   ├── security-service-complete.js    [NEW]
│   │   └── admin-panel.js                  [UPDATED]
│   │
│   ├── routes/
│   │   ├── api-routes-complete.js          [NEW]
│   │   └── auth.ts                         [UPDATE]
│   │
│   ├── middleware/
│   │   └── security-middleware.js          [NEW]
│   │
│   ├── app.ts                              [UPDATE]
│   └── index.ts
│
├── package.json                            [UPDATE]
└── tsconfig.json
`;

/**
 * ============================================================================
 * STEP 2: UPDATE package.json
 * ============================================================================
 */

const packageJsonUpdates = {
  // Add these dependencies
  newDependencies: {
    "express-rate-limit": "^7.1.5",
    "speakeasy": "^2.0.0",
    "qrcode": "^1.5.3",
    "uuid": "^9.0.1",
    "dotenv": "^16.6.1"
  },

  // Command to run
  command: "npm install express-rate-limit speakeasy qrcode uuid dotenv"
};

/**
 * ============================================================================
 * STEP 3: UPDATE app.ts / app.js
 * ============================================================================
 */

const appTsUpdateCode = `
// Add these imports at top of file
import express from 'express';
import apiRoutesComplete from './routes/api-routes-complete';
import securityMiddleware from './middleware/security-middleware';

// In your main app setup:
const app = express();

// Add middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware (rate limiting, logging, etc)
app.use(securityMiddleware);

// Register security routes
app.use('/api', apiRoutesComplete);

// Your existing routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message,
    code: err.code
  });
});

export default app;
`;

/**
 * ============================================================================
 * STEP 4: CREATE SECURITY MIDDLEWARE
 * ============================================================================
 */

const securityMiddlewareCode = `
import { BruteForceProtection, RateLimitMonitor } from '../services/rate-limiting-complete';

const bruteForce = new BruteForceProtection();
const monitor = new RateLimitMonitor();

const securityMiddleware = (req, res, next) => {
  // Add request tracking
  req.startTime = Date.now();
  req.ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.socket.remoteAddress;

  // Log incoming request
  console.log({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  next();
};

export default securityMiddleware;
`;

/**
 * ============================================================================
 * STEP 5: ENVIRONMENT VARIABLES FOR AMPLIFY
 * ============================================================================
 */

const amplifyEnvVars = {
  production: {
    // AWS Configuration
    AWS_REGION: "us-east-1",
    AWS_COGNITO_USER_POOL_ID: "us-east-1_xxxxxxxxx",  // Get from amplify/auth/resource.ts
    
    // SES Configuration
    SES_FROM_EMAIL: "noreply@verdexis.com",
    SES_REGION: "us-east-1",  // Must be verified in SES
    
    // Application URLs
    APP_URL: "https://main.d28t5x0lqjdtjj.amplifyapp.com",
    API_URL: "https://api.verdexis.com",  // Your backend URL
    
    // Security Settings
    SESSION_TIMEOUT: "1800000",           // 30 minutes
    PASSWORD_MIN_LENGTH: "12",
    REQUIRE_SPECIAL_CHARS: "true",
    REQUIRE_2FA: "false",
    
    // Rate Limiting
    RATE_LIMIT_WINDOW: "900000",          // 15 minutes
    RATE_LIMIT_LOGIN_MAX: "5",
    RATE_LIMIT_REGISTER_MAX: "3",
    RATE_LIMIT_OTP_MAX: "3",
    
    // JWT
    JWT_SECRET: "your-secure-secret-here",
    JWT_EXPIRY: "30m"
  }
};

// Deploy environment variables to Amplify:
// 1. Go to AWS Amplify Console
// 2. App settings > Environment variables
// 3. Add the above variables
// 4. Redeploy

/**
 * ============================================================================
 * STEP 6: UPDATE AMPLIFY BACKEND CONFIGURATION
 * ============================================================================
 */

const amplifyBackendUpdates = {
  // File: amplify/backend.ts
  // Add API configuration
  apiConfig: `
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({
  auth,
  data,
  // Environment will be pulled from settings
});

export default backend;
  `,

  // Ensure these are configured in amplify/auth/resource.ts:
  authConfig: {
    passwordPolicy: {
      minimumLength: 12,
      requireNumbers: true,
      requireLowercase: true,
      requireUppercase: true,
      requireSpecialCharacters: true
    },
    mfa: {
      optional: true,  // Users can enable
      required: false  // Not enforced for all users yet
    },
    customAttributes: [
      { name: 'user_tier', type: 'String' },
      { name: 'kyc_status', type: 'String' },
      { name: '2fa_enabled', type: 'String' },
      { name: 'account_locked', type: 'String' },
      { name: 'suspension_reason', type: 'String' }
    ]
  }
};

/**
 * ============================================================================
 * STEP 7: UPDATE SES CONFIGURATION
 * ============================================================================
 */

const sesSetupSteps = {
  step1: "Go to AWS Console > Simple Email Service (SES)",
  step2: "Verify sender email: noreply@verdexis.com",
  step3: "Move out of Sandbox (request production access)",
  step4: "Create Email Configuration Set (for tracking)",
  step5: "Enable bounce and complaint notifications"
};

// AWS CLI command to verify email:
const sesVerifyCommand = `
aws ses verify-email-identity \\
  --email-address noreply@verdexis.com \\
  --region us-east-1
`;

/**
 * ============================================================================
 * STEP 8: DEPLOY BACKEND SERVICES
 * ============================================================================
 */

const deploymentSteps = {
  step1: "Copy all service files to server/src/services/",
  step2: "Copy api-routes-complete.js to server/src/routes/",
  step3: "Create middleware/security-middleware.js",
  step4: "Update app.ts with security middleware and routes",
  step5: "Update package.json with new dependencies",
  step6: "Run: npm install",
  step7: "Test locally: npm run dev",
  step8: "Deploy to Amplify (git push)"
};

/**
 * ============================================================================
 * STEP 9: AMPLIFY DEPLOYMENT COMMANDS
 * ============================================================================
 */

const amplifyDeployCommands = `
// Initialize/update Amplify
amplify init

// Pull latest environment
amplify pull

// Deploy backend
amplify push

// Deploy to production
git add .
git commit -m "Add security features: password reset, 2FA, email notifications, rate limiting, audit logging, admin panel"
git push

// Monitor deployment
amplify console  // Opens AWS Amplify console
`;

/**
 * ============================================================================
 * STEP 10: FRONTEND INTEGRATION
 * ============================================================================
 */

const frontendIntegrationCode = {
  // app/src/api/auth.ts - Password Reset
  passwordReset: `
export const passwordReset = {
  initiate: async (email: string) => {
    const response = await fetch('/api/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return response.json();
  },

  complete: async (token: string, password: string) => {
    const response = await fetch('/api/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password })
    });
    return response.json();
  },

  change: async (currentPassword: string, newPassword: string) => {
    const response = await fetch('/api/password/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return response.json();
  }
};
  `,

  // app/src/api/twoFactor.ts - 2FA
  twoFactor: `
export const twoFactor = {
  enable: async (email: string, method: string = 'totp') => {
    const response = await fetch('/api/security/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method })
    });
    return response.json();
  },

  confirm: async (email: string, token: string) => {
    const response = await fetch('/api/security/2fa/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token })
    });
    return response.json();
  },

  disable: async (email: string) => {
    const response = await fetch('/api/security/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return response.json();
  }
};
  `,

  // app/src/api/admin.ts - Admin Features
  admin: `
export const admin = {
  users: {
    getAll: async (limit = 60, token = null) => {
      const params = new URLSearchParams({ limit });
      if (token) params.append('nextToken', token);
      
      const response = await fetch('/api/admin/users?' + params);
      return response.json();
    },

    suspend: async (email: string, reason: string) => {
      const response = await fetch('/api/admin/users/' + email + '/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      return response.json();
    },

    getDashboard: async () => {
      const response = await fetch('/api/admin/dashboard');
      return response.json();
    }
  }
};
  `
};

/**
 * ============================================================================
 * STEP 11: TESTING CHECKLIST
 * ============================================================================
 */

const testingChecklist = {
  authentication: [
    "[ ] User can register with valid password",
    "[ ] User receives welcome email",
    "[ ] User cannot register with weak password",
    "[ ] User can login",
    "[ ] Failed login increments counter",
    "[ ] IP is blocked after 5 failed attempts"
  ],

  passwordReset: [
    "[ ] User can initiate forgot password",
    "[ ] Email with reset link sent",
    "[ ] Reset token validation works",
    "[ ] User can reset password with token",
    "[ ] Old token cannot be reused",
    "[ ] Token expires after 1 hour"
  ],

  twoFactor: [
    "[ ] User can enable 2FA",
    "[ ] QR code generated correctly",
    "[ ] User can confirm 2FA",
    "[ ] Login requires 2FA code",
    "[ ] Backup codes work",
    "[ ] User can disable 2FA"
  ],

  emailNotifications: [
    "[ ] Welcome email sent on registration",
    "[ ] Transaction confirmation sent",
    "[ ] Security alerts sent on suspicious activity",
    "[ ] KYC status updates sent",
    "[ ] Password change notifications sent"
  ],

  rateLimiting: [
    "[ ] Login rate limited (5 per 15 min)",
    "[ ] Registration rate limited (3 per hour)",
    "[ ] OTP rate limited (3 per 10 min)",
    "[ ] IP blocked after threshold",
    "[ ] Rate limit can be bypassed with whitelist"
  ],

  admin: [
    "[ ] Admin can view all users",
    "[ ] Admin can suspend user",
    "[ ] Admin can reactivate user",
    "[ ] Admin can view dashboard",
    "[ ] Admin can verify/reject KYC",
    "[ ] Admin actions are logged"
  ],

  auditLogging: [
    "[ ] Login events logged",
    "[ ] Failed login attempts logged",
    "[ ] Admin actions logged",
    "[ ] Transaction events logged",
    "[ ] Logs can be exported"
  ]
};

/**
 * ============================================================================
 * STEP 12: MONITORING & ALERTS
 * ============================================================================
 */

const monitoringSetup = {
  cloudWatch: {
    // Create CloudWatch alarms for:
    metrics: [
      "High login failure rate",
      "Multiple IPs blocked",
      "Email delivery failures",
      "2FA failures",
      "Admin actions"
    ]
  },

  logs: {
    // Enable logging in CloudWatch
    setup: `
// In app.ts
import { CloudWatchLogs } from 'aws-sdk';

const logs = new CloudWatchLogs({ region: process.env.AWS_REGION });

// Send logs to CloudWatch
app.use((req, res, next) => {
  console.log({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    status: res.statusCode
  });
  next();
});
    `
  }
};

/**
 * ============================================================================
 * STEP 13: PRODUCTION DEPLOYMENT
 * ============================================================================
 */

const productionChecklist = {
  preDeployment: [
    "[ ] All environment variables set in Amplify",
    "[ ] SES verified and out of sandbox",
    "[ ] Cognito user pool configured",
    "[ ] Database migrations applied",
    "[ ] SSL certificate configured",
    "[ ] CORS settings updated",
    "[ ] Rate limits tuned for production",
    "[ ] Error handling tested",
    "[ ] Logging configured"
  ],

  deployment: [
    "[ ] Code reviewed and tested",
    "[ ] All tests passing",
    "[ ] Database backup created",
    "[ ] Deployment plan documented",
    "[ ] Team notified",
    "[ ] Rollback plan ready"
  ],

  postDeployment: [
    "[ ] All endpoints responding",
    "[ ] Email notifications working",
    "[ ] Rate limiting active",
    "[ ] Admin panel accessible",
    "[ ] Audit logs being recorded",
    "[ ] Monitoring and alerts working",
    "[ ] Users can register and login",
    "[ ] 2FA working correctly"
  ]
};

/**
 * ============================================================================
 * DEPLOYMENT COMMANDS SUMMARY
 * ============================================================================
 */

const deploymentSummary = `
// 1. Copy service files
cp password-reset-complete.js server/src/services/
cp email-notifications-complete.js server/src/services/
cp rate-limiting-complete.js server/src/services/
cp security-service-complete.js server/src/services/
cp api-routes-complete.js server/src/routes/

// 2. Install dependencies
cd server
npm install express-rate-limit speakeasy qrcode uuid dotenv

// 3. Update environment variables
// Go to Amplify Console > App settings > Environment variables
// Add all variables from amplifyEnvVars

// 4. Update Cognito (if needed)
amplify update auth

// 5. Deploy
amplify push

// 6. Commit and push
git add .
git commit -m "Production deployment: Complete security features"
git push

// 7. Monitor
amplify console  // View deployment status
`;

/**
 * ============================================================================
 * PRODUCTION URLS
 * ============================================================================
 */

const productionUrls = {
  frontend: "https://main.d28t5x0lqjdtjj.amplifyapp.com",
  api: {
    auth: "https://main.d28t5x0lqjdtjj.amplifyapp.com/api/auth",
    security: "https://main.d28t5x0lqjdtjj.amplifyapp.com/api/security",
    admin: "https://main.d28t5x0lqjdtjj.amplifyapp.com/api/admin",
    password: "https://main.d28t5x0lqjdtjj.amplifyapp.com/api/password"
  },
  console: "https://console.aws.amazon.com/amplify"
};

/**
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 */

const troubleshooting = {
  emailNotSending: {
    causes: [
      "SES still in sandbox mode",
      "Sender email not verified",
      "Wrong AWS region",
      "IAM permissions missing"
    ],
    fixes: [
      "Request SES production access",
      "Verify sender email in SES console",
      "Check AWS_REGION environment variable",
      "Add SES:SendEmail permission to IAM role"
    ]
  },

  rateLimitingNotWorking: {
    causes: [
      "IP detection wrong (proxy/load balancer)",
      "Store not persisting",
      "Limits not matching config"
    ],
    fixes: [
      "Set X-Forwarded-For header correctly",
      "Use DynamoDB store instead of memory",
      "Verify limit values in environment"
    ]
  },

  twoFANotWorking: {
    causes: [
      "System time not synchronized",
      "TOTP secret not saved",
      "Authenticator app out of sync"
    ],
    fixes: [
      "Sync system time with NTP",
      "Test TOTP token generation",
      "Ask user to rescan QR code"
    ]
  }
};

module.exports = {
  fileStructure,
  packageJsonUpdates,
  appTsUpdateCode,
  securityMiddlewareCode,
  amplifyEnvVars,
  amplifyBackendUpdates,
  sesSetupSteps,
  deploymentSteps,
  amplifyDeployCommands,
  frontendIntegrationCode,
  testingChecklist,
  monitoringSetup,
  productionChecklist,
  deploymentSummary,
  productionUrls,
  troubleshooting
};
