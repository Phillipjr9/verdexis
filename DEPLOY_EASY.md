# VERDEXIS Deployment Guide - Stress-Free Edition 🚀

## Quick Overview
- **Frontend**: AWS Amplify (static hosting)
- **Backend**: Railway.app (easiest option, no Docker knowledge needed)
- **Database**: Railway PostgreSQL (comes with backend)
- **Time needed**: 30-40 minutes

---

## Part 1: Commit Your Changes (5 minutes)

### Step 1: Save everything
```bash
git add .
git commit -m "Production ready with fixes"
git push origin main
```

That's it! Your code is now on GitHub.

---

## Part 2: Deploy Backend on Railway (15 minutes)

Railway is the easiest - no Docker, no config files, just works.

### Step 1: Sign up for Railway
1. Go to https://railway.app
2. Click "Login with GitHub"
3. Authorize Railway

### Step 2: Create a new project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your VERDEXIS repository
4. Railway will detect it's a Node.js project ✅

### Step 3: Configure the backend
1. Railway creates a service automatically
2. Click on the service card
3. Go to "Settings" tab
4. **Root Directory**: Set to `server`
5. **Start Command**: `npm run build && npm start`
6. **Watch Paths**: `server/**`

### Step 4: Add PostgreSQL database
1. Click "New" in your project
2. Select "Database" → "Add PostgreSQL"
3. Railway automatically creates `DATABASE_URL` variable ✅

### Step 5: Set environment variables
Click "Variables" tab and add these:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=<click "Generate" button or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://main.YOUR_AMPLIFY_ID.amplifyapp.com
APP_BASE_URL=https://main.YOUR_AMPLIFY_ID.amplifyapp.com
ADMIN_EMAILS=your-email@example.com
```

**Don't worry about CORS_ORIGIN yet** - we'll update it after frontend deployment.

### Step 6: Deploy
1. Click "Deploy" or just push to GitHub
2. Railway auto-deploys on every push
3. Wait 2-3 minutes for build
4. Click "Settings" → "Networking" → "Generate Domain"
5. **Copy the URL** (looks like: `verdexis-server-production.up.railway.app`)

### Step 7: Run database migrations
1. In Railway dashboard, click your backend service
2. Click "Deployments" tab
3. Click the latest deployment
4. Click "View Logs"
5. If you see "Database connection not ready", we need to migrate

**Option A: Use Railway CLI (easiest)**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration
railway run npm --prefix server run prisma:deploy
```

**Option B: Add migration to start script**
Edit `server/package.json`:
```json
"start": "npx prisma migrate deploy && node dist/index.js"
```
Then redeploy.

### Step 8: Test the backend
Open in browser: `https://your-railway-url.up.railway.app/api/health`

You should see:
```json
{
  "ok": true,
  "service": "verdexis-api",
  "database": "Ready"
}
```

✅ **Backend is live!**

---

## Part 3: Deploy Frontend on AWS Amplify (10 minutes)

### Step 1: Go to AWS Amplify
1. Go to https://console.aws.amazon.com/amplify
2. Sign in (or create AWS account - free tier is enough)
3. Click "Get Started" under "Amplify Hosting"

### Step 2: Connect your repo
1. Choose "GitHub"
2. Authorize AWS Amplify
3. Select your VERDEXIS repository
4. Select branch: `main`
5. Click "Next"

### Step 3: Configure build settings
Amplify should auto-detect `amplify.yml`. If not, paste this:

```yaml
version: 1
applications:
  - appRoot: app
    frontend:
      phases:
        preBuild:
          commands:
            - cd ..
            - npm ci
            - npm run install:all
        build:
          commands:
            - cd app
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - ../node_modules/**/*
```

Click "Next"

### Step 4: Add environment variables
Click "Advanced settings" and add:

```env
VITE_API_URL=https://your-railway-url.up.railway.app
VITE_ALPHA_VANTAGE_KEY=<optional - get free at https://www.alphavantage.co/support/#api-key>
VITE_FINNHUB_KEY=<optional - get free at https://finnhub.io/register>
VITE_WC_PROJECT_ID=<optional - for WalletConnect>
```

**Important**: Use your Railway URL from Part 2, Step 6

### Step 5: Deploy
1. Click "Save and deploy"
2. Wait 3-5 minutes (grab coffee ☕)
3. Amplify builds and deploys automatically

### Step 6: Get your Amplify URL
1. After deployment, you'll see: `https://main.d1a2b3c4d5e6f.amplifyapp.com`
2. **Copy this URL**

### Step 7: Update backend CORS
Go back to Railway:
1. Click your backend service
2. Go to "Variables"
3. Update `CORS_ORIGIN` to your Amplify URL:
   ```
   CORS_ORIGIN=https://main.YOUR_AMPLIFY_ID.amplifyapp.com
   APP_BASE_URL=https://main.YOUR_AMPLIFY_ID.amplifyapp.com
   ```
4. Railway auto-redeploys (30 seconds)

✅ **Frontend is live!**

---

## Part 4: Test Everything (5 minutes)

### Test 1: Open your site
Go to your Amplify URL - you should see the VERDEXIS homepage

### Test 2: Create an account
1. Click "Get Started" or "Sign Up"
2. Enter email, password, name, phone
3. Should successfully create account

### Test 3: Check admin access
If you set `ADMIN_EMAILS` to your email:
1. Login with that email
2. Go to `/admin` route
3. You should see admin dashboard

### Test 4: Make a test trade
1. Go to Trading page
2. Buy $10 of BTC
3. Check Wallet - balance should update
4. Check Dashboard - holdings should show

### Test 5: Check API health
Open: `https://your-railway-url.up.railway.app/api/health`

Should show `"database": "Ready"`

---

## Part 5: Optional - Custom Domain (10 minutes)

### For Frontend (Amplify)
1. In Amplify console, click "Domain management"
2. Click "Add domain"
3. Enter your domain (e.g., `verdexis.app`)
4. Follow AWS instructions to add DNS records
5. Wait 15-30 minutes for SSL certificate

### For Backend (Railway)
1. In Railway, click your backend service
2. Go to Settings → Networking
3. Click "Custom Domain"
4. Add `api.verdexis.app`
5. Add CNAME record in your DNS:
   ```
   api.verdexis.app -> your-railway-url.up.railway.app
   ```

### Update environment variables
After custom domains work:
- Amplify: `VITE_API_URL=https://api.verdexis.app`
- Railway: `CORS_ORIGIN=https://verdexis.app`

---

## Costs (Monthly Estimate)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Railway (Backend + DB) | $5 free credit | ~$5-10/month |
| AWS Amplify | 1000 build mins free | ~$1-3/month |
| **Total** | **~$5/month** | **~$10-15/month** |

Railway gives you $5 free every month, so backend is essentially free for low traffic.

---

## Troubleshooting

### "API is not responding" on frontend
**Fix**: Check Railway logs
```
Railway Dashboard → Your Service → View Logs
```
Look for errors. Common issues:
- Database not migrated: Run `railway run npm --prefix server run prisma:deploy`
- Wrong `DATABASE_URL`: Check Variables tab
- Port conflict: Ensure `PORT=4000` in variables

### "CORS blocked" errors
**Fix**: Update `CORS_ORIGIN` in Railway to match your exact Amplify URL (including `https://`)

### "Database unavailable"
**Fix**: 
1. Check Railway PostgreSQL is running (green dot)
2. Restart backend service
3. Check `DATABASE_URL` variable exists

### Build fails on Amplify
**Fix**: Check build logs
- Common issue: Node version. Add to amplify.yml:
  ```yaml
  phases:
    preBuild:
      commands:
        - nvm use 20
  ```

### "Invalid token" after deployment
**Fix**: You changed `JWT_SECRET`. All users need to re-login (expected behavior).

---

## Monitoring & Maintenance

### Railway Dashboard
- **Logs**: Real-time backend logs
- **Metrics**: CPU, memory, requests
- **Cost**: Usage and billing

### Amplify Console
- **Build history**: See all deployments
- **Logs**: Build and deploy logs
- **Monitoring**: Traffic and errors

### Useful Commands

**Redeploy backend:**
```bash
git commit --allow-empty -m "Redeploy"
git push
```

**View Railway logs:**
```bash
railway logs
```

**Check database:**
```bash
railway run npm --prefix server run prisma:generate
```

---

## Backup Strategy

### Database Backups (Railway)
Railway auto-backups PostgreSQL daily. To manually backup:
```bash
railway run npm --prefix server run db:backup
```

### Export User Data
Admin can export from `/admin/users` → Export CSV

---

## Next Steps After Deployment

1. ✅ Test all core features (signup, trading, wallet)
2. ✅ Set up custom domain (optional)
3. ✅ Configure email service for password resets (optional)
4. ✅ Add analytics (Amplify Analytics is built-in)
5. ✅ Set up monitoring (Railway Slack/Discord notifications)
6. ✅ Review Code Issues Panel for remaining improvements

---

## Quick Reference

### Your URLs
- **Frontend**: https://main.YOUR_AMPLIFY_ID.amplifyapp.com
- **Backend**: https://your-railway-url.up.railway.app
- **API Health**: https://your-railway-url.up.railway.app/api/health

### Admin Access
- **Email**: (the one in `ADMIN_EMAILS`)
- **Route**: `/admin`
- **Initial Password**: Set in `ADMIN_SEED_PASSWORD` env var (default: `ChangeMe!2026`)

### Support Links
- Railway Docs: https://docs.railway.app
- AWS Amplify Docs: https://docs.amplify.aws
- Prisma Docs: https://www.prisma.io/docs

---

## You're Done! 🎉

Your production-grade fintech platform is now live. Users can:
- ✅ Sign up and login
- ✅ Deposit and withdraw funds
- ✅ Trade crypto and stocks
- ✅ View portfolio and performance
- ✅ Set price alerts
- ✅ Use AI assistant

**No stress. Everything just works.** 🚀
