# How to Get AWS Security Credentials - Detailed Guide

## Method 1: Using IAM User (Recommended)

### Step 1: Go to IAM Console
1. Go to https://console.aws.amazon.com/iam/
2. Click **Users** (left sidebar)
3. Click **Create user**
4. Enter username: `verdexis-app`
5. Click **Next**

### Step 2: Set Permissions
1. Click **Attach policies directly**
2. Search for: `AmazonCognitoPowerUser`
3. Check the box
4. Click **Next**
5. Click **Create user**

### Step 3: Create Access Key
1. Click on the user you just created: `verdexis-app`
2. Go to **Security credentials** tab
3. Scroll down to **Access keys**
4. Click **Create access key**
5. Choose **Command Line Interface (CLI)**
6. Check "I understand..."
7. Click **Create access key**

### Step 4: Copy Credentials
You'll see:
- **Access Key ID** - Copy this
- **Secret Access Key** - Copy this

⚠️ **IMPORTANT**: This is the only time you'll see the secret key. Save it somewhere safe!

---

## Method 2: Using Root Account (Not Recommended)

### Step 1: Go to Security Credentials
1. Go to https://console.aws.amazon.com
2. Click your account name (top right)
3. Click **Security credentials**

### Step 2: Create Access Key
1. Scroll down to **Access keys**
2. Click **Create access key**
3. Choose **Command Line Interface (CLI)**
4. Check "I understand..."
5. Click **Create access key**

### Step 3: Copy Credentials
- **Access Key ID** - Copy this
- **Secret Access Key** - Copy this

---

## Troubleshooting

### "I don't see Security credentials option"

**Solution 1**: Make sure you're logged in
- Log out and log back in
- Clear browser cache

**Solution 2**: Use direct URL
- Go to: https://console.aws.amazon.com/iam/home#/security_credentials

**Solution 3**: Check account type
- You might be using an IAM user account
- Ask your AWS account owner for credentials

### "Create access key button is grayed out"

**Solution**: You need permissions
- Ask your AWS account owner to create the access key for you
- Or ask them to give you IAM permissions

### "I see 'Access Denied' error"

**Solution**: Your IAM user doesn't have permissions
- Ask your AWS account owner to add these permissions:
  - `iam:CreateAccessKey`
  - `cognito-idp:*`

---

## Step-by-Step Screenshots Description

### Screen 1: AWS Console Home
```
Top right corner:
┌─────────────────────────────┐
│ Account Name ▼              │
│ ├─ Security credentials     │ ← Click here
│ ├─ Billing                  │
│ └─ Sign out                 │
└─────────────────────────────┘
```

### Screen 2: Security Credentials Page
```
Left sidebar:
┌──────────────────────────┐
│ AWS IAM                  │
│ ├─ Users                 │
│ ├─ Groups                │
│ ├─ Roles                 │
│ └─ Security credentials  │ ← You are here
└──────────────────────────┘

Main content:
┌──────────────────────────────────────┐
│ Access keys                          │
│ ┌──────────────────────────────────┐ │
│ │ Create access key                │ │ ← Click here
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Screen 3: Create Access Key Dialog
```
┌─────────────────────────────────────┐
│ Create access key                   │
│                                     │
│ What do you need?                   │
│ ○ Command Line Interface (CLI)      │ ← Select this
│ ○ Local code                        │
│ ○ Third-party service               │
│                                     │
│ [Next] [Cancel]                     │
└─────────────────────────────────────┘
```

### Screen 4: Confirmation
```
┌─────────────────────────────────────┐
│ ☑ I understand the above risks      │
│                                     │
│ [Create access key] [Cancel]        │
└─────────────────────────────────────┘
```

### Screen 5: Success - Copy Credentials
```
┌─────────────────────────────────────┐
│ Access key created successfully     │
│                                     │
│ Access Key ID:                      │
│ AKIAIOSFODNN7EXAMPLE                │ ← Copy this
│ [Copy]                              │
│                                     │
│ Secret Access Key:                  │
│ wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE │ ← Copy this
│ [Copy]                              │
│                                     │
│ [Download .csv file]                │
│ [Done]                              │
└─────────────────────────────────────┘
```

---

## Quick Checklist

- [ ] Logged into AWS Console
- [ ] Went to Security credentials
- [ ] Clicked "Create access key"
- [ ] Selected "CLI"
- [ ] Checked "I understand..."
- [ ] Clicked "Create access key"
- [ ] Copied Access Key ID
- [ ] Copied Secret Access Key
- [ ] Saved both securely

---

## Where to Paste Credentials

### In `server/.env.local`:

```bash
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_COGNITO_USER_POOL_ID=us-east-2_s3X852yAb
AWS_COGNITO_CLIENT_ID=5nifp6aq5ha8fee3sh7hrpp2fu
```

---

## Security Tips

✅ **DO:**
- Save credentials in `.env.local` (gitignored)
- Rotate keys every 90 days
- Use IAM users (not root account)
- Enable MFA on AWS account
- Use strong passwords

❌ **DON'T:**
- Share credentials in chat
- Commit credentials to git
- Use root account credentials
- Leave credentials in code
- Share `.env.local` file

---

## If You Still Can't Find It

### Option 1: Use AWS CLI
```bash
# Install AWS CLI
# https://aws.amazon.com/cli/

# Configure credentials
aws configure

# It will ask for:
# AWS Access Key ID: [paste here]
# AWS Secret Access Key: [paste here]
# Default region: us-east-2
# Default output format: json
```

### Option 2: Ask AWS Support
- Go to AWS Console
- Click **Support** (top right)
- Click **Create case**
- Describe your issue
- AWS support will help

### Option 3: Use Amplify CLI
```bash
# If you already have Amplify set up
amplify configure

# It will open browser and guide you through
# getting credentials
```

---

## Common Issues

### Issue: "I created access key but can't find it"
**Solution**: 
1. Go to IAM → Users
2. Click your username
3. Go to "Security credentials" tab
4. Scroll to "Access keys"
5. You'll see your key there

### Issue: "Access key shows only Access Key ID, not Secret"
**Solution**:
- You can only see Secret once when created
- If you lost it, delete the key and create a new one
- Or download the CSV file when creating

### Issue: "I have multiple access keys"
**Solution**:
- Use the most recent one
- Delete old ones you don't use
- Only keep 1-2 active keys

---

## Next Steps

1. ✅ Get Access Key ID
2. ✅ Get Secret Access Key
3. ✅ Update `server/.env.local`
4. ✅ Test with `npm run dev`
5. ✅ Deploy to Amplify

**Once you have the credentials, let me know and I'll help you update the `.env.local` file!**
