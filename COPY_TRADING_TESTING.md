# Copy Trading Feature - Testing Guide

## ⚠️ IMPORTANT: Test Locally Before Deploying

Follow these steps **exactly** to avoid breaking production:

---

## Step 1: Backup Database (CRITICAL)

### Local (SQLite)
```bash
cd server
cp prisma/dev.db prisma/dev.db.backup
```

### Production (PostgreSQL on Render)
```bash
# Export via Render Dashboard:
# 1. Go to your database on Render
# 2. Click "Backups" → "Create Snapshot"
# 3. Wait for completion
```

---

## Step 2: Apply Database Migration

### Option A: Prisma Migrate (Recommended)
```bash
cd server
npx prisma migrate dev --name add_copy_trading
npx prisma generate
```

### Option B: Manual SQL (if migrate fails)
```bash
cd server
# PostgreSQL:
psql $DATABASE_URL -f prisma/copy-trading-migration.sql

# SQLite:
sqlite3 prisma/dev.db < prisma/copy-trading-migration.sql
```

---

## Step 3: Verify Database Changes

```bash
cd server
node scripts/verify-copy-trading.mjs
```

Expected output:
```
✅ ALL TESTS PASSED - Safe to deploy!
```

If you see ❌ errors:
1. Read the error message
2. Fix the issue
3. Re-run verification
4. DO NOT proceed until all tests pass

---

## Step 4: Test Backend API Locally

### Start server:
```bash
cd server
npm run dev
```

### Test endpoints with curl:

```bash
# 1. Health check
curl http://localhost:4000/api/health

# 2. Get leaderboard (no auth needed)
curl http://localhost:4000/api/copy-trading/leaderboard

# 3. Get my profile (requires auth)
curl http://localhost:4000/api/copy-trading/my-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 4. Update profile
curl -X PATCH http://localhost:4000/api/copy-trading/my-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Test Trader","isPublic":true}'
```

Expected responses:
- ✅ 200 OK with JSON data
- ❌ If you get errors, check server logs

---

## Step 5: Check Existing Features Still Work

### Critical paths to test:
1. ✅ Login still works
2. ✅ Dashboard loads
3. ✅ Trading works
4. ✅ Wallet transactions work
5. ✅ Settings page loads

```bash
# Test existing endpoints:
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl http://localhost:4000/api/holdings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl http://localhost:4000/api/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Step 6: Test Frontend (Local)

```bash
cd app
npm run dev
```

1. Open http://localhost:3000
2. Login
3. Navigate to all major pages:
   - Dashboard
   - Trading
   - Wallet
   - Settings
4. Verify no console errors
5. Check network tab for API calls

---

## Step 7: Deployment Checklist

### Before pushing to Git:

- [ ] ✅ All verification tests passed
- [ ] ✅ Backend API endpoints respond correctly
- [ ] ✅ Existing features still work
- [ ] ✅ No console errors in browser
- [ ] ✅ Database backup created
- [ ] ✅ Migration SQL reviewed

### Git commit:
```bash
git add .
git commit -m "feat: add copy trading phase 1 - backend + database"
git push origin main
```

### Monitor deployment:

**Amplify (Frontend):**
1. Go to AWS Amplify console
2. Watch build logs
3. Wait for "Deployed successfully" ✅

**Render (Backend):**
1. Go to Render dashboard
2. Watch deploy logs
3. Look for errors in logs
4. Test API: `curl https://your-api.onrender.com/api/health`

---

## Step 8: Post-Deployment Verification

### Test production API:
```bash
# Replace with your actual production URL
curl https://your-api.onrender.com/api/copy-trading/leaderboard

curl https://your-api.onrender.com/api/health
```

### Expected results:
- ✅ 200 OK responses
- ✅ Valid JSON data
- ✅ No 500 errors

---

## Step 9: Rollback Plan (If Something Breaks)

### Option A: Git Revert
```bash
git revert HEAD
git push origin main
```

### Option B: Restore Database
```bash
# Local:
cd server
cp prisma/dev.db.backup prisma/dev.db

# Production (Render):
# 1. Go to database dashboard
# 2. Click "Restore from backup"
# 3. Select snapshot from Step 1
```

### Option C: Emergency Fix
1. Check Render logs for errors
2. Fix the issue
3. Push hotfix:
```bash
git add .
git commit -m "fix: copy trading hotfix"
git push origin main
```

---

## Common Issues & Solutions

### Issue 1: Migration fails
**Error:** `P3009: migrate found failed migration`

**Solution:**
```bash
cd server
npx prisma migrate resolve --rolled-back 20250101000000_add_copy_trading
npx prisma migrate dev
```

### Issue 2: "Table already exists"
**Error:** `relation "TraderProfile" already exists`

**Solution:** Skip migration, just generate:
```bash
npx prisma generate
```

### Issue 3: TypeScript errors
**Error:** `Cannot find module './routes/copyTrading.js'`

**Solution:** Rebuild:
```bash
cd server
npm run build
```

### Issue 4: Render deploy fails
**Error:** `FATAL ERROR: Reached heap limit`

**Solution:** Increase Node memory in `render.yaml`:
```yaml
services:
  - type: web
    env: node
    envVars:
      - key: NODE_OPTIONS
        value: --max-old-space-size=2048
```

---

## Success Criteria ✅

You're ready to move to Phase 2 (frontend) when:

- [x] All verification tests pass
- [x] Backend API responds correctly
- [x] Existing features still work
- [x] No errors in production logs
- [x] Database backup exists
- [x] Can rollback if needed

---

## What's Next (Phase 2)

Once Phase 1 is verified:
1. Build frontend leaderboard component
2. Add "Copy Trader" button
3. Create copy trading dashboard
4. Add real-time copy execution

**Do NOT start Phase 2 until Phase 1 is 100% stable in production!**

---

## Need Help?

If something breaks:
1. Check server logs: Render dashboard → Logs
2. Check database: Run verify script
3. Test API manually with curl
4. Rollback if necessary
5. Fix issue in local environment first
6. Re-test before deploying again

**Remember: It's better to catch issues locally than in production!** 🛡️
