# Vercel Deployment Guide

## Prerequisites

- GitHub account with the repo pushed
- Vercel account (free tier works)
- PostgreSQL database (see "Database Setup" below)

## Step 1: Connect Repo to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Select **Import Git Repository** and choose your `verdexis` repo
4. Vercel should auto-detect the monorepo structure with `app/` and `api/`

## Step 2: Configure Project Settings

In the Vercel dashboard:

### Build & Output Settings
- **Framework Preset**: Leave blank (custom setup)
- **Build Command**: `npm run build`
- **Output Directory**: `app/dist`
- **Install Command**: `npm run install:all`

### Root Directory
- Leave as `.` (root of repo)

## Step 3: Set Environment Variables

Add these in **Settings → Environment Variables**:

```
PRISMA_DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=<generate a 32-byte random string>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-domain.vercel.app
NODE_ENV=production
VITE_API_URL=https://your-domain.vercel.app/api
```

### How to generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Database Setup

### Option A: PostgreSQL on Railway (Recommended)
1. Go to [railway.app](https://railway.app)
2. Create a new PostgreSQL plugin
3. Copy the connection string to `PRISMA_DATABASE_URL`
4. Run migrations: `npm run db:migrate` (from CLI after deployment works)

### Option B: PostgreSQL on Supabase (Free tier)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the connection string from Settings → Database
4. Add `.vercel` to Supabase IP whitelist if needed

### Option C: Managed Database on Vercel (Enterprise)
- Requires paid Vercel plan

## Step 5: Deploy

1. Click **Deploy** in Vercel dashboard
2. Wait for build to complete (~2-3 minutes)
3. Frontend will be at: `https://your-project.vercel.app`
4. API will be at: `https://your-project.vercel.app/api`

## Step 6: Initialize Database

After first deployment, run migrations:

```bash
# SSH into Vercel (or run locally with prod DB):
npx prisma migrate deploy

# Or use Vercel Functions to run once-off migrations
```

Alternative: Use a Vercel Function to auto-migrate on startup.

## Step 7: Verify Deployment

Test the API:
```bash
curl https://your-project.vercel.app/api/health
# Should return: { "status": "ok" }
```

Test the frontend:
```bash
https://your-project.vercel.app
# Should load the React app
```

## Troubleshooting

### Build fails: "Cannot find module 'server/dist'"
- Ensure `npm run install:all` is configured in build command
- Check that `server/` has a `dist/` output after build

### API returns 404
- Verify `api/[...path].ts` exists
- Check `vercel.json` routes section
- Ensure `PRISMA_DATABASE_URL` is set

### Database connection times out
- Check IP whitelist in PostgreSQL provider
- Verify connection string format (must include `?schema=public` for some providers)
- Ensure `prisma/schema.prisma` has correct datasource

### Environment variables not loaded
- Redeploy after adding env vars (env vars update automatically, but redeploy to be safe)
- Check that env vars are available in all builds, not just production

## Post-Deployment

### Monitor Logs
```bash
vercel logs <project-name> --follow
```

### View Real-time Logs
In Vercel dashboard → Deployments → select deployment → Functions

### Update Code
Just push to `main` branch — Vercel auto-redeploys on push

### Rollback Deployment
In Vercel dashboard → Deployments → click older deployment → click three dots → **Redeploy**

## Cost Estimate

- **Free tier**: Up to 100 GB bandwidth/month, 60 function executions/minute
- **Frontend**: Minimal (static files are cheap)
- **Backend**: ~$0.50-$2/month (depending on traffic)
- **Database**: Varies by provider (Railway free tier: $5/month PostgreSQL, Supabase free: generous limits)

## Database Backups

Set up automated backups through your PostgreSQL provider (Railway, Supabase, etc.).

## Security Checklist

- [ ] Environment variables set (JWT_SECRET, CORS_ORIGIN, DATABASE_URL)
- [ ] Database IP whitelist configured
- [ ] CORS_ORIGIN set to your domain only (not `*`)
- [ ] JWT_SECRET is random 32 bytes (not default)
- [ ] SSL enabled on database connection
- [ ] Rate limiting configured in `/api/[...path].ts` if under attack

## Next Steps

1. Test authentication flow (signup, login, logout)
2. Test trading and wallet features
3. Set up error tracking (Sentry, LogRocket)
4. Add analytics (Vercel Analytics is built-in)
5. Configure custom domain (in Vercel → Settings → Domains)
