# 🚀 Copy Trading Deployment Checklist

**IMPORTANT:** Check off each item BEFORE moving to the next. Do NOT skip steps!

---

## 📋 Pre-Deployment (Local Testing)

### ☐ 1. Backup Database
```bash
cd server

# If using SQLite (local dev):
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)

# If using PostgreSQL (production):
# Take snapshot in Render dashboard → Database → Backups → Create Snapshot
```
**Verify:** Backup file exists ✅

---

### ☐ 2. Review Schema Changes
```bash
cd server
cat prisma/schema.prisma | grep -A 20 "TraderProfile"
```
**Verify:** See 3 new models: TraderProfile, CopyRelationship, CopyTrade ✅

---

### ☐ 3. Run Database Migration
```bash
cd server
npx prisma migrate dev --name add_copy_trading
```
**Expected output:**
```
✔ Generated Prisma Client
✔ The migration has been applied successfully
```
**Verify:** No errors ✅

---

### ☐ 4. Generate Prisma Client
```bash
npx prisma generate
```
**Expected output:**
```
✔ Generated Prisma Client to ./node_modules/@prisma/client
```
**Verify:** No errors ✅

---

### ☐ 5. Run Verification Script
```bash
node scripts/verify-copy-trading.mjs
```
**Expected output:**
```
✅ ALL TESTS PASSED - Safe to deploy!
```
**If FAILED:** 
- Read error messages
- Fix issues
- Re-run migration
- DO NOT PROCEED until all tests pass ✅

---

### ☐ 6. Start Server Locally
```bash
npm run dev
```
**Verify:** Server starts without errors, no TypeScript errors ✅

---

### ☐ 7. Test New API Endpoints

#### Test 1: Leaderboard (public, no auth)
```bash
curl http://localhost:4000/api/copy-trading/leaderboard
```
**Expected:** `{"traders":[]}`  ✅

#### Test 2: My Profile (requires auth)
```bash
# Get your JWT token first:
# 1. Login via frontend
# 2. Open DevTools → Application → localStorage → verdexis_auth
# 3. Copy the token

curl http://localhost:4000/api/copy-trading/my-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
**Expected:** `{"profile":{...}}` ✅

#### Test 3: Update Profile
```bash
curl -X PATCH http://localhost:4000/api/copy-trading/my-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Test Trader","isPublic":true,"allowCopying":true}'
```
**Expected:** `{"profile":{...,"displayName":"Test Trader"}}` ✅

---

### ☐ 8. Test Existing Endpoints (Critical!)

#### Test Health Check
```bash
curl http://localhost:4000/api/health
```
**Expected:** `{"ok":true,...}` ✅

#### Test Auth
```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
**Expected:** Your user data ✅

#### Test Holdings
```bash
curl http://localhost:4000/api/holdings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
**Expected:** Your holdings ✅

#### Test Wallet
```bash
curl http://localhost:4000/api/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
**Expected:** Your balances ✅

**Verify:** ALL existing endpoints still work ✅

---

### ☐ 9. Test Frontend Locally
```bash
cd app
npm run dev
```
Open http://localhost:3000 and test:
- [ ] ✅ Login works
- [ ] ✅ Dashboard loads
- [ ] ✅ Trading page works
- [ ] ✅ Wallet page works
- [ ] ✅ Settings page works
- [ ] ✅ No console errors
- [ ] ✅ No 500 errors in Network tab

---

### ☐ 10. Review Code Changes
```bash
git status
git diff
```
**Verify:**
- [ ] ✅ Only expected files changed
- [ ] ✅ No accidental deletions
- [ ] ✅ No sensitive data in code
- [ ] ✅ No commented-out code

---

## 🚢 Deployment

### ☐ 11. Commit Changes
```bash
git add .
git commit -m "feat: add copy trading backend (phase 1)

- Add TraderProfile, CopyRelationship, CopyTrade models
- Add 9 new API endpoints under /api/copy-trading
- Add follow/unfollow functionality
- Add leaderboard and trader profiles
- Safe migration with rollback plan

Testing:
- All verification tests passed
- Existing endpoints still work
- Database backup created
- Rollback plan documented"
```
**Verify:** Clean commit message ✅

---

### ☐ 12. Push to Repository
```bash
git push origin main
```
**Verify:** Push successful, no errors ✅

---

### ☐ 13. Monitor Amplify Deployment (Frontend)
1. Go to AWS Amplify console
2. Watch build logs in real-time
3. Wait for "Deployed successfully" (usually 3-5 min)

**Expected:** 
- Build: ✅ Success
- Deploy: ✅ Success
- No errors in logs ✅

---

### ☐ 14. Monitor Render Deployment (Backend)
1. Go to Render dashboard
2. Navigate to your web service
3. Click "Events" tab
4. Watch deploy logs in real-time

**Expected:**
- Build: ✅ Success
- Database migration: ✅ Applied (if auto-migrate enabled)
- Deploy: ✅ Live
- No errors in logs ✅

---

## ✅ Post-Deployment Verification

### ☐ 15. Test Production API

#### Test Health
```bash
# Replace with your actual Render URL
curl https://your-api.onrender.com/api/health
```
**Expected:** `{"ok":true,...}` ✅

#### Test Copy Trading Leaderboard
```bash
curl https://your-api.onrender.com/api/copy-trading/leaderboard
```
**Expected:** `{"traders":[]}` (empty until traders opt-in) ✅

#### Test My Profile (with prod JWT)
```bash
# Get prod JWT from frontend after login
curl https://your-api.onrender.com/api/copy-trading/my-profile \
  -H "Authorization: Bearer YOUR_PROD_JWT"
```
**Expected:** `{"profile":{...}}` ✅

---

### ☐ 16. Test Production Frontend
1. Open https://your-frontend-url.amplifyapp.com
2. Test critical paths:
   - [ ] ✅ Login
   - [ ] ✅ Dashboard
   - [ ] ✅ Trading
   - [ ] ✅ Wallet
   - [ ] ✅ Settings
3. Check browser console for errors
4. Check Network tab for failed requests

**Verify:** No errors, everything works ✅

---

### ☐ 17. Check Production Logs

#### Render Logs
1. Go to Render dashboard → Your service → Logs
2. Look for errors (filter by "error" or "ERROR")
3. Check recent requests: `/api/copy-trading/*`

**Expected:** No errors, requests logging correctly ✅

#### Database
1. Go to Render → Your database → Metrics
2. Check connection count (should be < 20)
3. Check query performance (should be < 100ms avg)

**Expected:** Normal metrics, no spikes ✅

---

### ☐ 18. Smoke Test (End-to-End)

As a logged-in user:

1. **Create Trader Profile:**
   ```bash
   curl -X PATCH https://your-api.onrender.com/api/copy-trading/my-profile \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{"displayName":"Smoke Test Trader","isPublic":true,"allowCopying":true}'
   ```
   **Expected:** 200 OK ✅

2. **View on Leaderboard:**
   ```bash
   curl https://your-api.onrender.com/api/copy-trading/leaderboard
   ```
   **Expected:** Your profile appears ✅

3. **View Profile:**
   ```bash
   curl https://your-api.onrender.com/api/copy-trading/my-profile \
     -H "Authorization: Bearer YOUR_JWT"
   ```
   **Expected:** See your profile data ✅

---

## 🎉 Success Criteria

### All checked? You're ready for Phase 2! ✅

- [x] Database backup created
- [x] Migration applied successfully
- [x] Verification tests passed
- [x] New endpoints work locally
- [x] Existing endpoints still work
- [x] Frontend tested locally
- [x] No TypeScript errors
- [x] Code committed
- [x] Deployed to production
- [x] Production endpoints tested
- [x] No errors in logs
- [x] Smoke test passed

---

## 🚨 Rollback Plan (If Needed)

### Option 1: Revert Git Commit
```bash
git revert HEAD
git push origin main
```

### Option 2: Restore Database
```bash
# Local
cp prisma/dev.db.backup-TIMESTAMP prisma/dev.db

# Production (Render)
# Dashboard → Database → Backups → Restore from snapshot
```

### Option 3: Disable Routes
Edit `server/src/app.ts`:
```typescript
// Comment this line:
// app.use('/api/copy-trading', copyTradingRoutes)
```
Commit and push.

---

## 📞 Need Help?

### Common Issues:

**Issue:** Migration fails
**Solution:** Run `npx prisma migrate resolve --rolled-back MIGRATION_NAME`

**Issue:** TypeScript errors
**Solution:** Run `npm run build` in server directory

**Issue:** Render deploy fails
**Solution:** Check logs, may need to increase memory in render.yaml

**Issue:** Endpoints return 500
**Solution:** Check Render logs for errors, may be database connection issue

---

## 📝 Notes

- **Database:** Copy trading tables isolated, won't affect existing data
- **API:** New `/api/copy-trading/*` routes won't conflict with existing
- **Frontend:** No changes yet (Phase 2), so Amplify deploy should be no-op
- **Rollback:** Safe to revert if needed, backup created

---

## ✨ What's Next (Phase 2)

Once this checklist is 100% complete:
1. Create leaderboard UI component
2. Add trader detail page
3. Build "Copy Trader" button
4. Create copy trading dashboard

**DO NOT start Phase 2 until Phase 1 is stable in production!** 🛡️

---

## ✅ Final Confirmation

I confirm that:
- [ ] All tests passed ✅
- [ ] Production is working ✅
- [ ] No errors in logs ✅
- [ ] Rollback plan tested ✅
- [ ] Ready for Phase 2 ✅

**Date completed:** _________________

**Deployed by:** _________________

**Production URL tested:** _________________

---

🎊 Congratulations! Copy Trading Phase 1 is complete! 🎊
