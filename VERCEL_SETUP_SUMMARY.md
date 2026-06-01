# Vercel Deployment Setup Summary

## What was changed to enable Vercel deployment:

### 1. Created API Serverless Function
- **File**: `api/[...path].ts`
- **Purpose**: Accepts all API requests and routes them to the Express app
- **Type**: Vercel serverless function (Node.js runtime)

### 2. Updated Vercel Configuration
- **File**: `vercel.json`
- **Changes**:
  - Added `api/[...path].ts` as a build target using `@vercel/node`
  - Added route for `/api/*` requests to the serverless function
  - Added route for SPA fallback (all other requests go to `/index.html`)
  - Pre-configured environment variable placeholders

### 3. Modified Express Server
- **File**: `server/src/index.ts`
- **Changes**:
  - Added `export default app` to export the Express app for serverless use
  - Conditionally listen only when running directly (not when imported by Vercel)
  - Preserves local dev server functionality

### 4. Updated Root Build Configuration
- **File**: `package.json`
- **Changes**:
  - Added `@vercel/node` dependency for serverless functions
  - Ensured build command runs both `server/build` and `app/build`
  - Install command now runs `npm run install:all`

### 5. Added Vercel Ignore File
- **File**: `.vercelignore`
- **Purpose**: Prevents unnecessary files from being deployed

### 6. Updated Frontend Environment Variables
- **File**: `app/.env.example`
- **Changes**: Added documentation for production URL setup

### 7. Created Deployment Guide
- **File**: `VERCEL_DEPLOY.md`
- **Contents**: Step-by-step deployment instructions with all configuration details

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Vercel Deployment                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Frontend (Static)         API (Serverless)         │
│  app/dist/                 api/[...path].ts         │
│   └─ index.html            └─ → server/src/index.ts │
│   └─ *.js, *.css              └─ Express Routes    │
│   └─ assets/                  └─ Prisma / Database │
│                                                      │
│  Routes:                                             │
│  • /              → index.html (SPA)                │
│  • /api/*         → serverless function             │
│  • /api/health    → app.get('/api/health')         │
│  • /api/auth/*    → app.use('/api/auth', ...)      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `vercel.json` | Main Vercel configuration |
| `api/[...path].ts` | API serverless function handler |
| `server/src/index.ts` | Express app (now exportable) |
| `app/vite.config.ts` | Frontend build config (has API proxy) |
| `app/.env.example` | Frontend env var template |
| `server/.env.example` | Backend env var template |
| `.vercelignore` | Files to exclude from deployment |

---

## Next Steps

1. **Push to GitHub**: Commit and push these changes
   ```bash
   git add -A
   git commit -m "feat: add Vercel deployment configuration"
   git push origin main
   ```

2. **Create Vercel Project**: Go to https://vercel.com → Import Git repo

3. **Configure Deployment**: Follow `VERCEL_DEPLOY.md` for environment variables and database setup

4. **Test**: Deploy and verify:
   - Frontend loads: `https://your-project.vercel.app`
   - API responds: `curl https://your-project.vercel.app/api/health`

---

## Important Notes

- **Serverless Cold Starts**: First request may take 5-10 seconds. Subsequent requests are fast.
- **Database**: Must be hosted externally (PostgreSQL on Railway, Supabase, etc.)
- **Environment Variables**: Set in Vercel dashboard under Settings → Environment Variables
- **Migrations**: Run `prisma migrate deploy` after first deployment
- **Background Jobs**: Alert poller and DCA poller won't run in serverless. Consider cron jobs or external schedulers.

---

## Troubleshooting

If build fails:
```bash
# Test locally
npm run build
npm --prefix app run build
npm --prefix server run build

# Check for TypeScript errors
npm --prefix app run lint
npm --prefix server run build
```

If API 404 errors:
- Check `vercel.json` routes section
- Verify `api/[...path].ts` exists
- Review Vercel function logs in dashboard

If environment variables aren't loaded:
- Redeploy after adding env vars (Vercel may cache them)
- Check Vercel dashboard vs environment variable names (must match exactly)
