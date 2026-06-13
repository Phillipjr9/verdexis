# Deploy Backend to AWS Amplify (Alternative to EC2)

Since you can't modify RDS security groups, use Amplify to manage the backend deployment.
Amplify handles networking and environment variables automatically.

## Step 1: Add Backend to Amplify

```bash
cd VERDEXIS
amplify init backend
```

Or via Console:
1. Go to **AWS Amplify Console**
2. Your app > **Backend environments**
3. Click **Create new environment**
4. Name: `production`
5. Click **Confirm deployment**

## Step 2: Configure Database Connection

Add the RDS connection to Amplify environment:

```bash
amplify env add
# Select existing environment or create new
# Add DATABASE_URL as secret
amplify secret add
# Name: DATABASE_URL
# Value: postgresql://postgres@database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com:5432/verdexis?sslmode=require
```

Or via Console:
1. **Amplify Console** > Your app > **Environment variables**
2. Add:
   ```
   DATABASE_URL=postgresql://postgres@database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com:5432/verdexis?sslmode=require
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=https://your-amplify-app.amplifyapp.com
   APP_BASE_URL=https://your-amplify-app.amplifyapp.com
   ALPHA_VANTAGE_KEY=your-key
   COINGECKO_API_KEY=your-key
   FINNHUB_API_KEY=your-key
   ```
3. Save

## Step 3: Configure Build Settings

Create `amplify.yml` in project root:

```yaml
version: 1

backend:
  phases:
    build:
      commands:
        - cd server
        - npm ci
        - npm run build

frontend:
  phases:
    preBuild:
      commands:
        - cd app
        - npm ci
    build:
      commands:
        - npm run build
    postBuild:
      commands:
        - echo "Frontend build complete"

cache:
  paths:
    - server/node_modules/**/*
    - app/node_modules/**/*
```

## Step 4: Setup Database (Choose One)

### Option A: Aurora Serverless (Recommended for Amplify)

Amplify can provision Aurora automatically:

```bash
amplify add database
# Select "Aurora"
# Choose serverless
# Database name: verdexis
# Username: postgres
# Generate strong password
```

Then migrate your data from the existing RDS.

### Option B: Keep Existing RDS (With Amplify proxy)

If RDS is accessible from Amplify environment:

1. Amplify will use environment variables
2. DATABASE_URL will be injected at runtime
3. Prisma migrations run automatically

## Step 5: Deploy Backend

```bash
amplify publish
```

Or via Console:
1. Connect GitHub repo to Amplify
2. **Build settings** > Add backend environment variables
3. Click **Deploy**

## Step 6: Update Frontend to Use Amplify Backend

Update `app/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})
```

Update `app/.env.local`:

```env
# During dev, use local backend
VITE_API_URL=http://localhost:4000

# Or use Amplify backend
# VITE_API_URL=https://your-amplify-backend.amplifyapp.com
```

## Step 7: Amplify Build Config in Console

1. **Amplify Console** > Your app > **Build settings**
2. Update build command:
   ```
   npm ci && npm run build
   ```
3. Set environment variables
4. Enable auto-deploy on GitHub push

## Step 8: Run Migrations on Amplify

```bash
# Via Amplify CLI
amplify function add
# Create Lambda function for migrations
# Name: PrismaMigrate
# Runtime: Node.js 20

# Or run manually after first deployment:
amplify function invoke PrismaMigrate
```

Or add to backend build process:

Create `server/amplify-build.sh`:
```bash
#!/bin/bash
set -e

echo "Installing dependencies..."
npm ci

echo "Running Prisma migrations..."
DATABASE_URL=$DATABASE_URL npm run prisma:migrate -- --skip-generate

echo "Building..."
npm run build

echo "✅ Backend ready for deployment"
```

Update `amplify.yml`:
```yaml
backend:
  phases:
    build:
      commands:
        - bash server/amplify-build.sh
```

## Advantages Over EC2

| Feature | EC2 | Amplify |
|---------|-----|---------|
| Setup Time | 30-60 min | 5-10 min |
| Networking | Manual security groups | Automatic |
| Scaling | Manual | Automatic |
| SSL/HTTPS | Manual (Let's Encrypt) | Automatic |
| Monitoring | CloudWatch setup | Built-in |
| Cost | ~$15-30/month | Pay-as-you-go (~$5-15/month) |
| Database Access | Security group issues | Environment variables only |

## If RDS Still Won't Connect

Use **Aurora Serverless** instead:
- Auto-scales to zero
- No security group issues
- Easier IAM authentication
- Better with Amplify

Or use **Amazon DocumentDB** (MongoDB):
- No networking restrictions
- Works out of box with Amplify
- Just update connection string

## Rollback to Old Database

If needed, revert DATABASE_URL environment variable:
```
DATABASE_URL=postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis
```

Then redeploy via Amplify Console.

## Troubleshooting

**Issue: Amplify can't connect to RDS**
- Solution: Check RDS security group allows Amplify VPC

**Issue: Build fails with timeout**
- Solution: Increase build timeout in Amplify settings (max 60 min)

**Issue: Database migrations not running**
- Solution: Add pre-build step to run migrations before Express starts

## Next Steps

1. Try deploying to Amplify first (no EC2 needed)
2. If connectivity issues persist, migrate to Aurora Serverless
3. Keep old Render database credentials in `.env.backup` for reference
