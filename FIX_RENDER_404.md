# Fix Render Backend Deployment - 404 Error

## Problem
The backend at `https://verdexis-ckgz.onrender.com` is returning 404 for `/api/passkeys/*` routes because it's running old code without the passkeys feature.

## Root Cause
Render hasn't deployed the latest commit (`9974a83`) that includes the passkeys backend.

---

## Solution Steps

### Step 1: Check Render Dashboard
1. Go to: https://dashboard.render.com/
2. Login with your credentials
3. Find the `verdexis-backend` service
4. Check the **Events** tab

**What to look for:**
- ✅ If you see "Deploy started" within the last 10 minutes → Wait for it to complete
- ❌ If no recent deploy → Continue to Step 2

### Step 2: Verify Repository Connection
1. In Render dashboard, click on `verdexis-backend`
2. Go to **Settings** tab
3. Look for **Repository** section
4. Verify it's connected to: `https://github.com/Phillipjr9/verdexis`
5. Verify branch is: `main`

**If not connected:**
- Click "Connect Repository"
- Select GitHub
- Choose `Phillipjr9/verdexis`
- Select `main` branch

### Step 3: Manual Deploy
1. In Render dashboard, on the `verdexis-backend` service page
2. Click the **"Manual Deploy"** button in top right
3. Select **"Deploy latest commit"**
4. Click **"Deploy"**

**Expected output:**
```
==> Cloning from https://github.com/Phillipjr9/verdexis...
==> Checking out commit 9974a83 in branch main
==> Running build command: cd server && npm install && npm run build
==> Installing dependencies
==> Building TypeScript
==> Starting service
```

### Step 4: Monitor Deploy Progress
Watch the **Logs** tab for:
1. ✅ `npm install` completes
2. ✅ `Prisma Client generated`
3. ✅ `TypeScript compilation successful`
4. ✅ `Server listening on port 4000`
5. ✅ `Database initialized and schema synced`

**Deploy time:** ~5-10 minutes

### Step 5: Verify Deployment
Once deploy is complete, test the endpoint:

```bash
# Test health endpoint
curl https://verdexis-ckgz.onrender.com/api/health
```

Expected response:
```json
{
  "ok": true,
  "service": "verdexis-api",
  "version": "0.1.0",
  "database": "Ready"
}
```

```bash
# Test passkeys endpoint (with valid JWT)
curl https://verdexis-ckgz.onrender.com/api/passkeys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "passkeys": []
}
```

---

## Alternative: Check Build Logs

If deploy fails, check logs for errors:

### Common Issues

**Issue 1: TypeScript Errors**
```
error TS2307: Cannot find module '@simplewebauthn/server'
```
**Fix:** Dependencies not installed. Check package-lock.json is committed.

**Issue 2: Prisma Errors**
```
Can't reach database server
```
**Fix:** Check `DATABASE_URL` environment variable in Render settings.

**Issue 3: Module Not Found**
```
Cannot find module './routes/passkeys.js'
```
**Fix:** Build didn't complete. Check `npm run build` output.

---

## Environment Variables to Check

In Render Dashboard → Settings → Environment:

Required variables:
```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres:...@database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com:5432/verdexis
JWT_SECRET=7f3a9b2c8e4d1f6a5b9c3e7d2f8a4b6c1e9d3f7a2b8c4e6d1f9a3b7c2e8d4f6a
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://main.d28t5x0lqjdtjj.amplifyapp.com
APP_BASE_URL=https://main.d28t5x0lqjdtjj.amplifyapp.com
```

---

## After Successful Deploy

### Test Frontend → Backend Connection

1. Go to: https://main.d28t5x0lqjdtjj.amplifyapp.com
2. Open DevTools (F12) → Network tab
3. Try to login with passkey
4. Check request to `/api/passkeys/auth/options`

**Expected:**
- ✅ Status: 200 OK (not 404)
- ✅ Response contains `{ "options": { "challenge": "..." } }`

### Test Full Passkey Flow

1. Login with email/password
2. Go to Settings → Security
3. Click "Add passkey"
4. Should work without 404 errors

---

## Quick Diagnostic Commands

Run these to verify backend status:

```bash
# Check if backend is responding
curl -I https://verdexis-ckgz.onrender.com/api/health

# Should return: HTTP/2 200

# Check if passkeys route exists
curl https://verdexis-ckgz.onrender.com/api/passkeys

# Should return: 401 (unauthorized) NOT 404 (not found)
```

---

## Render Dashboard Quick Links

- **Service Overview**: https://dashboard.render.com/web/verdexis-backend
- **Deploy Logs**: https://dashboard.render.com/web/verdexis-backend/deploys
- **Settings**: https://dashboard.render.com/web/verdexis-backend/settings
- **Environment**: https://dashboard.render.com/web/verdexis-backend/env

---

## Timeline

- **Now**: Backend has old code (no passkeys)
- **After manual deploy**: Backend rebuilds with new code
- **5-10 minutes**: Deploy completes
- **Immediately after**: Passkeys work end-to-end

---

## If Manual Deploy Doesn't Work

### Check Auto-Deploy Settings
1. Render Dashboard → Settings
2. Look for "Auto-Deploy" option
3. Should be: **ON** for branch `main`

### Re-connect Repository
1. Disconnect current repository
2. Connect to `https://github.com/Phillipjr9/verdexis`
3. Select `main` branch
4. Deploy should auto-trigger

### Create New Service (Last Resort)
If nothing works, create a new Render service:
1. New Web Service
2. Connect GitHub: `Phillipjr9/verdexis`
3. Use existing `render.yaml` configuration
4. Copy environment variables from old service
5. Deploy

---

## Success Indicators

You'll know it worked when:
- ✅ Render deploy log shows "Live"
- ✅ Health endpoint returns 200 OK
- ✅ Passkeys endpoint returns 401 (not 404)
- ✅ Frontend can register passkeys
- ✅ No console errors in browser

---

**Next Action**: Go to Render Dashboard and trigger "Manual Deploy" → "Deploy latest commit"

This should resolve the 404 error within 5-10 minutes! 🚀
