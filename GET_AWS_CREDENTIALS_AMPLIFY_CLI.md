# Get AWS Credentials Using Amplify CLI (Easiest Method)

Since you already have Amplify deployed, this is the easiest way to get credentials!

## Step 1: Install Amplify CLI

```bash
npm install -g @aws-amplify/cli
```

## Step 2: Configure Amplify

```bash
amplify configure
```

This will:
1. Open your browser automatically
2. Ask you to sign in to AWS
3. Guide you through creating an IAM user
4. Generate access keys automatically
5. Save them locally

## Step 3: Follow the Prompts

When you run `amplify configure`, you'll see:

```
? region: us-east-2
? user name: amplify-cli-user
? accessKeyId: [paste from browser]
? secretAccessKey: [paste from browser]
? profile name: default
```

The browser will show you the credentials - just copy and paste them!

## Step 4: Check Your Credentials

```bash
# This will show your saved credentials
cat ~/.aws/credentials
```

You'll see:
```
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Step 5: Update `server/.env.local`

Copy the credentials to your `.env.local`:

```bash
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_COGNITO_USER_POOL_ID=us-east-2_s3X852yAb
AWS_COGNITO_CLIENT_ID=5nifp6aq5ha8fee3sh7hrpp2fu
```

## Done! 🎉

That's it! The Amplify CLI handles everything for you.

---

## If Amplify CLI Doesn't Work

### Try This Instead:

```bash
# Check if you already have AWS CLI
aws --version

# If yes, configure it
aws configure

# If no, install it
# https://aws.amazon.com/cli/
```

---

## Troubleshooting

### "amplify command not found"
```bash
# Reinstall Amplify CLI
npm install -g @aws-amplify/cli

# Or use npx
npx @aws-amplify/cli configure
```

### "Browser didn't open"
```bash
# Manually go to:
# https://console.aws.amazon.com/iam/

# Then follow the manual steps in:
# GET_AWS_CREDENTIALS_DETAILED.md
```

### "I already have credentials from Amplify"
```bash
# Check your existing credentials
cat ~/.aws/credentials

# Use those in .env.local
```

---

## Quick Summary

| Method | Time | Difficulty |
|--------|------|------------|
| Amplify CLI | 2 min | Easy ✅ |
| AWS Console | 5 min | Medium |
| AWS CLI | 3 min | Medium |

**Recommended: Use Amplify CLI** (you already have it!)

---

## Next Steps

1. Run: `amplify configure`
2. Follow browser prompts
3. Copy credentials to `.env.local`
4. Test with: `npm run dev`
5. Deploy with: `amplify push`

**Let me know when you have the credentials!**
