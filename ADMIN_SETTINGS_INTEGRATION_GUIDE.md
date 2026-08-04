# Admin Settings Verification - Integration Guide

## 🎯 Integration Steps

### Step 1: Add Component to Admin Dashboard

**File**: `app/src/pages/AdminDashboard.tsx`

```typescript
import { AdminSettingsVerification } from '../components/dashboard/AdminSettingsVerification'

// Add to dashboard layout
<div className="mt-8">
  <AdminSettingsVerification />
</div>
```

### Step 2: Register Backend Routes

**File**: `server/src/app.ts`

```typescript
import adminSettingsVerificationRouter from './routes/admin-settings-verification'

// Register routes
app.use('/api/admin', adminSettingsVerificationRouter)
```

### Step 3: Run Database Migration

```bash
# Execute migration
psql -U postgres -d verdexis -f server/prisma/migrations/admin_settings_verification.sql

# Or using Prisma
npx prisma migrate deploy
```

### Step 4: Add Middleware

**File**: `server/src/middleware/securityMiddleware.ts`

```typescript
export const verifyAdminAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!)
    const user = await db.query('SELECT * FROM users WHERE id = $1 AND role = $2', [decoded.id, 'admin'])
    
    if (user.rows.length === 0) return res.status(403).json({ error: 'Forbidden' })
    
    (req as any).user = user.rows[0]
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

### Step 5: Update Admin Dashboard Layout

**File**: `app/src/pages/AdminDashboard.tsx`

Add to the main grid:

```typescript
<div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
  <h2 className="text-lg font-semibold text-[#E5E5E5] mb-4 flex items-center gap-2">
    <Settings className="w-4 h-4 text-[#0C8B44]" />
    Settings Verification
  </h2>
  <AdminSettingsVerification />
</div>
```

## 📋 Configuration

### Environment Variables

Add to `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/verdexis
JWT_SECRET=your_jwt_secret
ADMIN_SETTINGS_LOG_RETENTION=30
```

### Database Connection

Ensure database connection is configured:

```typescript
// server/src/db.ts
import { Pool } from 'pg'

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
})
```

## 🔧 Customization

### Add Custom Setting

```typescript
// In database migration or admin panel
INSERT INTO admin_settings (key, value, type, category, modifiedBy, verified, verificationStatus)
VALUES ('custom_setting', 'value', 'string', 'general', 'system', false, 'pending')
```

### Add Custom Validation

**File**: `server/src/routes/admin-settings-verification.ts`

```typescript
async function verifySetting(setting: any): Promise<boolean> {
  switch (setting.key) {
    case 'custom_setting':
      // Add custom validation logic
      return setting.value.length > 0
    default:
      // Existing validation
      return true
  }
}
```

### Add Custom Category

```typescript
// Update type definition
type SettingCategory = 'fees' | 'wallet' | 'bank' | 'security' | 'general' | 'custom'

// Add to category icons
const categoryIcons: Record<string, React.ReactNode> = {
  custom: '🎯',
  // ... existing
}
```

## 🧪 Testing

### Test Setting Save

```bash
curl -X POST http://localhost:3000/api/admin/settings/withdrawal_fee_percent/save \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"value": "12.5"}'
```

### Test Verification

```bash
curl -X POST http://localhost:3000/api/admin/settings/<id>/verify \
  -H "Authorization: Bearer <token>"
```

### Test Batch Verification

```bash
curl -X POST http://localhost:3000/api/admin/settings/verify-all \
  -H "Authorization: Bearer <token>"
```

## 📊 Monitoring

### Check Settings Status

```sql
SELECT category, COUNT(*) as total, 
       SUM(CASE WHEN verified THEN 1 ELSE 0 END) as verified
FROM admin_settings
GROUP BY category;
```

### View Recent Changes

```sql
SELECT * FROM admin_settings_logs
ORDER BY timestamp DESC
LIMIT 20;
```

### Check Failed Verifications

```sql
SELECT * FROM admin_settings
WHERE verificationStatus = 'failed'
ORDER BY lastModified DESC;
```

## 🔐 Security Checklist

- [ ] Admin authentication required
- [ ] Sensitive values masked in UI
- [ ] All changes logged
- [ ] Failed attempts recorded
- [ ] Admin identity tracked
- [ ] Timestamps recorded
- [ ] Validation on save
- [ ] Error messages logged
- [ ] Database encrypted
- [ ] API endpoints protected

## 🚀 Deployment

### Pre-deployment

1. Run migration on staging
2. Test all settings save/verify
3. Check audit logs
4. Verify validation rules
5. Test batch operations

### Deployment

1. Run migration on production
2. Deploy backend routes
3. Deploy frontend component
4. Monitor logs
5. Verify all settings

### Post-deployment

1. Check all settings verified
2. Monitor for errors
3. Review audit logs
4. Confirm functionality
5. Document any issues

## 📈 Performance

### Optimization Tips

1. **Index Settings** - Already indexed by category and verified status
2. **Batch Operations** - Use verify-all for efficiency
3. **Log Retention** - Keep last 500 logs in memory
4. **Caching** - Cache settings in memory with TTL
5. **Pagination** - Implement for large log sets

### Query Performance

```sql
-- Check index usage
EXPLAIN ANALYZE SELECT * FROM admin_settings WHERE category = 'fees';

-- Monitor slow queries
SELECT query, calls, mean_time FROM pg_stat_statements 
WHERE query LIKE '%admin_settings%' 
ORDER BY mean_time DESC;
```

## 🐛 Troubleshooting

### Settings Not Saving

1. Check admin authentication
2. Verify database connection
3. Check validation rules
4. Review error logs
5. Check database permissions

### Verification Failing

1. Check validation logic
2. Verify value format
3. Check error message
4. Review audit logs
5. Test with valid value

### Logs Not Showing

1. Check database connection
2. Verify logs table exists
3. Check log retention
4. Clear filters
5. Refresh page

## 📚 Additional Resources

- [API Documentation](./ADMIN_SETTINGS_VERIFICATION.md)
- [Database Schema](./ADMIN_SETTINGS_VERIFICATION.md#database-schema)
- [Validation Rules](./ADMIN_SETTINGS_VERIFICATION.md#validation-rules)
- [Best Practices](./ADMIN_SETTINGS_VERIFICATION.md#best-practices)

## 🎯 Success Criteria

✅ All settings display correctly
✅ Settings save successfully
✅ Verification works for all settings
✅ Audit logs record all changes
✅ Failed verifications are logged
✅ Admin can view change history
✅ Sensitive values are masked
✅ Batch operations work
✅ Performance is acceptable
✅ No errors in logs

---

**Status**: ✅ Ready for Integration
**Version**: 1.0
**Last Updated**: 2024
