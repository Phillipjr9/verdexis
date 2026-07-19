# QUICK REFERENCE - DEPLOYMENT COMMANDS

## Pre-Deployment Verification

### 1. Verify All Fixes
```bash
# Check analytics.ts for correct service case
grep -n "analyticsService\." server/src/routes/analytics.ts

# Check app.ts for analytics route registration
grep -n "analyticsRoutes" server/src/app.ts

# Check wallet.ts for currency validation
grep -n "currency: z.string().min(1)" server/src/routes/wallet.ts

# Check wallet.ts for bonus lock on swap
grep -n "bonusLocked" server/src/routes/wallet.ts
```

### 2. Build & Test
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests (if available)
npm test

# Check for TypeScript errors
npx tsc --noEmit
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Set required variables
export DATABASE_URL="postgresql://user:password@host:port/dbname"
export JWT_SECRET="your-secret-key"
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"
export ADMIN_EMAILS="admin@example.com"
export CORS_ORIGIN="http://localhost:3000,https://yourdomain.com"
export APP_BASE_URL="https://yourdomain.com"
```

---

## Staging Deployment

### 1. Deploy to Staging
```bash
# Build for production
npm run build

# Start server
npm start

# Or use PM2 for process management
pm2 start dist/index.js --name "verdexis-api"
```

### 2. Verify Staging Deployment
```bash
# Check health endpoint
curl http://staging-api.yourdomain.com/api/health

# Expected response:
# {
#   "ok": true,
#   "service": "verdexis-api",
#   "version": "0.1.0",
#   "env": "production",
#   "database": "Connected"
# }
```

### 3. Test Key Endpoints
```bash
# Test analytics endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://staging-api.yourdomain.com/api/analytics/users/metrics

# Test wallet endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://staging-api.yourdomain.com/api/wallet

# Test KYC endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://staging-api.yourdomain.com/api/kyc/status
```

---

## Production Deployment

### 1. Pre-Production Checklist
```bash
# Verify all environment variables
env | grep -E "DATABASE_URL|JWT_SECRET|SMTP|ADMIN_EMAILS|CORS_ORIGIN"

# Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Run migrations
npx prisma migrate deploy

# Verify migrations
npx prisma migrate status
```

### 2. Deploy to Production
```bash
# Build for production
npm run build

# Start with PM2
pm2 start dist/index.js --name "verdexis-api" --instances max

# Or use Docker
docker build -t verdexis-api:latest .
docker run -d --name verdexis-api \
  -e DATABASE_URL="$DATABASE_URL" \
  -e JWT_SECRET="$JWT_SECRET" \
  -p 3000:3000 \
  verdexis-api:latest
```

### 3. Post-Deployment Verification
```bash
# Check health
curl https://api.yourdomain.com/api/health

# Check logs
pm2 logs verdexis-api

# Monitor performance
pm2 monit

# Check database connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.yourdomain.com/api/admin/stats
```

---

## Monitoring & Troubleshooting

### 1. View Logs
```bash
# Real-time logs
pm2 logs verdexis-api

# Last 100 lines
pm2 logs verdexis-api --lines 100

# Save logs to file
pm2 logs verdexis-api > logs.txt
```

### 2. Check Database Connection
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"
```

### 3. Monitor Performance
```bash
# CPU and Memory usage
pm2 monit

# Process status
pm2 status

# Restart if needed
pm2 restart verdexis-api
```

### 4. Common Issues & Fixes

#### Issue: Database Connection Failed
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Verify credentials
# Format: postgresql://user:password@host:port/dbname
```

#### Issue: JWT_SECRET Not Set
```bash
# Generate a secure secret
openssl rand -base64 32

# Set environment variable
export JWT_SECRET="your-generated-secret"
```

#### Issue: Email Not Sending
```bash
# Check SMTP configuration
echo "SMTP_HOST: $SMTP_HOST"
echo "SMTP_PORT: $SMTP_PORT"
echo "SMTP_USER: $SMTP_USER"

# Test SMTP connection
telnet $SMTP_HOST $SMTP_PORT
```

#### Issue: High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart process
pm2 restart verdexis-api

# Check for memory leaks
node --inspect dist/index.js
```

---

## Rollback Procedure

### 1. If Deployment Fails
```bash
# Stop current process
pm2 stop verdexis-api

# Restore previous version
git checkout HEAD~1

# Rebuild
npm run build

# Restart
pm2 start dist/index.js --name "verdexis-api"
```

### 2. If Database Migration Fails
```bash
# Rollback migration
npx prisma migrate resolve --rolled-back <migration_name>

# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# Verify
npx prisma migrate status
```

---

## Performance Optimization

### 1. Enable Caching
```bash
# Add Redis for caching
npm install redis

# Configure in environment
export REDIS_URL="redis://localhost:6379"
```

### 2. Database Optimization
```bash
# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE id = 'user-id';

# Create indexes if needed
CREATE INDEX idx_user_email ON users(email);
```

### 3. Monitor Response Times
```bash
# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

---

## Security Hardening

### 1. Update Dependencies
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update packages
npm update
```

### 2. Enable HTTPS
```bash
# Generate SSL certificate
certbot certonly --standalone -d api.yourdomain.com

# Configure in environment
export SSL_CERT_PATH="/etc/letsencrypt/live/api.yourdomain.com/fullchain.pem"
export SSL_KEY_PATH="/etc/letsencrypt/live/api.yourdomain.com/privkey.pem"
```

### 3. Set Security Headers
```bash
# Already configured in app.ts with helmet
# Verify headers are set
curl -I https://api.yourdomain.com/api/health
```

---

## Backup & Recovery

### 1. Database Backup
```bash
# Full backup
pg_dump $DATABASE_URL > backup-full-$(date +%Y%m%d-%H%M%S).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup-full-$(date +%Y%m%d-%H%M%S).sql.gz

# Scheduled backup (cron)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/backup-$(date +\%Y\%m\%d-\%H\%M\%S).sql.gz
```

### 2. Database Restore
```bash
# Restore from backup
psql $DATABASE_URL < backup-full-YYYYMMDD-HHMMSS.sql

# Restore from compressed backup
gunzip -c backup-full-YYYYMMDD-HHMMSS.sql.gz | psql $DATABASE_URL
```

---

## Useful Commands

### Process Management
```bash
# Start
pm2 start dist/index.js --name "verdexis-api"

# Stop
pm2 stop verdexis-api

# Restart
pm2 restart verdexis-api

# Delete
pm2 delete verdexis-api

# List all processes
pm2 list

# Save process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

### Database Management
```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d table_name

# Run query
SELECT * FROM users LIMIT 10;

# Exit
\q
```

### Environment Management
```bash
# Show all environment variables
env | sort

# Show specific variable
echo $DATABASE_URL

# Set temporary variable
export VAR_NAME="value"

# Set permanent variable (add to ~/.bashrc or ~/.zshrc)
echo 'export VAR_NAME="value"' >> ~/.bashrc
```

---

## Emergency Contacts

- **Database Issues:** Check PostgreSQL logs
- **Email Issues:** Check SMTP configuration
- **Authentication Issues:** Check JWT_SECRET
- **Performance Issues:** Check PM2 monitoring
- **Security Issues:** Check audit logs

---

## Documentation Links

- API Documentation: `/docs` (OpenAPI/Swagger)
- Database Schema: `server/prisma/schema.prisma`
- Environment Variables: `.env.example`
- Deployment Guide: `DEPLOYMENT_CHECKLIST.md`
- Issue Report: `CRITICAL_ISSUES_REPORT.md`

---

**Last Updated:** Current Session
**Status:** Ready for Deployment ✅
