# Get AWS Credentials from Your Amplify Setup

Since you already have Amplify deployed, you just need to get your AWS credentials.

## Step 1: Get AWS Access Keys

1. Go to AWS Console: https://console.aws.amazon.com
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

⚠️ **IMPORTANT**: Save these securely. Don't share them!

## Step 2: Update `server/.env.local`

Add your AWS credentials:

```bash
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_COGNITO_USER_POOL_ID=us-east-2_s3X852yAb
AWS_COGNITO_CLIENT_ID=5nifp6aq5ha8fee3sh7hrpp2fu
```

## Step 3: Enable Phone Authentication in Cognito

1. Go to AWS Console
2. Search for "Cognito"
3. Click "User Pools"
4. Click your pool: `us-east-2_s3X852yAb`
5. Go to **Sign-in experience**
6. Under "Sign-in options":
   - Check **Phone number**
7. Click **Save changes**

## Step 4: Enable SMS MFA

1. In User Pool, go to **Multi-factor authentication**
2. Select **Optional**
3. Check **SMS message**
4. Click **Save changes**

## Step 5: Test Locally

```bash
cd server
npm run dev
```

Check logs for:
```
[cognito-otp] ✅ AWS Cognito OTP Service initialized
```

## Step 6: Update OTP Routes

In `server/src/routes/otp.ts`, replace Twilio with Cognito:

```typescript
import { cognitoOTPService } from '../services/cognitoOTP.js'

// In send-otp endpoint:
const result = await cognitoOTPService.sendOTP(phoneNumber, userId)

// In verify-otp endpoint:
const verified = await cognitoOTPService.verifyOTP(phoneNumber, code, sessionId)
```

## Step 7: Deploy to Amplify

```bash
# Push changes to Amplify
amplify push

# Or if using git
git add .
git commit -m "Add AWS Cognito OTP"
git push
```

## Done! 🎉

Your Cognito User Pool is already set up and ready for phone OTP.

### Your Cognito Details:
- **Region**: us-east-2
- **User Pool ID**: us-east-2_s3X852yAb
- **Client ID**: 5nifp6aq5ha8fee3sh7hrpp2fu
- **Status**: ✅ Ready for phone OTP

### Cost:
- **Free tier**: 50,000 monthly active users
- **SMS OTP**: Unlimited
- **Total cost**: $0
