# AWS RDS Migration Guide for VERDEXIS

## Overview
Migrate from Render.com PostgreSQL to AWS RDS PostgreSQL while keeping the backend on EC2.
Old credentials backed up in `.env.backup`.

## Step 1: Create RDS PostgreSQL Instance

### Via AWS Console:
1. Go to **RDS Dashboard** → **Create Database**
2. Choose **PostgreSQL** (version 15+)
3. **Deployment options**: Single DB instance (dev/test) or Multi-AZ (production)
4. **DB Instance Class**: `db.t3.micro` (free tier eligible) or `db.t3.small` (for production)
5. **Storage**: 20GB SSD, enable autoscaling
6. **DB Instance Identifier**: `verdexis-prod`
7. **Master Username**: `verdexis_admin`
8. **Master Password**: Generate strong password (save to AWS Secrets Manager)
9. **VPC**: Default VPC or create new
10. **Security Group**: Create new, allow inbound PostgreSQL (5432) from EC2 security group
11. **Database Name**: `verdexis`
12. **Backup**: Enable, 7-day retention
13. **Enable Enhanced Monitoring**: Yes
14. **Create Database**

Wait 5-10 minutes for instance to become available.

### Via AWS CLI:
```bash
aws rds create-db-instance \
  --db-instance-identifier verdexis-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username verdexis_admin \
  --master-user-password "YOUR-STRONG-PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-name verdexis \
  --backup-retention-period 7 \
  --enable-cloudwatch-logs-exports postgresql \
  --region us-east-1
```

## Step 2: Get RDS Connection Details

Once instance is available:

```bash
aws rds describe-db-instances \
  --db-instance-identifier verdexis-prod \
  --query 'DBInstances[0].[Endpoint.Address,Endpoint.Port]' \
  --output text
```

This gives you: `verdexis-prod.xxxxx.us-east-1.rds.amazonaws.com 5432`

## Step 3: Migrate Data from Render to RDS

### Option A: Using pg_dump (Recommended - Keep all data)

**From your local machine:**

```bash
# 1. Dump old Render database
pg_dump "postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis" \
  > verdexis-backup.sql

# 2. Restore to RDS
psql "postgresql://verdexis_admin:YOUR-RDS-PASSWORD@verdexis-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis" \
  < verdexis-backup.sql
```

**Or from EC2 instance:**
```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install PostgreSQL client
sudo yum install postgresql15-client -y

# Dump and restore in one command
pg_dump "postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis" | \
  psql "postgresql://verdexis_admin:YOUR-RDS-PASSWORD@verdexis-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis"
```

### Option B: Start Fresh (Faster - Clear old data)

```bash
# RDS runs schema automatically on first connection
npm run prisma:migrate
```

## Step 4: Create RDS IAM Database Authentication (Optional but Recommended)

Generate temporary credentials instead of hardcoding password:

```bash
# Create IAM policy for RDS
aws iam create-policy --policy-name RDSConnectVerdexis \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds:us-east-1:ACCOUNT-ID:db:verdexis-prod"
    }]
  }'

# Create IAM role for EC2
aws iam create-role --role-name EC2-RDS-Verdexis \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy
aws iam attach-role-policy \
  --role-name EC2-RDS-Verdexis \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/RDSConnectVerdexis
```

Then generate token:
```bash
aws rds generate-db-auth-token \
  --hostname verdexis-prod.xxxxx.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --region us-east-1 \
  --username verdexis_admin
```

## Step 5: Update .env for RDS Connection

```env
# Previous: PostgreSQL on Render
# DATABASE_URL=postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis

# New: PostgreSQL on AWS RDS
DATABASE_URL=postgresql://verdexis_admin:YOUR-RDS-PASSWORD@verdexis-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis?schema=public
```

Update `schema.prisma` to PostgreSQL:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Step 6: Deploy Backend to EC2

### Via Amplify (If using Amplify Backend):

1. **Create Amplify App** (if not already)
   ```bash
   amplify init
   amplify hosting add
   ```

2. **Connect to GitHub repo** in Amplify Console
3. **Add environment variables** in Amplify:
   - `DATABASE_URL`: RDS connection string
   - `JWT_SECRET`: Your JWT secret
   - `CORS_ORIGIN`: Your domain

4. **Deploy**:
   ```bash
   amplify publish
   ```

### Via EC2 (Self-Managed):

1. **Launch EC2 Instance**:
   - AMI: Amazon Linux 2 or Ubuntu 22.04
   - Instance Type: t3.small (minimum for Node.js)
   - Security Group: Allow ports 80, 443, 4000 (from Amplify/your domain)

2. **SSH into EC2**:
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

3. **Install Node.js & Dependencies**:
   ```bash
   # Amazon Linux 2
   curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install nodejs -y
   
   # Ubuntu
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install nodejs -y
   ```

4. **Clone repo & setup**:
   ```bash
   git clone your-repo.git
   cd VERDEXIS/server
   npm install
   ```

5. **Create .env** on EC2:
   ```bash
   cat > .env << 'EOF'
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=postgresql://verdexis_admin:PASSWORD@verdexis-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/verdexis
   JWT_SECRET=your-secret
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=https://your-amplify-domain.amplifyapp.com
   APP_BASE_URL=https://your-amplify-domain.amplifyapp.com
   EOF
   ```

6. **Run migrations**:
   ```bash
   npm run prisma:migrate
   ```

7. **Start with PM2** (process manager):
   ```bash
   sudo npm install -g pm2
   pm2 start npm --name "verdexis-api" -- run dev
   pm2 startup
   pm2 save
   ```

8. **Setup nginx reverse proxy**:
   ```bash
   sudo yum install nginx -y
   # or: sudo apt-get install nginx -y
   ```

   Edit `/etc/nginx/nginx.conf`:
   ```nginx
   server {
       listen 80;
       server_name _;
       
       location /api {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

## Step 7: Configure Amplify Frontend to Use EC2 Backend

Update `app/vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://your-ec2-public-ip:4000',
        changeOrigin: true
      }
    }
  }
});
```

Or update `.env.local`:
```env
VITE_API_URL=https://your-ec2-domain.com
```

## Step 8: Security Best Practices

1. **Use AWS Secrets Manager** for passwords:
   ```bash
   aws secretsmanager create-secret \
     --name verdexis/rds-password \
     --secret-string "your-password"
   ```

2. **Enable RDS Encryption**:
   - At-rest: Enabled by default
   - In-transit: Use SSL/TLS

3. **Security Group Rules**:
   - RDS: Allow 5432 only from EC2 security group
   - EC2: Allow 80, 443 from CloudFront/ALB

4. **Enable RDS Enhanced Monitoring**:
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier verdexis-prod \
     --enable-cloudwatch-logs-exports postgresql \
     --apply-immediately
   ```

5. **Regular Backups**:
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier verdexis-prod \
     --db-snapshot-identifier verdexis-backup-$(date +%Y%m%d-%H%M%S)
   ```

## Step 9: Monitoring & Logging

1. **CloudWatch Metrics**: RDS automatically sends metrics
2. **Application Logs**: Configure in `server/src/index.ts`
3. **Database Logs**: Check RDS > Logs & events tab

## Rollback Plan

If needed, revert to Render:
```env
DATABASE_URL=postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis
```

Then:
```bash
npm run prisma:migrate
```

Old credentials saved in `.env.backup` for reference.

## Cost Estimates (US East 1)

| Service | Free Tier | Pay-As-You-Go |
|---------|-----------|---------------|
| RDS (t3.micro) | 12 months | $0.017/hour (~$12/month) |
| RDS Storage (20GB) | 20GB first year | $0.10/GB/month (~$2/month) |
| EC2 (t3.small) | 750 hours/month | $0.0208/hour (~$15/month) |
| Data Transfer | 100GB/month | $0.09/GB after free tier |
| **Total Estimate** | Free for 12 months | ~$30-50/month |

Use AWS Pricing Calculator: https://calculator.aws
