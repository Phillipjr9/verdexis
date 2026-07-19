# AWS Cognito Phone OTP Setup Guide

## Overview

AWS Cognito provides **completely free** phone OTP authentication:
- ✅ 50,000 monthly active users (free)
- ✅ No billing required
- ✅ No credit card needed
- ✅ Production-ready
- ✅ Highly scalable

---

## Step 1: Create AWS Account (Free Tier)

1. Go to https://aws.amazon.com/free
2. Click "Create a free account"
3. Enter email and password
4. Verify email
5. Add payment method (won't be charged for free tier)
6. Complete account setup

**Free Tier Includes:**
- 50,000 monthly active users in Cognito
- 50 GB of data transfer
- No charges for 12 months

---

## Step 2: Create Cognito User Pool

1. Go to AWS Console: https://console.aws.amazon.com
2. Search for "Cognito"
3. Click "User Pools"
4. Click "Create user pool"
5. Choose "Configure sign-in experience":
   - Select: **Phone number**
   - Uncheck: Email
6. Click "Next"

---

## Step 3: Configure MFA (Multi-Factor Authentication)

1. Under "Multi-factor authentication":
   - Select: **Optional**
   - Check: **SMS message**
2. Click "Next"

---

## Step 4: Configure Message Delivery

1. Under "Email provider":
   - Select: **Send email with Cognito**
2. Under "SMS message settings":
   - Select: **Send SMS with Cognito**
3. Click "Next"

---

## Step 5: Review and Create

1. Review all settings
2. Click "Create user pool"
3. Wait for creation (takes ~1 minute)
4. Copy the **User Pool ID** (e.g., `us-east-1_xxxxxxxxx`)

---

## Step 6: Create App Client

1. In User Pool, go to **App integration** → **App clients and analytics**
2. Click **Create app client**
3. Enter name: `verdexis-app`
4. Under "Authentication flows":
   - Check: **ALLOW_ADMIN_USER_PASSWORD_AUTH**
   - Check: **ALLOW_USER_PASSWORD_AUTH**
5. Click **Create app client**
6. Copy the **Client ID**

---

## Step 7: Get AWS Credentials

1. Go to AWS Console home
2. Click your account name (top right)
3. Click **Security credentials**
4. Under "Access keys":
   - Click **Create access key**
   - Choose **Command Line Interface (CLI)**
   - Accept terms
   - Click **Create access key**
5. Copy:
   - **Access Key ID**
   - **Secret Access Key**

**⚠️ IMPORTANT**: Save these securely. Don't share them!

---

## Step 8: Update Environment Variables

### `server/.env.local`:

```bash
# AWS Cognito Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=your-client-id
```

### Get these values:
- **AWS_REGION**: `us-east-1` (or your region)
- **AWS_ACCESS_KEY_ID**: From Step 7
- **AWS_SECRET_ACCESS_KEY**: From Step 7
- **AWS_COGNITO_USER_POOL_ID**: From Step 5
- **AWS_COGNITO_CLIENT_ID**: From Step 6

---

## Step 9: Install AWS SDK

```bash
cd server
npm install aws-sdk
```

(Already installed in your project)

---

## Step 10: Update OTP Routes

### `server/src/routes/otp.ts`:

Replace Twilio with Cognito:

```typescript
import { cognitoOTPService } from '../services/cognitoOTP.js'

// In send-otp endpoint:
const result = await cognitoOTPService.sendOTP(phoneNumber, userId)

// In verify-otp endpoint:
const verified = await cognitoOTPService.verifyOTP(phoneNumber, code, sessionId)
```

---

## Step 11: Test Locally

```bash
cd server
npm run dev
```

Check logs for:
```
[cognito-otp] ✅ AWS Cognito OTP Service initialized
```

---

## Step 12: Test Phone OTP

### Using cURL:

```bash
# Send OTP
curl -X POST http://localhost:4000/api/otp/send-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "phoneNumber": "+17372583742",
    "purpose": "login"
  }'

# Verify OTP
curl -X POST http://localhost:4000/api/otp/verify-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "code": "123456",
    "purpose": "login"
  }'
```

---

## Step 13: Configure SMS Settings (Optional)

To customize SMS messages:

1. Go to User Pool → **Messaging**
2. Under "SMS message settings":
   - Edit message template
   - Add your branding
3. Save

Example template:
```
Your Verdexis verification code is: {####}
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Your Application                │
│      (Express.js + React)               │
└────────────────┬────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  AWS Cognito       │
        │  User Pool         │
        │  (Phone OTP)       │
        └────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
    ┌────────┐      ┌──────────┐
    │  SMS   │      │ Database │
    │ (Free) │      │(Cognito) │
    └────────┘      └──────────┘
```

---

## Cost Breakdown

| Feature | Free Tier | Cost |
|---------|-----------|------|
| Monthly Active Users | 50,000 | $0 |
| SMS OTP | Unlimited | $0 |
| User Management | Unlimited | $0 |
| Authentication | Unlimited | $0 |
| **Total** | | **$0** |

---

## Troubleshooting

### "Invalid client id" error
- Check `AWS_COGNITO_CLIENT_ID` in `.env.local`
- Verify Client ID from Cognito console

### "User pool does not exist" error
- Check `AWS_COGNITO_USER_POOL_ID` format
- Verify User Pool ID from Cognito console

### SMS not sending
- Check SMS settings in Cognito console
- Verify phone number format: `+1234567890`
- Check AWS account SMS limits

### "Access Denied" error
- Verify AWS credentials in `.env.local`
- Check IAM permissions for Cognito

### Phone number already exists
- User already registered
- Use different phone number or delete user first

---

## Security Best Practices

1. **Never commit credentials**:
   ```bash
   # Add to .gitignore
   .env.local
   firebase-service-account.json
   ```

2. **Rotate access keys regularly**:
   - Go to AWS Console → Security credentials
   - Create new access key
   - Delete old one

3. **Use IAM roles in production**:
   - Don't use root account credentials
   - Create IAM user with limited permissions

4. **Enable MFA on AWS account**:
   - Go to AWS Console → Security credentials
   - Enable MFA

---

## Production Deployment

### On Render/Railway:

1. Go to your hosting dashboard
2. Add environment variables:
   ```
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_COGNITO_USER_POOL_ID=...
   AWS_COGNITO_CLIENT_ID=...
   ```
3. Redeploy

### On AWS Lambda:

1. Create Lambda function
2. Add environment variables
3. Deploy Express.js as Lambda

---

## Monitoring

### Check usage in AWS Console:

1. Go to Cognito → User Pools
2. Click your pool
3. Go to **Analytics**
4. View:
   - Daily active users
   - Sign-ups
   - Sign-ins
   - MFA usage

---

## Support

- AWS Cognito Docs: https://docs.aws.amazon.com/cognito/
- Phone OTP Guide: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
- AWS Free Tier: https://aws.amazon.com/free/
- AWS Support: https://console.aws.amazon.com/support/

---

## Quick Reference

```bash
# Environment variables needed
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=1234567890abcdefghijklmnop

# Test command
npm run dev

# Check logs
[cognito-otp] ✅ AWS Cognito OTP Service initialized
```

---

## Next Steps

1. ✅ Create AWS account (free tier)
2. ✅ Create Cognito User Pool
3. ✅ Create App Client
4. ✅ Get AWS credentials
5. ✅ Update `.env.local`
6. ✅ Test locally
7. ✅ Deploy to production
8. ✅ Monitor usage

**Estimated time: 30 minutes**
