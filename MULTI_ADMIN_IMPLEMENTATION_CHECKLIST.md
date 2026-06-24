# Multi-Admin Hierarchy - Quick Implementation Checklist

## Phase 1: Database Setup (30 minutes)

### 1.1 Create Migration
- [ ] Copy migration file to `server/prisma/migrations/`
- [ ] File: `20250215_multi_admin_hierarchy.sql`

### 1.2 Update Prisma Schema
- [ ] Add models to `server/prisma/schema.prisma`:
  - `AdminHierarchy`
  - `UserAdminAssignment`
  - `AdminBankAccount`
  - `AdminWalletDetail`
- [ ] Add relations to `User` model

### 1.3 Run Migration
```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

### 1.4 Verify Database
- [ ] Check tables created in database
- [ ] Verify indexes created
- [ ] Test connection

## Phase 2: Backend Setup (1 hour)

### 2.1 Create Routes File
- [ ] Copy `admin-hierarchy.ts` to `server/src/routes/`
- [ ] File: `admin-hierarchy.ts`

### 2.2 Register Routes
In `server/src/index.ts` or main Express app:
```typescript
import adminHierarchyRouter from './routes/admin-hierarchy.js'
app.use('/api/admin', adminHierarchyRouter)
```

### 2.3 Import Dependencies
- [ ] Ensure `z` (zod) is imported
- [ ] Ensure `prisma` is imported
- [ ] Ensure auth middleware is available

### 2.4 Test API Endpoints
```bash
# Test create sub-admin
POST http://localhost:4000/api/admin/admins/create
Authorization: Bearer <token>
Body: {
  "email": "subadmin@example.com",
  "name": "Sub Admin"
}

# Test get hierarchy
GET http://localhost:4000/api/admin/admins/hierarchy
```

## Phase 3: Frontend Setup (1 hour)

### 3.1 Create API Client
- [ ] Copy `admin-hierarchy-api.ts` to `app/src/lib/`
- [ ] Merge into main `api.ts` file

### 3.2 Create Components
- [ ] Copy `AdminHierarchyPanel.tsx` to `app/src/components/`

### 3.3 Add to Admin Dashboard
In admin dashboard page:
```tsx
import { AdminHierarchyPanel } from '../components/AdminHierarchyPanel'

export function AdminDashboard() {
  return <AdminHierarchyPanel />
}
```

### 3.4 Test Frontend
- [ ] Load admin panel
- [ ] View hierarchy
- [ ] Verify no console errors

## Phase 4: Features Implementation (2 hours)

### 4.1 Create Sub-Admin UI
- [ ] [ ] Form for creating new admins
- [ ] [ ] Temp password display
- [ ] [ ] Permission checkboxes

### 4.2 User Management UI
- [ ] [ ] List managed users
- [ ] [ ] Assign users to admin
- [ ] [ ] View user details

### 4.3 Bank Account Management
- [ ] [ ] Form to add bank account
- [ ] [ ] Edit account details
- [ ] [ ] Delete account

### 4.4 Wallet Management
- [ ] [ ] Form to add wallet address
- [ ] [ ] Support multiple chains
- [ ] [ ] Edit wallet details
- [ ] [ ] Delete wallet

## Phase 5: Testing (2 hours)

### 5.1 Unit Tests
- [ ] [ ] Test admin creation
- [ ] [ ] Test user assignment
- [ ] [ ] Test bank account operations
- [ ] [ ] Test wallet operations

### 5.2 Integration Tests
- [ ] [ ] Create admin hierarchy
- [ ] [ ] Assign users to admin
- [ ] [ ] Add user bank details
- [ ] [ ] Add user wallet addresses

### 5.3 Permission Tests
- [ ] [ ] Non-admin cannot create admins
- [ ] [ ] Admin can only manage assigned users
- [ ] [ ] Sub-admin cannot create admins (unless permission set)
- [ ] [ ] Delete permissions properly cascade

### 5.4 Data Validation
- [ ] [ ] Invalid email rejected
- [ ] [ ] Invalid wallet address rejected
- [ ] [ ] Invalid routing number rejected
- [ ] [ ] Duplicate assignments prevented

## Phase 6: Security & Audit (1 hour)

### 6.1 Permissions
- [ ] [ ] Check `canCreateAdmins` before creating
- [ ] [ ] Check `canManageUsers` before managing
- [ ] [ ] Check `canManageDeposits` before approving
- [ ] [ ] Check `canManageTransactions` before modifying

### 6.2 Audit Logging
- [ ] [ ] Log admin creations
- [ ] [ ] Log user assignments
- [ ] [ ] Log bank account changes
- [ ] [ ] Log wallet changes

### 6.3 Data Encryption
- [ ] [ ] Encrypt sensitive bank data (optional)
- [ ] [ ] Validate wallet addresses
- [ ] [ ] Sanitize all inputs

## Phase 7: Documentation (30 minutes)

### 7.1 Internal Docs
- [ ] [ ] Document API endpoints
- [ ] [ ] Document permission model
- [ ] [ ] Document database schema

### 7.2 User Docs
- [ ] [ ] How to create sub-admins
- [ ] [ ] How to assign users
- [ ] [ ] How to manage bank accounts
- [ ] [ ] How to manage wallets

## Phase 8: Deployment (1 hour)

### 8.1 Pre-Production
- [ ] [ ] Code review completed
- [ ] [ ] All tests passing
- [ ] [ ] Security check passed
- [ ] [ ] Database backup created

### 8.2 Staging
- [ ] [ ] Deploy to staging
- [ ] [ ] Run full test suite
- [ ] [ ] Verify all features work
- [ ] [ ] Check performance

### 8.3 Production
- [ ] [ ] Backup production database
- [ ] [ ] Deploy code changes
- [ ] [ ] Run migration
- [ ] [ ] Verify system works
- [ ] [ ] Monitor for 24 hours

## Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| Database | 30 min | Backend |
| Backend | 1 hour | Backend |
| Frontend | 1 hour | Frontend |
| Features | 2 hours | Full Team |
| Testing | 2 hours | QA |
| Security | 1 hour | Security |
| Docs | 30 min | Tech Writer |
| Deployment | 1 hour | DevOps |
| **Total** | **~8.5 hours** | |

## Rollback Plan

If issues occur:
1. Backup database first
2. Revert code changes
3. Delete migration (or run down migration)
4. Restart server
5. Verify system works

## Key Files

```
Backend:
- server/src/routes/admin-hierarchy.ts
- server/prisma/migrations/20250215_multi_admin_hierarchy.sql
- server/prisma/schema.prisma (modified)

Frontend:
- app/src/lib/admin-hierarchy-api.ts
- app/src/components/AdminHierarchyPanel.tsx
- app/src/lib/api.ts (modified)

Documentation:
- MULTI_ADMIN_SETUP.md
- MULTI_ADMIN_IMPLEMENTATION_CHECKLIST.md
```

## Success Criteria

- ✅ Admins can create sub-admins
- ✅ Admins can assign users
- ✅ Admins can add bank accounts for users
- ✅ Admins can add wallet addresses for users
- ✅ Permissions are properly enforced
- ✅ All data is properly audited
- ✅ No security vulnerabilities
- ✅ All tests passing
- ✅ Performance acceptable

## Support

For issues or questions:
1. Check MULTI_ADMIN_SETUP.md
2. Review API endpoint documentation
3. Check database schema
4. Run tests to isolate issue
5. Check server logs

---

**Status:** Ready to Start
**Estimated Completion:** 1 business day
**Complexity:** Medium
