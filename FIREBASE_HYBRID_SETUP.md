# Firebase Hybrid Deployment Setup Guide

## Overview
This guide sets up Firebase for:
- ✅ Phone OTP Authentication (free, replaces Twilio)
- ✅ Cloud Storage (file uploads)
- ✅ Frontend Hosting
- ✅ Cloud Functions (optional backend)

While keeping:
- ✅ Express.js backend
- ✅ Prisma + PostgreSQL database
- ✅ Existing API routes

---

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name: `verdexis`
4. Enable Google Analytics (optional)
5. Click "Create project"
6. Wait for project to be created

---

## Step 2: Set Up Phone Authentication

1. In Firebase Console, go to **Authentication**
2. Click **Sign-in method**
3. Enable **Phone**
4. Save

---

## Step 3: Get Firebase Credentials

### For Development (Local):

1. Go to **Project Settings** (gear icon)
2. Click **Service Accounts**
3. Click **Generate New Private Key**
4. Save as `firebase-service-account.json` in `server/` directory
5. **IMPORTANT**: Add to `.gitignore`:
   ```
   firebase-service-account.json
   ```

### For Production (Cloud Functions):

1. Firebase automatically provides credentials in Cloud Functions environment
2. No manual setup needed

---

## Step 4: Update Environment Variables

### `server/.env.local`:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=verdexis
FIREBASE_API_KEY=your-api-key-from-console
FIREBASE_AUTH_DOMAIN=verdexis.firebaseapp.com
FIREBASE_STORAGE_BUCKET=verdexis.appspot.com
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### Get these values:

1. Go to **Project Settings** → **General**
2. Scroll to "Your apps" section
3. Click on Web app (or create one)
4. Copy the config values

---

## Step 5: Install Firebase Dependencies

```bash
cd server
npm install firebase-admin
```

---

## Step 6: Update OTP Routes

Replace Twilio with Firebase in `server/src/routes/otp.ts`:

```typescript
import { firebasePhoneOTP } from '../services/firebaseOTP.js'

// In send-otp endpoint:
const result = await firebasePhoneOTP.sendOTP(phoneNumber)

// In verify-otp endpoint:
const verified = await firebasePhoneOTP.verifyOTP(idToken)
```

---

## Step 7: Update Frontend for Phone Auth

### `app/src/services/auth.ts`:

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

export async function sendPhoneOTP(phoneNumber: string) {
  const recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
    size: 'invisible',
  }, auth)

  const confirmationResult = await signInWithPhoneNumber(
    auth,
    phoneNumber,
    recaptchaVerifier
  )

  return confirmationResult
}

export async function verifyPhoneOTP(confirmationResult: any, code: string) {
  return await confirmationResult.confirm(code)
}
```

### `app/.env.local`:

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=verdexis.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=verdexis
VITE_FIREBASE_STORAGE_BUCKET=verdexis.appspot.com
```

---

## Step 8: Set Up Cloud Storage (Optional)

For KYC document uploads:

1. Go to **Storage** in Firebase Console
2. Click **Get Started**
3. Choose location (us-central1 recommended)
4. Set security rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /kyc/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
    }
    match /profiles/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## Step 9: Deploy Frontend to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting
cd app
firebase init hosting

# Build and deploy
npm run build
firebase deploy --only hosting
```

---

## Step 10: Optional - Cloud Functions

For serverless backend (replaces some Express routes):

```bash
firebase init functions
cd functions
npm install
firebase deploy --only functions
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│              Firebase Hosting + Vite Build               │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  Firebase Auth   │    │  Express.js API  │
│  (Phone OTP)     │    │  (Port 4000)     │
└──────────────────┘    └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
            ┌──────────────────┐    ┌──────────────────┐
            │   PostgreSQL     │    │ Firebase Storage │
            │   (Prisma ORM)   │    │  (File Uploads)  │
            └──────────────────┘    └──────────────────┘
```

---

## Testing Phone OTP Locally

1. Use Firebase Emulator Suite:
   ```bash
   firebase emulators:start
   ```

2. Or test with real Firebase (uses free tier):
   - Phone numbers starting with `+1` (US) work in test mode
   - Use test phone numbers from Firebase Console

---

## Cost Breakdown

| Service | Free Tier | Cost |
|---------|-----------|------|
| Authentication | 50K sign-ups/month | $0 |
| Cloud Storage | 5GB/month | $0 |
| Hosting | 10GB/month | $0 |
| Cloud Functions | 2M invocations/month | $0 |
| Firestore | 1GB storage | $0 |

**Total: $0 for most projects!**

---

## Troubleshooting

### Phone OTP not sending?
- Check Firebase Console → Authentication → Phone
- Verify phone number format (E.164: +1234567890)
- Check quota limits

### Firebase credentials not loading?
- Ensure `firebase-service-account.json` exists in `server/`
- Check `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env.local`
- Verify file permissions

### Frontend can't connect to Firebase?
- Check `VITE_FIREBASE_*` variables in `app/.env.local`
- Ensure Firebase project ID matches
- Check CORS settings in Firebase Console

---

## Next Steps

1. ✅ Create Firebase project
2. ✅ Enable Phone Authentication
3. ✅ Download service account key
4. ✅ Update `.env.local` files
5. ✅ Install `firebase-admin`
6. ✅ Update OTP routes
7. ✅ Test phone OTP
8. ✅ Deploy to Firebase Hosting
9. ✅ Set up Cloud Storage (optional)
10. ✅ Monitor usage in Firebase Console

---

## Support

- Firebase Docs: https://firebase.google.com/docs
- Phone Auth: https://firebase.google.com/docs/auth/web/phone-auth
- Pricing: https://firebase.google.com/pricing
