# Multi-Admin Hierarchy - Quick Start Commands

## Current Status: ✅ READY FOR DEPLOYMENT

All TypeScript errors fixed. Build passing. Ready for database migration.

---

## Step 1: Prepare Database (5 minutes)

### Option A: Update .env with PostgreSQL Credentials
```bash
# Edit server/.env and update DATABASE_URL
# Example:
# DATABASE_URL="postgresql://user:password@localhost:5432/verdexis"
```

### Option B: Use Environment Variable
```bash
export DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

---

## Step 2: Run Database Migration (2 minutes)

### Option A: Automatic Migration (Recommended)
```bash
cd server
npx prisma migrate dev --name add_multi_admin_hierarchy
npx prisma generate
```

### Option B: Deploy Migration to Existing Database
```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

### Option C: Manual SQL (For Managed Databases)
1. Copy SQL from: `server/prisma/migrations/20250215_add_multi_admin_hierarchy.sql`
2. Execute in your database management console
3. Run: `npx prisma generate`

---

## Step 3: Register Routes in Express App (2 minutes)

Edit `server/src/index.ts`:

```typescript
// Add this import at the top:
import adminHierarchyRoutes from './routes/admin-hierarchy.js'

// Add this line after other route registrations:
app.use('/api', adminHierarchyRoutes)
```

---

## Step 4: Verify Build (1 minute)

```bash
cd server
npm run build
```

Expected output:
```
✔ Generated Prisma Client
npm notice
> verdexis-server@0.1.0 build
> prisma generate && npx tsc -p tsconfig.json
```

---

## Step 5: Start Server and Test (5 minutes)

### Start Development Server
```bash
npm run dev
```

### Test: Get Admin Hierarchy
```bash
curl http://localhost:4000/api/admins/hierarchy \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Test: Create Sub-Admin
```bash
curl -X POST http://localhost:4000/api/admins/create \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "subadmin@example.com",
    "name": "Sub Admin",
    "canCreateAdmins": false,
    "canManageUsers": true
  }'
```

Expected response:
```json
{
  "admin": {
    "id": "clx...",
    "email": "subadmin@example.com",
    "name": "Sub Admin",
    "tempPassword": "abc123xyz456"
  }
}
```

---

## Step 6: Deploy to Production (10 minutes)

```bash
# Commit changes
git add .
git commit -m "Add multi-admin hierarchy system

- Added 4 new Prisma models: AdminHierarchy, UserAdminAssignment, AdminBankAccount, AdminWalletDetail
- Implemented 11 API endpoints for admin management
- Added database migration with proper indexes
- All TypeScript compilation errors resolved"

# Push to remote
git push origin main

# Deploy (depends on your setup - Vercel, Render, Docker, etc.)
# For Render:
# - Trigger deployment from Git integration
# - Or use: render deploy

# For Docker:
docker build -t verdexis-server .
docker push your-registry/verdexis-server:latest
```

---

## Troubleshooting Commands

### Check Prisma Schema Validity
```bash
cd server
npx prisma validate
```

### Reset Database (⚠️ WARNING: DELETES ALL DATA)
```bash
cd server
npx prisma migrate reset
```

### View Database State
```bash
cd server
npx prisma studio
```
Then visit http://localhost:5555

### Check Database Connection
```bash
cd server
npx prisma db execute --stdin < /dev/null
```

### Generate Types Only (No Migration)
```bash
cd server
npx prisma generate
```

---

## Full Setup Script (One Command)

For quick setup in development:

```bash
#!/bin/bash
cd server
npx prisma migrate dev --name add_multi_admin_hierarchy
npx prisma generate
npm run build
cd ..
echo "✅ Setup complete. Ready to register routes and deploy."
```

Save as `setup.sh` and run: `bash setup.sh`

---

## Minimal Integration Example

Add to your Express app (`server/src/index.ts`):

```typescript
import { Router } from 'express'
import adminHierarchyRoutes from './routes/admin-hierarchy.js'

const app = express()

// ... existing middleware ...

// Register admin hierarchy routes
app.use('/api', adminHierarchyRoutes)

// ... rest of routes ...

app.listen(4000, () => {
  console.log('✅ Server running on port 4000')
  console.log('✅ Admin hierarchy routes loaded')
})
```

---

## Environment Setup Verification

Before running commands, verify:

```bash
# Node.js version (should be 18+)
node --version

# npm version
npm --version

# PostgreSQL client available
psql --version

# Verify .env exists
ls -la server/.env
```

---

## Development Workflow

After first setup:

```bash
# Daily development
npm run dev

# Make changes to admin-hierarchy.ts
# Changes auto-reload with ts-node/tsx

# Before committing
npm run build

# Test endpoints
curl -X GET http://localhost:4000/api/admins/hierarchy \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## Performance Tips

1. **Enable Connection Pooling** (Production):
   ```env
   # Add to DATABASE_URL
   ?schema=public&poolingMode=transaction
   ```

2. **Add Redis Caching** (Optional):
   ```typescript
   // Cache admin hierarchy for 5 minutes
   const key = `admin:${req.userId}:hierarchy`
   const cached = await redis.get(key)
   if (cached) return res.json(JSON.parse(cached))
   ```

3. **Index Additional Queries**:
   ```sql
   CREATE INDEX idx_admin_hierarchy_parent ON "AdminHierarchy"("parentAdminId", "canCreateAdmins");
   CREATE INDEX idx_user_admin_created ON "UserAdminAssignment"("createdAt");
   ```

---

## Support Resources

- **API Documentation**: See MULTI_ADMIN_HIERARCHY_SETUP.md
- **Schema Reference**: server/prisma/schema.prisma
- **Type Definitions**: server/node_modules/.prisma/client (auto-generated)
- **Migration File**: server/prisma/migrations/20250215_add_multi_admin_hierarchy.sql

---

## Estimated Timeline

| Step | Time | Difficulty |
|------|------|-----------|
| 1. Update .env | 2 min | Easy |
| 2. Run migration | 3 min | Easy |
| 3. Register routes | 2 min | Easy |
| 4. Verify build | 1 min | Easy |
| 5. Test endpoints | 5 min | Medium |
| 6. Deploy | 10 min | Medium |
| **TOTAL** | **~25 min** | **Easy** |

---

## Success Indicators

After deployment, you should see:

✅ `GET /api/admins/hierarchy` returns admin info  
✅ `POST /api/admins/create` creates sub-admins  
✅ `POST /api/users/:userId/bank-accounts` stores bank details  
✅ `POST /api/users/:userId/wallet-details` stores wallet addresses  
✅ All endpoints require valid Bearer token  
✅ Admin permission checks enforce hierarchy  

---

**You're all set! Follow the steps above for production deployment.** 🚀
