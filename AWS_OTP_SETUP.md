# AWS OTP Infrastructure Setup

## Prerequisites
1. AWS CLI installed and configured
2. AWS account with appropriate permissions
3. Node.js and npm installed

## Setup Options

### Option 1: AWS SNS (Simple SMS) - Recommended for Basic OTP

```bash
# 1. Configure AWS CLI
aws configure

# 2. Set environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key  
export AWS_REGION=us-east-1

# 3. Test SNS SMS capability
aws sns publish \
  --phone-number "+1234567890" \
  --message "Test SMS from Verdexis" \
  --message-attributes '{"AWS.SNS.SMS.SenderID":{"DataType":"String","StringValue":"Verdexis"}}'
```

**Environment Variables:**
```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### Option 2: AWS Cognito (Managed Auth) - Recommended for Full Auth

```bash
# 1. Create Cognito User Pool
aws cognito-idp create-user-pool \
  --pool-name "verdexis-users" \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --mfa-configuration "ON" \
  --sms-configuration "SnsCallerArn=arn:aws:iam::ACCOUNT:role/service-role/CognitoSNSRole,ExternalId=verdexis-cognito" \
  --sms-authentication-message "Your Verdexis verification code is {####}"

# 2. Create App Client
aws cognito-idp create-user-pool-client \
  --user-pool-id "us-east-1_xxxxxxxxx" \
  --client-name "verdexis-web" \
  --explicit-auth-flows "ALLOW_USER_SRP_AUTH" "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" "ALLOW_CUSTOM_AUTH"
```

**Environment Variables:**
```bash
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=your-client-id
AWS_COGNITO_CLIENT_SECRET=your-client-secret
```

### Option 3: AWS Lambda (Serverless) - Recommended for Advanced Logic

```bash
# 1. Create DynamoDB table for OTP storage
aws dynamodb create-table \
  --table-name verdexis-otp-codes \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# 2. Enable TTL for automatic cleanup
aws dynamodb update-time-to-live \
  --table-name verdexis-otp-codes \
  --time-to-live-specification Enabled=true,AttributeName=expiresAt

# 3. Package Lambda function
cd server/aws-lambda
zip -r otp-handler.zip otp-handler.ts package.json

# 4. Create Lambda function
aws lambda create-function \
  --function-name verdexis-otp-handler \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler otp-handler.handler \
  --zip-file fileb://otp-handler.zip \
  --timeout 30 \
  --memory-size 256

# 5. Add API Gateway trigger
aws apigatewayv2 create-api \
  --name verdexis-otp-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:us-east-1:ACCOUNT:function:verdexis-otp-handler
```

**Environment Variables:**
```bash
AWS_LAMBDA_OTP_FUNCTION=verdexis-otp-handler
AWS_DYNAMODB_OTP_TABLE=verdexis-otp-codes
```

## CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Verdexis OTP Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]

Resources:
  # DynamoDB table for OTP storage
  OTPTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub 'verdexis-otp-codes-${Environment}'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE
      TimeToLiveSpecification:
        AttributeName: expiresAt
        Enabled: true
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true

  # IAM role for Lambda
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: DynamoDBAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:PutItem
                  - dynamodb:GetItem
                  - dynamodb:Query
                  - dynamodb:UpdateItem
                Resource: !GetAtt OTPTable.Arn
        - PolicyName: SNSAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - sns:Publish
                Resource: '*'

  # Lambda function
  OTPHandlerFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub 'verdexis-otp-handler-${Environment}'
      Runtime: nodejs18.x
      Handler: otp-handler.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        ZipFile: |
          // Placeholder - upload actual code
          exports.handler = async (event) => {
            return { statusCode: 200, body: JSON.stringify({ message: 'OTP handler ready' }) }
          }
      Environment:
        Variables:
          OTP_TABLE_NAME: !Ref OTPTable
          AWS_REGION: !Ref AWS::Region

  # API Gateway
  OTPApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: !Sub 'verdexis-otp-api-${Environment}'
      ProtocolType: HTTP
      Target: !GetAtt OTPHandlerFunction.Arn

  # Lambda permission for API Gateway
  ApiGatewayInvokePermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref OTPHandlerFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub '${OTPApi}/*'

  # Cognito User Pool
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub 'verdexis-users-${Environment}'
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: false
      MfaConfiguration: 'ON'
      SmsConfiguration:
        SnsCallerArn: !GetAtt CognitoSNSRole.Arn
        ExternalId: !Sub 'verdexis-cognito-${Environment}'
      SmsAuthenticationMessage: 'Your Verdexis verification code is {####}'

  # Cognito User Pool Client
  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      UserPoolId: !Ref UserPool
      ClientName: !Sub 'verdexis-web-${Environment}'
      ExplicitAuthFlows:
        - ALLOW_USER_SRP_AUTH
        - ALLOW_USER_PASSWORD_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
        - ALLOW_CUSTOM_AUTH

  # IAM role for Cognito SNS
  CognitoSNSRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: cognito-idp.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: CognitoSNSPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - sns:Publish
                Resource: '*'

Outputs:
  UserPoolId:
    Description: 'Cognito User Pool ID'
    Value: !Ref UserPool
    Export:
      Name: !Sub '${AWS::StackName}-UserPoolId'

  UserPoolClientId:
    Description: 'Cognito User Pool Client ID'
    Value: !Ref UserPoolClient
    Export:
      Name: !Sub '${AWS::StackName}-UserPoolClientId'

  OTPApiUrl:
    Description: 'OTP API Gateway URL'
    Value: !Sub 'https://${OTPApi}.execute-api.${AWS::Region}.amazonaws.com'
    Export:
      Name: !Sub '${AWS::StackName}-OTPApiUrl'

  DynamoDBTableName:
    Description: 'DynamoDB Table Name'
    Value: !Ref OTPTable
    Export:
      Name: !Sub '${AWS::StackName}-OTPTableName'
```

## Deployment Commands

```bash
# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file aws-infrastructure.yml \
  --stack-name verdexis-otp-infrastructure \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name verdexis-otp-infrastructure \
  --query 'Stacks[0].Outputs'

# Update Lambda function code
aws lambda update-function-code \
  --function-name verdexis-otp-handler-production \
  --zip-file fileb://otp-handler.zip
```

## Cost Estimates

**AWS SNS SMS Pricing:**
- US/Canada: $0.00645 per SMS
- Europe: $0.03-0.08 per SMS  
- Global: $0.10+ per SMS

**AWS Lambda Pricing:**
- Free tier: 1M requests/month
- $0.20 per 1M requests after
- $0.0000166667 per GB-second

**AWS Cognito Pricing:**
- Free tier: 50,000 MAUs
- $0.0055 per MAU after

**DynamoDB Pricing:**
- Free tier: 25GB storage + 25 RCU/WCU
- On-demand: $0.25 per million reads, $1.25 per million writes

## Security Best Practices

1. **IAM Roles:** Use least-privilege access
2. **Encryption:** Enable encryption at rest and in transit
3. **Rate Limiting:** Implement API throttling
4. **Monitoring:** Set up CloudWatch alarms
5. **Secrets:** Use AWS Secrets Manager for sensitive data

## Monitoring Setup

```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "Verdexis-OTP-Errors" \
  --alarm-description "Monitor OTP Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=verdexis-otp-handler-production
```

This setup provides enterprise-grade AWS OTP infrastructure with multiple deployment options, comprehensive monitoring, and production-ready security.