#!/bin/bash

# Quick AWS Cognito OTP Setup
# Run: bash quick-cognito-setup.sh

echo "🚀 Setting up AWS Cognito OTP for Verdexis..."

# Create User Pool
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name "verdexis-users" \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
  --mfa-configuration "ON" \
  --sms-authentication-message "Your Verdexis code: {####}" \
  --query 'UserPool.Id' --output text)

echo "✅ User Pool created: $POOL_ID"

# Create App Client
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" \
  --client-name "verdexis-web" \
  --explicit-auth-flows "ALLOW_USER_SRP_AUTH" "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
  --query 'UserPoolClient.ClientId' --output text)

echo "✅ App Client created: $CLIENT_ID"

# Output environment variables
echo ""
echo "📋 Add these to your .env file:"
echo "AWS_COGNITO_USER_POOL_ID=$POOL_ID"
echo "AWS_COGNITO_CLIENT_ID=$CLIENT_ID"
echo "AWS_REGION=$(aws configure get region)"