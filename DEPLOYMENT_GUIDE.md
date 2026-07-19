# VERDEXIS — Production Deployment Guide

## Recommended Architecture

```
Frontend  →  Vercel  (or Firebase Hosting)
Backend   →  Railway
Database  →  Railway PostgreSQL  (auto-provisioned)
```

---

## Why NOT Firebase as Backend

Your backend cannot run on Firebase because:
- Express + 50 routes needs a persistent server — Firebase Functions have cold starts and a 540s max timeout
- You use PostgreSQL + Prisma (60+ models) — Firebase only has Firestore (NoSQL), every query would need a full rewrite
- You have live WebSocket price streaming — Firebase Functions don't support persistent WebSocket connections
- Background jobs (DCA poller, alert poller, deposit monitor) run continuously — Functions only run on-demand
- JWT auth with tokenVersion revocation is already working — Firebase Auth is a completely different system

Firebase Hosting for the frontend is fine. Everything else stays on Railway.

---

## Part 1 — Backend on Railway

### Step 1: Create Railway account
- Go to https://railway.app and sign up with GitHub

### Step 2: New project
- Click "New Project" → "Deploy from GitHub repo"
- Select your VERDEXIS repository
- Railway will detect the `railway.toml` config automatically

### Step 3: Add PostgreSQL
- In your Railway project, click "New" → "Database" → "PostgreSQL"
- Railway will auto-inject `DATABASE_URL` into your service

### Step 4: Set environment variables
In Railway dashboard → your service → Variables, add:

```
NODE_ENV=production
PORT=4000
JWT_SECRET=<generate a 32+ char random string>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-app.vercel.app
APP_BASE_URL=https://your-app.vercel.app
PRODUCTION_ORIGIN=https://your-app.vercel.app
ADMIN_EMAILS=your-admin@email.com
ALERT_POLL_ENABLED=true
ALERT_POLL_INTERVAL_MS=60000
KEEP_ALIVE_ENABLED=true

# Email (use Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Verdexis <your@gmail.com>

# Optional — strongly recommended
COINGECKO_API_KEY=your-demo-key
OPENAI_API_KEY=sk-...
```

### Step 5: Deploy
- Railway builds and deploys automatically on every push to main
- Check logs for: `[verdexis-api] listening on http://0.0.0.0:4000`
- Test: `GET https://your-app.up.railway.app/api/health`

### Step 6: Get your Railway URL
- Go to Settings → Networking → Generate Domain
- Copy the URL e.g. `https://verdexis-backend.up.railway.app`

---

## Part 2 — Frontend on Vercel (Recommended)

### Step 1: Import project
- Go to https://vercel.com → New Project → Import from GitHub
- Set Root Directory: `app`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### Step 2: Set environment variables
```
VITE_API_URL=https://verdexis-backend.up.railway.app
VITE_WC_PROJECT_ID=your-walletconnect-project-id
```

### Step 3: Deploy
- Vercel deploys automatically
- Copy your Vercel URL e.g. `https://verdexis.vercel.app`

### Step 4: Update Railway CORS
- Go back to Railway → Variables
- Update `CORS_ORIGIN`, `APP_BASE_URL`, `PRODUCTION_ORIGIN` to your Vercel URL

---

## Part 2 (Alternative) — Frontend on Firebase Hosting

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### Step 2: Build the frontend
```bash
cd app
npm run build
```

### Step 3: Initialize Firebase Hosting
```bash
firebase init hosting
# Select your Firebase project
# Public directory: app/dist
# Single-page app: Yes
# Don't overwrite index.html
```

### Step 4: Set VITE_API_URL before building
Create `app/.env.production.local`:
```
VITE_API_URL=https://verdexis-backend.up.railway.app
VITE_WC_PROJECT_ID=your-walletconnect-project-id
```
Then rebuild: `cd app && npm run build`

### Step 5: Deploy
```bash
firebase deploy --only hosting
```

### Step 6: Update Railway CORS
- Update `CORS_ORIGIN` to your Firebase Hosting URL e.g. `https://verdexis-abc.web.app`

---

## Part 3 — Database Migration

Railway runs `prisma migrate deploy` automatically via the `start:migrate` script.

First deploy checklist:
- [ ] Check Railway logs for `Database initialized and schema synced`
- [ ] If migration fails, open Railway shell and run:
  ```bash
  cd server && npx prisma migrate deploy
  ```

---

## Part 4 — Pre-launch Checklist

### Security
- [ ] `JWT_SECRET` is at least 32 random characters
- [ ] No `.env` files committed to git
- [ ] `NODE_ENV=production` set on Railway
- [ ] Health endpoint only returns `{ ok, service, uptimeSec, database }`
- [ ] Error responses don't leak stack traces (test with a bad POST body)

### Functionality
- [ ] `GET /api/health` returns `{ ok: true, database: "Ready" }`
- [ ] Signup and login work end-to-end
- [ ] Admin login works (check Railway logs for seed password on first boot)
- [ ] Email verification sends correctly
- [ ] KYC document upload works
- [ ] WebSocket price stream connects (open browser devtools → Network → WS)
- [ ] DCA poller starts (check Railway logs for `[dca-poller]`)
- [ ] Alert poller starts (check Railway logs for `[alert-poller]`)

### Performance
- [ ] Frontend assets have `Cache-Control: immutable` headers
- [ ] API responses compress (check `Content-Encoding: gzip` header)
- [ ] Rate limiting returns 429 after 30 rapid auth attempts

---

## Environment Variable Quick Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Auto-set by Railway | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, keep secret |
| `NODE_ENV` | ✅ | Set to `production` |
| `CORS_ORIGIN` | ✅ | Your frontend URL |
| `APP_BASE_URL` | ✅ | Your frontend URL |
| `ADMIN_EMAILS` | ✅ | Comma-separated admin emails |
| `SMTP_*` | Recommended | Email for OTP and notifications |
| `COINGECKO_API_KEY` | Recommended | Prevents rate limiting on cloud IPs |
| `OPENAI_API_KEY` | Optional | Enables LLM-powered AI chat |
| `FINNHUB_API_KEY` | Optional | Live WebSocket price feed |
