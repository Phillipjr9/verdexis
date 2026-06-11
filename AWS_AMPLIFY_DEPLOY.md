# AWS Amplify Deployment Guide

## Critical Issues Fixed

1. ✅ Created `amplify.yml` for monorepo build configuration
2. ✅ Removed circular dependencies from package.json files
3. ⚠️ Backend architecture conflict (see below)

## Architecture Decision Required

Your codebase has **two different backend systems**:

### Option A: Use Express + Prisma Backend (Current Implementation)
- Full-featured: Trading, wallet, portfolio, auth
- Database: PostgreSQL/SQLite via Prisma
- API: Express REST endpoints in `server/`
- **Deployment**: AWS Elastic Beanstalk, ECS, or Lambda (not Amplify Gen 2)

### Option B: Use Amplify Gen 2 Backend (Minimal - in `amplify/`)
- Simple data models: User, Transaction, Portfolio
- Database: DynamoDB (managed)
- Auth: Cognito (managed)
- API: GraphQL (auto-generated)
- **Deployment**: AWS Amplify (full-stack)

## Recommended: Deploy Frontend Only on Amplify

Since your backend is fully built with Express/Prisma, deploy as follows:

### Frontend: AWS Amplify
### Backend: AWS App Runner, Lambda, or ECS

## Steps for Frontend-Only Amplify Deployment

### 1. Update Environment Variables

Create `app/.env.production`:
```env
VITE_API_URL=https://your-backend-api-url.com/api
```

### 2. Remove Amplify Backend (Optional)

Since you're not using it:
```bash
rm -rf amplify/
rm amplify_outputs.json
```

Or keep it for future Cognito integration.

### 3. Connect to AWS Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click **New app → Host web app**
3. Connect your GitHub repo
4. Select branch: `main`

### 4. Configure Build Settings

Amplify should auto-detect `amplify.yml`. Verify:

- **App root**: `app`
- **Build command**: `npm run build`
- **Build output**: `dist`
- **Node version**: 20

### 5. Set Environment Variables in Amplify Console

Navigate to **App settings → Environment variables**:

```
VITE_API_URL=https://your-backend-url.com/api
VITE_ALPHA_VANTAGE_KEY=your_key
VITE_FINNHUB_KEY=your_key
VITE_WC_PROJECT_ID=your_walletconnect_id
```

### 6. Deploy

Click **Save and deploy**. Build takes ~3-5 minutes.

## Backend Deployment Options

### Option 1: AWS App Runner (Easiest)
```bash
# 1. Build Docker image
docker build -f server/Dockerfile -t verdexis-server .

# 2. Push to ECR
aws ecr create-repository --repository-name verdexis-server
docker tag verdexis-server:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/verdexis-server:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/verdexis-server:latest

# 3. Create App Runner service via AWS Console
# Connect to ECR, set PORT=4000, add DATABASE_URL env var
```

### Option 2: AWS Lambda + API Gateway
Use `server/src/lambda.ts` (already exists):
```bash
# Package server
cd server
npm run build
zip -r function.zip dist/ node_modules/ prisma/

# Create Lambda function via AWS Console
# Runtime: Node.js 20.x
# Handler: dist/lambda.handler
# Environment: DATABASE_URL, JWT_SECRET, etc.
```

### Option 3: AWS Elastic Beanstalk
```bash
# Install EB CLI
pip install awsebcli

# Initialize
cd server
eb init -p node.js-20 verdexis-server

# Create environment
eb create production-env

# Deploy
eb deploy
```

## Database Setup

### PostgreSQL on AWS RDS
```bash
# Create RDS PostgreSQL instance via Console
# Security Group: Allow inbound 5432 from App Runner/Lambda
# Copy endpoint URL

# Set DATABASE_URL in your backend service:
DATABASE_URL="postgresql://username:password@endpoint.rds.amazonaws.com:5432/verdexis"

# Run migrations
npm run prisma:deploy
```

## Common Amplify Build Errors

### Error: "Cannot find module '@/...'
**Fix**: Ensure `app/tsconfig.json` has path mapping and `vite.config.ts` has alias.

### Error: "Build failed - npm ci exit code 1"
**Fix**: Delete `package-lock.json` files, run `npm install` locally, commit new lockfiles.

### Error: "Module not found: three"
**Fix**: Verify all dependencies are in `app/package.json`, not root `package.json`.

### Error: "amplify.yml: Invalid YAML"
**Fix**: Check indentation (2 spaces, not tabs) in `amplify.yml`.

### Error: "Build timeout after 30 minutes"
**Fix**: Add `build:
  timeout: 45` in `amplify.yml` phases.

## Update Vite Config for Amplify

The current proxy won't work in production. Update `app/vite.config.ts`:

```typescript
export default defineConfig({
  base: '/', // Change from './'
  // ... rest of config
  server: {
    proxy: process.env.NODE_ENV === 'development' ? {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    } : undefined,
  },
});
```

## CORS Configuration

Update `server/src/index.ts` to allow Amplify domain:

```typescript
const corsOrigin = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://YOUR_AMPLIFY_APP_ID.amplifyapp.com' // Add this
];
```

## Post-Deployment Testing

1. **Frontend**: `https://main.YOUR_APP_ID.amplifyapp.com`
2. **API Health**: `https://your-backend.com/api/health`
3. **Auth Flow**: Test signup/login
4. **Trading**: Place test order
5. **Wallet**: Check balances

## Cost Estimate (AWS Free Tier)

- **Amplify Hosting**: $0.01/GB served (~$0.50-2/month)
- **App Runner**: $0.007/vCPU-hour ($5-10/month)
- **RDS PostgreSQL**: $15-25/month (db.t3.micro)
- **Total**: ~$20-40/month

## Rollback Strategy

```bash
# Via Amplify Console
# App settings → Build history → Select previous build → Redeploy
```

## Monitoring

- CloudWatch Logs: Automatic for App Runner/Lambda
- Amplify Console: Build logs, access logs
- X-Ray: Enable for distributed tracing

## Next Steps

1. ✅ Commit changes (amplify.yml, package.json fixes)
2. Push to GitHub
3. Connect repo to Amplify Console
4. Deploy backend separately (App Runner recommended)
5. Update CORS and VITE_API_URL
6. Test end-to-end

## Support

If build still fails, check:
- Amplify Console build logs (full output)
- Node version compatibility (must be 20+)
- Missing environment variables
- TypeScript compilation errors in `app/`
