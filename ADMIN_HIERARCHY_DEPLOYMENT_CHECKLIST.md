# Admin Hierarchy - Production Deployment Checklist

## Pre-Deployment Phase (1 Week Before)

### Code Review & Testing
- [ ] Review all admin hierarchy changes (diff from main branch)
- [ ] Verify no breaking changes to existing auth flow
- [ ] Run full test suite: `npm run test-admin-hierarchy`
- [ ] Check for TypeScript compilation errors: `npm run build`
- [ ] Verify no console errors/warnings
- [ ] Test with multiple admins and users
- [ ] Verify auto-assignment works correctly
- [ ] Test unauthorized access is properly blocked

### Database Preparation
- [ ] Backup current production database
  ```bash
  # PostgreSQL
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
  
  # SQLite
  cp dev.db dev.db.backup
  ```
- [ ] Verify AdminHierarchy table exists
- [ ] Verify UserAdminAssignment table exists
- [ ] Check migration status: `npx prisma migrate status`
- [ ] Test migrations in staging: `npx prisma migrate deploy`
- [ ] Ensure proper indexes exist
- [ ] Test rollback procedure (if needed)

### Environment Configuration
- [ ] Prepare production environment variables file
- [ ] Set ADMIN_EMAIL to production Super Admin email
- [ ] Generate strong ADMIN_PASSWORD (min 16 chars, mixed case, numbers, symbols)
- [ ] Set JWT_SECRET to new value (32+ random chars)
- [ ] Configure DEFAULT_ADMIN_ID (optional)
- [ ] Document all env vars in secure location
- [ ] Test env vars in staging environment
- [ ] Verify DATABASE_URL is correct

### Documentation & Communication
- [ ] Prepare deployment notes for team
- [ ] Document rollback procedure
- [ ] Brief ops team on admin hierarchy feature
- [ ] Prepare user documentation (if needed)
- [ ] Set up monitoring/logging for new endpoints
- [ ] Test error logging works correctly
- [ ] Verify health check endpoint responds

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run initialization script in staging
- [ ] Run full test suite in staging
- [ ] Test with staging database
- [ ] Verify performance is acceptable
- [ ] Check for any new error patterns
- [ ] Load test with concurrent requests
- [ ] Monitor system resources (CPU, memory, disk)

---

## Deployment Day - Before Production

### Final Verifications (2 Hours Before)
- [ ] All tests passing
- [ ] Current production database backed up
- [ ] Staging deployment verified working
- [ ] Team notified of deployment window
- [ ] Deployment window scheduled
- [ ] Rollback plan reviewed with team
- [ ] No pending code changes/merges

### Environment Preparation
- [ ] Production environment variables ready
- [ ] All secrets are unique (not staging values)
- [ ] ADMIN_EMAIL is production value
- [ ] ADMIN_PASSWORD is secure and documented
- [ ] JWT_SECRET is new value
- [ ] DEFAULT_ADMIN_ID set (if using auto-assignment)

### System State Checks (30 Minutes Before)
```bash
# Verify current system
curl https://api.verdexis.com/api/health

# Check database connectivity
# Verify CPU/memory/disk space
# Verify log aggregation is working
# Verify monitoring/alerting is active
```

---

## Deployment Execution

### Step 1: Stop Current Server (1 of 5)
```bash
# Graceful shutdown
pm2 stop verdexis-api
# or
systemctl stop verdexis-api

# Verify it stopped
sleep 5 && curl https://api.verdexis.com/api/health # should fail

# ✓ Checkpoint: Server is down
```

### Step 2: Deploy New Code (2 of 5)
```bash
# Pull latest code
git pull origin main

# Install dependencies (if any new)
npm install

# Build TypeScript
npm run build

# ✓ Checkpoint: Code is updated, no build errors
```

### Step 3: Database Migration (3 of 5)
```bash
# Apply migrations (Prisma auto-detects schema changes)
npx prisma migrate deploy

# Verify migration succeeded
npx prisma migrate status

# ✓ Checkpoint: Database schema is updated
```

### Step 4: Initialize Super Admin (4 of 5)
```bash
# ONE-TIME ONLY on first deployment
# (Safe to run if already exists - it's idempotent)

ADMIN_EMAIL=admin@yourcompany.com \
ADMIN_PASSWORD=YourSecurePassword123 \
npm run create-super-admin

# Expected output:
# ✅ Super Admin user created
# ✅ Super Admin hierarchy initialized
# ✅ Initial wallet balances created

# ✓ Checkpoint: Super Admin initialized
```

### Step 5: Start Server (5 of 5)
```bash
# Start the server
pm2 start verdexis-api
# or
systemctl start verdexis-api

# Wait for startup
sleep 10

# Verify it's running
curl https://api.verdexis.com/api/health

# Expected: {"ok":true,"service":"verdexis-api",...}

# ✓ Checkpoint: Server is running and responding
```

---

## Post-Deployment Verification

### Immediate Checks (First 5 Minutes)
- [ ] Health check endpoint responding
  ```bash
  curl https://api.verdexis.com/api/health
  ```

- [ ] Login endpoint working
  ```bash
  curl -X POST https://api.verdexis.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@yourcompany.com","password":"..."}'
  ```

- [ ] No errors in server logs
  ```bash
  tail -f /var/log/verdexis-api.log | grep -i error
  ```

- [ ] Database connectivity good
  ```bash
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM User;"
  ```

### Functional Tests (5-15 Minutes)
```bash
# Export your Super Admin token
export TOKEN="<token_from_login>"

# Test admin hierarchy endpoints
npm run test-admin-hierarchy

# Expected: 📊 Test Results: 8 passed, 0 failed
```

- [ ] Super Admin can login ✓
- [ ] Create sub-admin works ✓
- [ ] List admins works ✓
- [ ] Assign users works ✓
- [ ] View users works ✓
- [ ] Unauthorized access blocked ✓

### Performance Checks (15-30 Minutes)
- [ ] Response times acceptable (<200ms)
- [ ] CPU usage normal (<50%)
- [ ] Memory usage stable
- [ ] Disk space sufficient (>10GB free)
- [ ] No database connection pool errors
- [ ] No rate limiting issues

### Integration Tests (30-60 Minutes)
- [ ] New user signup works
- [ ] New users auto-assign (if configured)
- [ ] Existing auth flows unaffected
- [ ] Admin dashboard loads
- [ ] No 401/403 errors for regular users
- [ ] User assignments visible in admin panel

### Monitoring Setup
- [ ] Error tracking enabled (Sentry/etc)
- [ ] Performance monitoring active
- [ ] Admin endpoint metrics captured
- [ ] Alerts configured for errors
- [ ] Log aggregation working
- [ ] Deployment recorded in logs

---

## If Issues Occur

### Issue: Server Won't Start
```bash
# Check logs
tail -f /var/log/verdexis-api.log

# Verify environment variables
echo $ADMIN_EMAIL $DATABASE_URL

# Try to manually start
npm run dev

# Check for port conflicts
lsof -i :3000
```

### Issue: Database Migration Failed
```bash
# Check migration status
npx prisma migrate status

# Rollback to previous version
npm run db-rollback
# or
git checkout previous-migration-file

# Reapply
npx prisma migrate deploy
```

### Issue: Auth/Permission Errors
```bash
# Check JWT_SECRET is correct
echo $JWT_SECRET

# Verify Super Admin created
npx prisma studio
# Navigate to User table, search for admin@verdexis.com

# Re-run initialization
npm run create-super-admin
```

### Issue: Tests Failing
```bash
# Run individual test
npm run test-admin-hierarchy -- --verbose

# Check API is responding
curl http://localhost:3000/api/health

# Verify database has data
npx prisma studio
```

### Rollback Procedure (If Necessary)
```bash
# 1. Stop current server
pm2 stop verdexis-api

# 2. Checkout previous code
git checkout previous-stable-tag
npm install

# 3. Rollback database (if schema changed)
npx prisma migrate resolve --rolled-back <migration_id>

# 4. Rebuild and start
npm run build
pm2 start verdexis-api

# 5. Verify
curl https://api.verdexis.com/api/health
npm run test-admin-hierarchy
```

---

## Post-Deployment Sign-Off

### Checklist for Release Manager
- [ ] All tests passed
- [ ] No error logs
- [ ] Performance acceptable
- [ ] All endpoints working
- [ ] Super Admin created
- [ ] Admin can create sub-admins
- [ ] Users can signup
- [ ] Auto-assignment working (if configured)
- [ ] Team notified of successful deployment
- [ ] Monitoring alerts are active
- [ ] Documentation updated
- [ ] Incident response team on standby (if needed)

### Documentation Updates
- [ ] Update deployment notes
- [ ] Record Super Admin credentials (securely)
- [ ] Document admin hierarchy setup completed
- [ ] Update runbook with new endpoints
- [ ] Document monitoring/alerting changes

### Communication
- [ ] Notify development team: ✅ Deployed
- [ ] Notify ops team: ✅ Monitoring active
- [ ] Notify admins: ✅ Ready to use
- [ ] Update status page (if public)
- [ ] Schedule post-deployment review

---

## Production Monitoring

### Ongoing Checks (Hourly)
```bash
# Monitor critical endpoints
watch -n 3600 'curl https://api.verdexis.com/api/health'

# Check error rates
tail /var/log/verdexis-api.log | grep ERROR | wc -l

# Monitor database
SELECT COUNT(*) FROM AdminHierarchy;
SELECT COUNT(*) FROM UserAdminAssignment;
```

### Daily Reviews
- [ ] Check error logs for patterns
- [ ] Review admin activity logs
- [ ] Verify user assignments are correct
- [ ] Performance metrics within acceptable range
- [ ] Database health/integrity

### Weekly Reviews
- [ ] Feature usage statistics
- [ ] Performance trends
- [ ] Security checks
- [ ] Cost/resource optimization
- [ ] Backup verification

### Monthly Reviews
- [ ] Feature improvements needed?
- [ ] Permission model sufficient?
- [ ] User growth impacting performance?
- [ ] Update documentation
- [ ] Security audit

---

## Success Criteria

The deployment is successful when:

✅ Server is running and responsive
✅ All health checks pass
✅ Test suite: 8/8 tests pass
✅ Super Admin created successfully
✅ Admin can create sub-admins
✅ Users auto-assign correctly (if configured)
✅ No error logs
✅ Performance metrics acceptable
✅ Monitoring alerts configured
✅ Team notified and trained
✅ Documentation updated
✅ Rollback procedure tested

---

## Post-Deployment Tasks (First Week)

- [ ] Gather team feedback
- [ ] Monitor for edge cases
- [ ] Review admin usage patterns
- [ ] Optimize if needed (indexes, caching)
- [ ] Update documentation based on real usage
- [ ] Plan next enhancements
- [ ] Schedule training for admin team
- [ ] Create admin guidelines/best practices

---

## Deployment Summary Template

**Date**: _______________
**Version**: _______________
**Deployed By**: _______________
**Reviewed By**: _______________

### What Changed
- [ ] Admin hierarchy feature added
- [ ] Auto-assignment integrated
- [ ] New API endpoints available

### Deployment Status
- Start Time: _______________
- End Time: _______________
- Total Downtime: _______________
- Status: [ ] Success [ ] Partial [ ] Rolled Back

### Verification Results
- Health Check: [ ] ✅ Pass [ ] ❌ Fail
- Auth Tests: [ ] ✅ Pass [ ] ❌ Fail
- Admin Tests: [ ] ✅ Pass [ ] ❌ Fail
- Integration: [ ] ✅ Pass [ ] ❌ Fail

### Issues Encountered
None / List below:
- _______________
- _______________

### Resolution
_______________

### Follow-up Items
- [ ] _______________________
- [ ] _______________________

**Sign-off**: _________________ Date: _______

---

This deployment checklist ensures a smooth, well-tested rollout of the admin hierarchy system to production.
