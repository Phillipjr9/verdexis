# Firebase Hybrid Setup Checklist

## ✅ Completed
- [x] Firebase Admin SDK installed (`firebase-admin`)
- [x] Firebase OTP service created (`firebaseOTP.ts`)
- [x] Setup guide created (`FIREBASE_HYBRID_SETUP.md`)

## 📋 TODO - Firebase Project Setup

### 1. Create Firebase Project
- [ ] Go to https://console.firebase.google.com
- [ ] Create new project named "verdexis"
- [ ] Enable Google Analytics (optional)
- [ ] Wait for project creation

### 2. Enable Phone Authentication
- [ ] Go to Authentication → Sign-in method
- [ ] Enable "Phone"
- [ ] Save

### 3. Get Firebase Credentials
- [ ] Go to Project Settings (gear icon)
- [ ] Click "Service Accounts"
- [ ] Click "Generate New Private Key"
- [ ] Save as `server/firebase-service-account.json`
- [ ] Add to `.gitignore`

### 4. Get Web Config
- [ ] Go to Project Settings → General
- [ ] Find "Your apps" section
- [ ] Create Web app (if not exists)
- [ ] Copy Firebase config

### 5. Update Environment Variables

#### `server/.env.local`:
```bash
FIREBASE_PROJECT_ID=verdexis
FIREBASE_API_KEY=<from-web-config>
FIREBASE_AUTH_DOMAIN=verdexis.firebaseapp.com
FIREBASE_STORAGE_BUCKET=verdexis.appspot.com
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

#### `app/.env.local`:
```bash
VITE_FIREBASE_API_KEY=<from-web-config>
VITE_FIREBASE_AUTH_DOMAIN=verdexis.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=verdexis
VITE_FIREBASE_STORAGE_BUCKET=verdexis.appspot.com
```

## 📋 TODO - Backend Integration

### 6. Update OTP Routes
- [ ] Modify `server/src/routes/otp.ts`
- [ ] Replace Twilio with Firebase OTP service
- [ ] Test phone OTP endpoint

### 7. Update Auth Routes
- [ ] Modify `server/src/routes/auth.ts`
- [ ] Add Firebase phone verification
- [ ] Link Firebase UID to Prisma user

### 8. Initialize Firebase in App
- [ ] Add Firebase init to `server/src/index.ts`
- [ ] Call `initializeFirebase()` on startup

## 📋 TODO - Frontend Integration

### 9. Install Firebase SDK
```bash
cd app
npm install firebase
```

### 10. Create Firebase Auth Service
- [ ] Create `app/src/services/firebase.ts`
- [ ] Implement phone OTP functions
- [ ] Add reCAPTCHA verification

### 11. Update Login Component
- [ ] Add phone number input
- [ ] Add OTP code input
- [ ] Integrate Firebase phone auth

### 12. Add reCAPTCHA
- [ ] Go to https://www.google.com/recaptcha/admin
- [ ] Create reCAPTCHA v3 site
- [ ] Add site key to `app/.env.local`
- [ ] Add reCAPTCHA container to login page

## 📋 TODO - Storage Setup (Optional)

### 13. Enable Cloud Storage
- [ ] Go to Storage in Firebase Console
- [ ] Click "Get Started"
- [ ] Choose location (us-central1)
- [ ] Set security rules

### 14. Update KYC Upload
- [ ] Modify KYC routes to use Firebase Storage
- [ ] Update file upload endpoints

## 📋 TODO - Deployment

### 15. Deploy Frontend
```bash
npm install -g firebase-tools
firebase login
cd app
firebase init hosting
npm run build
firebase deploy --only hosting
```

### 16. Deploy Backend (Optional)
- [ ] Keep Express.js on current hosting (Render, Railway, etc.)
- [ ] Or migrate to Cloud Functions

### 17. Set Up Monitoring
- [ ] Enable Firebase Analytics
- [ ] Set up error reporting
- [ ] Monitor authentication metrics

## 🧪 Testing

### Local Testing
```bash
# Test Firebase connection
cd server
npm run dev

# Check logs for:
# [firebase] ✅ Firebase Admin SDK initialized
```

### Phone OTP Testing
1. Use test phone numbers from Firebase Console
2. Or use real phone (Firebase free tier allows)
3. Check SMS delivery

### Frontend Testing
1. Run frontend dev server
2. Test phone login flow
3. Verify OTP code delivery

## 📊 Cost Monitoring

- [ ] Set up Firebase billing alerts
- [ ] Monitor authentication usage
- [ ] Check storage usage
- [ ] Review monthly costs

## 🚀 Production Checklist

- [ ] Firebase project in production mode
- [ ] Security rules reviewed
- [ ] Environment variables set in production
- [ ] Error logging configured
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place

## 📞 Support Resources

- Firebase Docs: https://firebase.google.com/docs
- Phone Auth: https://firebase.google.com/docs/auth/web/phone-auth
- Pricing: https://firebase.google.com/pricing
- Status: https://status.firebase.google.com

---

## Quick Start Commands

```bash
# Install dependencies
cd server
npm install firebase-admin

cd ../app
npm install firebase

# Start development
cd ../server
npm run dev

# In another terminal
cd app
npm run dev
```

---

## Estimated Time

- Firebase setup: 10 minutes
- Backend integration: 30 minutes
- Frontend integration: 45 minutes
- Testing: 20 minutes
- **Total: ~2 hours**

---

## Questions?

Refer to `FIREBASE_HYBRID_SETUP.md` for detailed instructions.
