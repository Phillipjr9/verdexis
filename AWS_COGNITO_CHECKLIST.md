# AWS Cognito OTP Setup Checklist

## ✅ Completed
- [x] Cognito OTP service created (`cognitoOTP.ts`)
- [x] Setup guide created (`AWS_COGNITO_OTP_SETUP.md`)
- [x] AWS SDK already installed

## 📋 TODO - AWS Account Setup (5 min)

### 1. Create AWS Account
- [ ] Go to https://aws.amazon.com/free
- [ ] Click "Create a free account"
- [ ] Enter email and password
- [ ] Verify email
- [ ] Add payment method (won't be charged)
- [ ] Complete setup

### 2. Create Cognito User Pool
- [ ] Go to AWS Console
- [ ] Search for "Cognito"
- [ ] Click "User Pools"
- [ ] Click "Create user pool"
- [ ] Select "Phone number" as sign-in method
- [ ] Enable SMS MFA
- [ ] Review and create
- [ ] Copy **User Pool ID**

### 3. Create App Client
- [ ] Go to "App integration" → "App clients"
- [ ] Click "Create app client"
- [ ] Name: `verdexis-app`
- [ ] Enable auth flows:
  - [ ] ALLOW_ADMIN_USER_PASSWORD_AUTH
  - [ ] ALLOW_USER_PASSWORD_AUTH
- [ ] Create
- [ ] Copy **Client ID**

### 4. Get AWS Credentials
- [ ] Go to AWS Console home
- [ ] Click account name (top right)
- [ ] Click "Security credentials"
- [ ] Create access key
- [ ] Choose "CLI"
- [ ] Copy **Access Key ID**
- [ ] Copy **Secret Access Key**

## 📋 TODO - Environment Setup (5 min)

### 5. Update `server/.env.local`
```bash
# AWS Cognito Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=your-client-id
```

- [ ] Add AWS_REGION
- [ ] Add AWS_ACCESS_KEY_ID
- [ ] Add AWS_SECRET_ACCESS_KEY
- [ ] Add AWS_COGNITO_USER_POOL_ID
- [ ] Add AWS_COGNITO_CLIENT_ID
- [ ] Save file

### 6. Verify Environment Variables
- [ ] Check `.env.local` has all 5 variables
- [ ] No typos in variable names
- [ ] Values copied correctly

## 📋 TODO - Backend Integration (10 min)

### 7. Update OTP Routes
- [ ] Open `server/src/routes/otp.ts`
- [ ] Import cognitoOTPService
- [ ] Replace Twilio with Cognito in send-otp
- [ ] Replace Twilio with Cognito in verify-otp
- [ ] Save file

### 8. Test Backend
```bash
cd server
npm run dev
```

- [ ] Server starts without errors
- [ ] Check logs for: `[cognito-otp] ✅ AWS Cognito OTP Service initialized`
- [ ] No connection errors

## 📋 TODO - Testing (10 min)

### 9. Test Phone OTP Locally

#### Option A: Using API
```bash
# Get JWT token first (from login)
# Then send OTP
curl -X POST http://localhost:4000/api/otp/send-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"phoneNumber": "+17372583742", "purpose": "login"}'
```

- [ ] OTP sends successfully
- [ ] Check phone for SMS
- [ ] Verify OTP code works

#### Option B: Using Frontend
- [ ] Open frontend dev server
- [ ] Go to login page
- [ ] Enter phone number
- [ ] Click "Send OTP"
- [ ] Check phone for SMS
- [ ] Enter code
- [ ] Verify login works

### 10. Verify User Created in Cognito
- [ ] Go to AWS Console
- [ ] Go to Cognito → User Pools
- [ ] Click your pool
- [ ] Go to "Users"
- [ ] See your test phone number
- [ ] Verify phone_number_verified = true

## 📋 TODO - Production Setup (5 min)

### 11. Add to Production Environment
- [ ] Go to your hosting (Render/Railway/etc)
- [ ] Add environment variables:
  - [ ] AWS_REGION
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] AWS_COGNITO_USER_POOL_ID
  - [ ] AWS_COGNITO_CLIENT_ID
- [ ] Redeploy application

### 12. Test in Production
- [ ] Go to production URL
- [ ] Test phone OTP flow
- [ ] Verify SMS delivery
- [ ] Check Cognito console for new users

## 📋 TODO - Monitoring (5 min)

### 13. Set Up Monitoring
- [ ] Go to AWS Console
- [ ] Go to Cognito → User Pools
- [ ] Click your pool
- [ ] Go to "Analytics"
- [ ] View daily active users
- [ ] View sign-ups and sign-ins

### 14. Set Up Alerts (Optional)
- [ ] Go to CloudWatch
- [ ] Create alarm for:
  - [ ] High failed sign-ins
  - [ ] Unusual activity
  - [ ] SMS delivery failures

## 🧪 Testing Checklist

- [ ] AWS account created
- [ ] Cognito User Pool created
- [ ] App Client created
- [ ] AWS credentials obtained
- [ ] Environment variables set
- [ ] Backend starts without errors
- [ ] OTP sends to phone
- [ ] OTP code received
- [ ] OTP verification works
- [ ] User created in Cognito
- [ ] Phone number verified
- [ ] Login successful
- [ ] Production deployment works

## 📊 Cost Verification

- [ ] AWS Free Tier active
- [ ] 50,000 monthly active users included
- [ ] No charges for OTP
- [ ] Billing alerts set up

## 🔒 Security Checklist

- [ ] `.env.local` added to `.gitignore`
- [ ] AWS credentials not committed
- [ ] Access keys rotated (if needed)
- [ ] IAM user created (not root account)
- [ ] MFA enabled on AWS account

## 📞 Support Resources

- AWS Cognito Docs: https://docs.aws.amazon.com/cognito/
- AWS Free Tier: https://aws.amazon.com/free/
- AWS Support: https://console.aws.amazon.com/support/

## Timeline

- **Step 1-4**: AWS setup (5 min)
- **Step 5-6**: Environment setup (5 min)
- **Step 7-8**: Backend integration (10 min)
- **Step 9-10**: Testing (10 min)
- **Step 11-12**: Production (5 min)
- **Step 13-14**: Monitoring (5 min)

**Total: ~40 minutes**

## Quick Commands

```bash
# Start dev server
cd server
npm run dev

# Check logs
npm run dev | grep cognito-otp

# Test OTP endpoint
curl -X POST http://localhost:4000/api/otp/send-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"phoneNumber": "+17372583742"}'
```

## Next Steps

1. Create AWS account (free tier)
2. Create Cognito User Pool
3. Get credentials
4. Update `.env.local`
5. Test locally
6. Deploy to production

**Ready to start? Follow the steps above!**
