# AWS Amplify Deployment Guide

This guide covers how to deploy Verdexis to AWS Amplify.

## Prerequisites

1. **AWS Account**: You need an AWS account
2. **AWS CLI**: Install and configure AWS CLI
3. **Docker**: Install Docker for building the backend image

## Deployment Options

### Option 1: Using Amplify with Built-in Backend (Recommended for Simple APIs)

For a simpler setup, you can use Amplify's built-in backend support:

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Log into AWS Console → Amplify**

3. **Create new app**:
   - Connect your repository
   - Select theBranch (e.g., main)
   - Build settings: Leave as "Use default build settings" - Amplify will detect amplify.yml

4. **Configure Environment Variables**:
   Add the following in Amplify console:
   - `DATABASE_URL`: Your PostgreSQL/MySQL connection string
   - `JWT_SECRET`: A secure random string (min 16 chars)
   - `CORS_ORIGIN`: Your frontend URL
   - `NODE_ENV`: production
   - `PORT`: 4000

5. **Deploy**: Save and deploy

### Option 2: Using Amplify with Custom Container (Recommended for Express)

For full control over the backend:

1. **Create a Docker image repository in ECR**:
   ```bash
   # Get login password
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

   # Create ECR repo
   aws ecr create-repository --repository-name verdexis-backend --region us-east-1
   ```

2. **Build and push Docker image**:
   ```bash
   cd server

   # Build the image
   docker build -t verdexis-backend:latest .

   # Tag for ECR
   docker tag verdexis-backend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/verdexis-backend:latest

   # Push to ECR
   docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/verdexis-backend:latest
   ```

3. **Create Amplify App** (without repo connection):

4. **Add Backend**:
   - Choose "Deploy and run container"
   - Enter your ECR image URI
   - Set the start command: `node dist/index.js`
   - Add port mapping: `4000:4000`

5. **Environment Variables**: Configure the same as Option 1

### Option 3: Using Amplify CLI

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
cd verdexis
amplify init

# Add API
amplify add api

# Push
amplify push
```

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for JWT signing (min 16 chars) | `your-secure-secret-key` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `https://yourapp.amplifyapp.com` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port (default 4000) | `4000` |
| `ALERT_POLL_ENABLED` | Enable background pollers | `false` |
| `KEEP_ALIVE_ENABLED` | Keep server awake | `true` |

## Optional API Keys

| Variable | Description |
|----------|-------------|
| `ALPHA_VANTAGE_KEY` | Alpha Vantage API key for stock prices |
| `COINGECKO_API_KEY` | CoinGecko API key for crypto prices |
| `FINNHUB_API_KEY` | Finnhub API key for news |
| `TWELVE_DATA_API_KEY` | Twelve Data API for quotes |
| `NEWS_API_KEY` | NewsAPI.org key |

## Database Setup

Since Amplify doesn't provide a managed database, you have options:

1. **AWS RDS**: Create a PostgreSQL instance in RDS
2. **Aurora Serverless**: For auto-scaling database
3. **Neon**: Free tier PostgreSQL (neon.tech)
4. **Supabase**: Open source Firebase alternative

Example RDS connection:
```
postgresql://username:password@cluster-name.cluster-abc.us-east-1.rds.amazonaws.com:5432/databasename
```

## Health Check

After deployment, verify with:
```
GET https://your-endpoint.amplifyapp.com/api/health
```

Expected response:
```json
{
  "ok": true,
  "service": "verdexis-api",
  "version": "0.1.0"
}
```

## Troubleshooting

### Cold Start Issues
The Express server may take time to respond to first request. Consider:
- Setting `KEEP_ALIVE_ENABLED=true` in environment
- Using a keep-alive ping service (e.g., cron-job.org)

### Database Connection
Ensure your RDS/Aurora is in the same VPC or has proper security groups:
- Open port 5432 for PostgreSQL
- Allow inbound traffic from Amplify's IP ranges

### CORS Issues
If frontend can't reach API, verify:
- `CORS_ORIGIN` includes your Amplify frontend URL
- No conflicting redirects

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│              AWS Amplify                    │
│  ┌─────────────┐   ┌───────────────────┐   │
│  │   Frontend  │   │   Backend (Expr)   │   │
│  │   (SPA)     │   │   (Container/     │   │
│  │             │   │    Lambda)        │   │
│  └─────────────┘   └───────────────────┘   │
│         │                  │              │
└─────────┼──────────────────┼──────────────┘
          │                  │
          │        ┌─────────┴─────────┐
          │        │                   │
          ▼        ▼                   ▼
     CloudFront   RDS / Aurora     API Keys
     (CDN)       (PostgreSQL)      (Ext)
```

## Migration from Vercel

Key differences:
1. **No built-in serverless**: Use containers or Lambda
2. **No automatic API route handling**: Express handles all routes
3. **Database is separate**: Set up RDS or external DB
4. **Environment variables**: Set in Amplify console

## Files Modified

- `amplify.yml` - Build configuration
- `server/src/lambda.ts` - Lambda handler (optional)
- `server/src/aws-serverless-express.d.ts` - Type declarations
- `server/package.json` - Added aws-serverless-express
- `server/Dockerfile` - Container definition
