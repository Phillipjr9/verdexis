# Deploy VERDEXIS Backend to AWS Amplify

Since you can't reach RDS locally, deploy the backend directly to Amplify.
Amplify is in the same AWS environment and can reach RDS automatically.

## Step 1: Connect GitHub to Amplify

1. Go to **AWS Amplify Console**
2. Your app > **Backend environments** or **All apps**
3. If not already connected:
   - Click **Create app**
   - Choose **GitHub**
   - Authorize Amplify access to your repo
   - Select repository and branch

## Step 2: Create Backend Environment

1. **Backend environments** tab
2. Click **Create new environment**
3. Name: `production`
4. Click **Confirm deployment**

Wait for environment to be ready.

## Step 3: Add Environment Variables

1. **Backend environments** > Your environment
2. **Environment variables** section
3. Click **Add variable**

Add all these:
```
DATABASE_URL=postgresql://postgres:Vj9CReGYObvY5QeYN_uyg)5)78!r@database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com:5432/verdexis?schema=public&sslmode=require
JWT_SECRET=7f3a9b2c8e4d1f6a5b9c3e7d2f8a4b6c1e9d3f7a2b8c4e6d1f9a3b7c2e8d4f6a
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-amplify-app.amplifyapp.com
APP_BASE_URL=https://your-amplify-app.amplifyapp.com
NODE_ENV=production
PORT=4000
ADMIN_EMAILS=admin@verdexis.local
ALPHA_VANTAGE_KEY=IPRVXMNT7YEMGEP9
COINGECKO_API_KEY=CG-vuPc8pXAXE62yn8rLawJATzP
COINGECKO_API_TIER=demo
FINNHUB_API_KEY=d7tiv8pr01qugn0api60d7tiv8pr01qugn0api6g
TWELVE_DATA_API_KEY=52bbe6df28a14b2b9bd2bb320db0bc3e
ALERT_POLL_ENABLED=true
ALERT_POLL_INTERVAL_MS=60000
```

4. Click **Save**

## Step 4: Configure Build Settings

Create/update `amplify.yml` in root directory:

```yaml
version: 1

applications:
  - appRoot: app
    env:
      variables:
        CI: true
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  
  - appRoot: server
    backend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
            - npm run prisma:migrate -- --skip-generate
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

## Step 5: Push to GitHub

```bash
git add .
git commit -m "feat: deploy to amplify with rds backend"
git push origin main
```

Amplify will automatically detect the push and start building.

## Step 6: Monitor Build

1. **Amplify Console** > Your app > **Deployments**
2. Watch the build progress
3. Should complete in 3-5 minutes

If build fails:
- Check **Build logs** tab for errors
- Common issues:
  - Prisma migration timeout (increase timeout in amplify.yml)
  - Missing environment variables (double-check they're all set)
  - Node version mismatch (should use 18+ automatically)

## Step 7: Get Backend API URL

Once deployed:

1. **Amplify Console** > Your app > **Backends**
2. Click your environment
3. Look for the **API endpoint** (something like `https://xxxxx.amplifyapp.com/api`)

Or check the deployment URL - it's the domain + `/api`

## Step 8: Update Frontend to Use Backend

In `app/.env.local`:
```env
VITE_API_URL=https://xxxxx.amplifyapp.com
```

Or update `app/vite.config.ts` proxy:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'https://your-backend-url.amplifyapp.com',
      changeOrigin: true
    }
  }
}
```

## Step 9: Verify Connection

Test the connection:
```bash
curl https://your-backend-url.amplifyapp.com/api/health
```

Should return: `{"status":"ok"}`

## Step 10: Update CORS in Backend

Update `.env` CORS_ORIGIN to match your frontend domain:
```env
CORS_ORIGIN=https://your-frontend-domain.amplifyapp.com,https://your-backend-domain.amplifyapp.com
```

Push changes:
```bash
git push origin main
```

## Troubleshooting

**Build fails with "Can't reach database"**
- Amplify needs to be in the same VPC as RDS
- Contact AWS support to verify VPC setup
- Or migrate to Aurora Serverless (easier networking)

**Prisma migration timeout**
- Increase timeout in amplify.yml:
  ```yaml
  build:
    commands:
      - npm run prisma:migrate -- --skip-generate 2>&1 | tee /tmp/migration.log
    timeout: 900  # 15 minutes
  ```

**API returns 502 Bad Gateway**
- Check that backend is running: `npm run dev` locally first
- Check environment variables are set correctly
- Check DATABASE_URL is accessible from Amplify environment

**Frontend can't connect to backend**
- Verify CORS_ORIGIN includes frontend domain
- Check VITE_API_URL matches actual backend URL
- Test with: `curl -i https://backend-url.amplifyapp.com/api/health`

## Rollback

If you need to go back to local development:
1. Update `.env` back to localhost database
2. Run `npm run dev` locally
3. Push to GitHub (Amplify will redeploy)

Your old Render credentials are saved in `.env.backup`.

## Next Steps

1. Create/update `amplify.yml`
2. Push to GitHub
3. Watch Amplify build and deploy
4. Get API URL from Amplify Console
5. Test `/api/health` endpoint
6. Update frontend to use new backend URL
