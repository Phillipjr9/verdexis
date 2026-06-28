# Complete AWS OTP Setup for Verdexis

## 🚀 What's Been Implemented

### **1. AWS Services Integration**
✅ **AWS SNS** - Direct SMS delivery with global reach  
✅ **AWS Cognito** - Managed authentication with built-in MFA  
✅ **AWS Lambda** - Serverless OTP processing with DynamoDB storage  
✅ **Smart Fallback** - Automatic failover between services  

### **2. Multi-Method OTP Delivery**
✅ **Email OTP** - SMTP with professional templates  
✅ **SMS OTP** - AWS SNS with international support  
✅ **Auto-Detection** - Best method based on user preferences  
✅ **Cost Optimization** - Intelligent provider selection  

### **3. Admin Management**
✅ **AWS Status Monitoring** - Real-time service health  
✅ **Connection Testing** - Verify AWS connectivity  
✅ **Cost Tracking** - SMS pricing per country  
✅ **Provider Switching** - Manual override capabilities  

## 📋 Setup Steps

### **Step 1: AWS Account Setup**

1. **Create AWS Account** (if not exists)
2. **Create IAM User** with programmatic access
3. **Attach Policies:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "sns:Publish",
           "cognito-idp:*",
           "lambda:InvokeFunction",
           "dynamodb:PutItem",
           "dynamodb:GetItem",
           "dynamodb:Query",
           "dynamodb:UpdateItem"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

### **Step 2: Environment Configuration**

Update `server/.env`:
```bash
# Basic AWS Configuration
AWS_ACCESS_KEY_ID=AKIA...your-key
AWS_SECRET_ACCESS_KEY=...your-secret
AWS_REGION=us-east-1

# For SNS SMS (Option 1 - Simple)
# No additional config needed

# For Cognito (Option 2 - Managed Auth)
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=your-client-id
AWS_COGNITO_CLIENT_SECRET=your-client-secret

# For Lambda (Option 3 - Advanced)
AWS_LAMBDA_OTP_FUNCTION=verdexis-otp-handler
AWS_DYNAMODB_OTP_TABLE=verdexis-otp-codes
```

### **Step 3: Choose Your AWS OTP Method**

#### **Option A: AWS SNS (Recommended for Most)**
```bash
# Test SNS SMS
aws sns publish \
  --phone-number "+1234567890" \
  --message "Test from Verdexis" \
  --message-attributes '{"AWS.SNS.SMS.SenderID":{"DataType":"String","StringValue":"Verdexis"}}'
```

**Pros:** Simple setup, global reach, pay-per-use  
**Cons:** No built-in user management  
**Cost:** $0.00645 per SMS (US), varies by country  

#### **Option B: AWS Cognito (Recommended for Enterprise)**
```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name "verdexis-users" \
  --mfa-configuration "ON"

# Create App Client  
aws cognito-idp create-user-pool-client \
  --user-pool-id "us-east-1_xxxxxxxxx" \
  --client-name "verdexis-web"
```

**Pros:** Complete auth solution, managed MFA, scalable  
**Cons:** More complex setup, vendor lock-in  
**Cost:** Free for 50k users/month, $0.0055 per additional user  

#### **Option C: AWS Lambda (Recommended for Custom Logic)**
```bash
# Deploy infrastructure
aws cloudformation deploy \
  --template-file aws-infrastructure.yml \
  --stack-name verdexis-otp-infrastructure \
  --capabilities CAPABILITY_IAM

# Upload Lambda code
cd server/aws-lambda
zip -r otp-handler.zip .
aws lambda update-function-code \
  --function-name verdexis-otp-handler \
  --zip-file fileb://otp-handler.zip
```

**Pros:** Full control, serverless, custom business logic  
**Cons:** Most complex setup, requires maintenance  
**Cost:** $0.20 per 1M requests + DynamoDB usage  

### **Step 4: Test Your Setup**

#### **Test AWS Connection:**
```bash
curl -X POST http://localhost:4000/api/security/aws/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### **Test OTP Sending:**
```bash
curl -X POST http://localhost:4000/api/otp/send-otp \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "login",
    "method": "sms",
    "phoneNumber": "+1234567890"
  }'
```

#### **Test Admin Panel:**
```bash
curl -X POST http://localhost:4000/api/security/aws/send-test-otp \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "code": "123456"
  }'
```

## 🔧 **Available API Endpoints**

### **User Endpoints:**
- `POST /api/otp/send-otp` - Send OTP (email/SMS/auto)
- `POST /api/otp/verify-otp` - Verify OTP code
- `GET /api/otp/status` - Get user OTP settings

### **Admin Endpoints:**
- `GET /api/security/aws/status` - AWS service status
- `POST /api/security/aws/test` - Test AWS connectivity  
- `POST /api/security/aws/send-test-otp` - Test OTP sending
- `GET /api/admin/otp/analytics` - OTP usage analytics

### **Admin User Management:**
- `GET/PUT /api/admin/users/:id/otp-settings` - Manage user OTP
- `POST /api/admin/users/bulk-otp-settings` - Bulk OTP updates
- `GET /api/admin/otp/analytics` - Adoption & success rates

## 📊 **AWS OTP Features**

### **Smart Delivery:**
```javascript
// Auto-selects best method based on:
// 1. User preferences (email vs SMS)
// 2. Available AWS services
// 3. Cost optimization
// 4. Delivery success rates

const result = await awsOTPService.sendOTP(
  phoneNumber, 
  code, 
  'transaction', 
  userId
)
```

### **Fallback Chain:**
1. **Primary:** AWS Lambda (if configured)
2. **Fallback 1:** AWS Cognito (if configured)  
3. **Fallback 2:** AWS SNS (always available)
4. **Emergency:** Email OTP via SMTP

### **Cost Monitoring:**
```javascript
// Get real-time pricing
const pricing = await awsSNSService.getSMSPricing('+1234567890')
// Returns: { price: "0.00645", currency: "USD" }

// Track delivery costs
const result = await awsOTPService.sendOTP(phoneNumber, code)
console.log(`SMS sent for ${result.cost}`)
```

### **Error Handling:**
```javascript
try {
  const result = await awsOTPService.sendOTP(phoneNumber, code)
  if (!result.success) {
    // Automatic fallback to next provider
    console.log(`Primary failed: ${result.error}`)
    console.log(`Fallback provider: ${result.provider}`)
  }
} catch (error) {
  // All providers failed - use email fallback
}
```

## 🏗️ **Production Deployment**

### **CloudFormation Stack:**
```bash
# Deploy complete infrastructure
aws cloudformation deploy \
  --template-file AWS_OTP_SETUP.md \
  --stack-name verdexis-otp-prod \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM

# Get output values
aws cloudformation describe-stacks \
  --stack-name verdexis-otp-prod \
  --query 'Stacks[0].Outputs'
```

### **Monitoring Setup:**
```bash
# CloudWatch alarms for OTP failures
aws cloudwatch put-metric-alarm \
  --alarm-name "Verdexis-OTP-Failures" \
  --metric-name "SMSMonthlySpend" \
  --namespace "AWS/SNS" \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

### **Security Hardening:**
1. **VPC Endpoints** for private AWS access
2. **IAM Roles** with least-privilege access
3. **Encryption** for all data at rest and in transit
4. **Rate Limiting** on all OTP endpoints
5. **Audit Logging** for all OTP operations

## 📈 **Scaling Considerations**

### **Volume Planning:**
- **< 1K users:** Use AWS SNS directly
- **1K-10K users:** Add Cognito for user management  
- **10K+ users:** Implement Lambda for custom logic
- **Enterprise:** Multi-region deployment with failover

### **Cost Optimization:**
- **SMS Routing:** Route by country for best rates
- **Batch Processing:** Group international SMS
- **Time-Based:** Send during off-peak hours in target timezone
- **Method Selection:** Prefer email for non-critical OTPs

## 🚨 **Troubleshooting**

### **Common Issues:**
1. **"SMS not delivered"** → Check phone number format (E.164)
2. **"AWS credentials invalid"** → Verify IAM permissions
3. **"Lambda timeout"** → Increase function timeout/memory
4. **"Cognito setup failed"** → Check User Pool configuration

### **Debug Commands:**
```bash
# Test AWS connectivity
aws sts get-caller-identity

# Check SNS SMS spending limits
aws sns get-sms-attributes

# Verify Cognito user pool
aws cognito-idp describe-user-pool --user-pool-id YOUR_POOL_ID

# Test Lambda function
aws lambda invoke \
  --function-name verdexis-otp-handler \
  --payload '{"test": true}' \
  response.json
```

## ✅ **Verification Checklist**

- [ ] AWS credentials configured in `.env`
- [ ] Chosen AWS OTP method (SNS/Cognito/Lambda)
- [ ] Infrastructure deployed (if using Lambda)
- [ ] Test OTP sending via API
- [ ] Test OTP verification
- [ ] Admin panel shows AWS status as connected
- [ ] Cost monitoring alerts configured
- [ ] Production security hardening applied
- [ ] Backup fallback methods tested

This implementation provides enterprise-grade AWS OTP integration with multiple delivery methods, comprehensive admin controls, cost optimization, and production-ready infrastructure.