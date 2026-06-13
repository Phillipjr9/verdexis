# Aurora Serverless Solution (No VPC Changes Needed)

Since you can't modify the VPC/security groups, use **Aurora Serverless v2**.
It handles all networking automatically and works seamlessly with Amplify.

## Step 1: Create Aurora Serverless Database

**Via AWS Console:**

1. Go to **RDS Dashboard** > **Create Database**
2. **Engine**: Aurora PostgreSQL (Serverless)
3. **Engine Version**: Aurora PostgreSQL 15.2 or latest
4. **DB Instance Class**: Serverless (auto-scales)
5. **DB Cluster Identifier**: `verdexis-aurora`
6. **Master Username**: `postgres`
7. **Master Password**: Generate strong password (save it)
8. **VPC**: Default VPC
9. **Database Name**: `verdexis`
10. **Connectivity**: 
    - Public accessibility: **ON** (for dev access)
    - ✅ This way you don't need to manage security groups
11. **Backups**: 7 days retention
12. **Create Database**

Wait 5-10 minutes for creation.

**Via AWS CLI:**

```bash
aws rds create-db-cluster \
  --db-cluster-identifier verdexis-aurora \
  --engine aurora-postgresql \
  --engine-version 15.2 \
  --master-username postgres \
  --master-user-password "YourStrongPassword123!" \
  --database-name verdexis \
  --publicly-accessible \
  --storage-encrypted \
  --backup-retention-period 7 \
  --region us-east-1

aws rds create-db-instance \
  --db-instance-identifier verdexis-aurora-instance-1 \
  --db-instance-class db.serverless \
  --engine aurora-postgresql \
  --db-cluster-identifier verdexis-aurora \
  --region us-east-1
```

## Step 2: Get Aurora Endpoint

Once created:

```bash
aws rds describe-db-clusters \
  --db-cluster-identifier verdexis-aurora \
  --query 'DBClusters[0].Endpoint' \
  --region us-east-1
```

You'll get something like: `verdexis-aurora.cluster-xxxxx.us-east-1.rds.amazonaws.com`

## Step 3: Update .env

Replace the old RDS connection with Aurora:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres:YourStrongPassword123!@verdexis-aurora.cluster-xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis?schema=public
JWT_SECRET=7f3a9b2c8e4d1f6a5b9c3e7d2f8a4b6c1e9d3f7a2b8c4e6d1f9a3b7c2e8d4f6a
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-amplify-domain.amplifyapp.com
APP_BASE_URL=https://your-amplify-domain.amplifyapp.com
ADMIN_EMAILS=admin@verdexis.local
ALPHA_VANTAGE_KEY=IPRVXMNT7YEMGEP9
COINGECKO_API_KEY=CG-vuPc8pXAXE62yn8rLawJATzP
COINGECKO_API_TIER=demo
FINNHUB_API_KEY=d7tiv8pr01qugn0api60d7tiv8pr01qugn0api6g
TWELVE_DATA_API_KEY=52bbe6df28a14b2b9bd2bb320db0bc3e
ALERT_POLL_ENABLED=true
ALERT_POLL_INTERVAL_MS=60000
```

## Step 4: Migrate Data from Old RDS to Aurora

If the old RDS (database-1) is still accessible:

```bash
# Export old data
pg_dump "postgresql://postgres:OLD_PASSWORD@database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com:5432/postgres" \
  > old-rds-backup.sql

# Import to Aurora
psql "postgresql://postgres:YourStrongPassword123!@verdexis-aurora.cluster-xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis" \
  < old-rds-backup.sql
```

If old RDS isn't accessible, start fresh:

```bash
npm run prisma:migrate -- --name "aurora-initial"
```

## Step 5: Test Local Connection

```bash
npm run dev
```

The backend should now connect to Aurora without any security group changes needed.

## Step 6: Deploy to Amplify

Add Aurora connection to Amplify environment variables:

**Via Amplify Console:**
1. Your app > **Environment** (or create new)
2. **Environment variables**
3. Add:
   ```
   DATABASE_URL=postgresql://postgres:YourStrongPassword123!@verdexis-aurora.cluster-xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis?schema=public
   JWT_SECRET=your-secret
   ...other vars...
   ```
4. Save & redeploy

## Why Aurora Serverless is Better

| Feature | Old RDS | Aurora Serverless |
|---------|---------|-------------------|
| VPC Setup | Required | Not needed |
| Security Groups | Manual config | Automatic |
| Scaling | Manual | Auto (0-16 ACUs) |
| Cost | Fixed $15-30/mo | Pay-per-use (~$5-15/mo) |
| Setup Time | 30 min | 5 min |
| Public Access | Needs config | Already enabled |
| Data Migration | Easy via pg_dump | Compatible |

## Cost Estimate

- **Aurora Serverless v2**: $0.06/ACU-hour + $0.25/million requests
- **Usage estimate**: 0.5-2 ACUs during dev/light use = $20-60/month
- **Storage**: $0.10/GB/month (20GB = $2/month)
- **Total**: ~$25-65/month (can optimize down to $15/month)

## Rollback to Old Database

Your old credentials are saved in `.env.backup`:
```
OLD_DATABASE_URL=postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis
```

Just swap the DATABASE_URL back and redeploy.

## Next Steps

1. Create Aurora Serverless in AWS Console (10 min)
2. Copy endpoint to `.env`
3. Run `npm run prisma:migrate`
4. Deploy backend to Amplify
5. Update Amplify environment variables with Aurora connection

Ready to proceed?
