# Admin Hierarchy Integration Guide

## How to Integrate into Your App

### Step 1: Update Main Express App

In `server/src/app.ts`, add the admin hierarchy router:

```typescript
import adminHierarchyRouter from './routes/admin-hierarchy.js'

// After other route registrations
app.use('/api/admin', adminHierarchyRouter)

// Make sure this is after requireAuth middleware but before other admin routes
// So the middleware chain is: request -> auth -> admin -> admin-hierarchy
```

### Step 2: Run Migration Script

Initialize or update the Super Admin:

```bash
cd server
node scripts/create-super-admin.mjs
```

Expected output:
```
✅ Super Admin user created: admin@verdexis.com
✅ Super Admin hierarchy initialized with full permissions
✅ Initial wallet balances created

📋 Super Admin Details:
Email: admin@verdexis.com
Can create admins: Yes
Can manage users: Yes
Can manage deposits: Yes
Can manage transactions: Yes
Parent admin: None (Super Admin)
```

### Step 3: Test Endpoints

```bash
# 1. Login as Super Admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@verdexis.com",
    "password": "Admin@Verdexis2024"
  }'

# Save the token from response as $TOKEN

# 2. Create a sub-admin
curl -X POST http://localhost:3000/api/admin/admins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@company.com",
    "name": "Admin One",
    "password": "SecurePassword123!"
  }'

# 3. List all sub-admins
curl -X GET http://localhost:3000/api/admin/admins \
  -H "Authorization: Bearer $TOKEN"

# 4. Verify sub-admin cannot create admin (should get 403)
# Login as the new sub-admin and try to create another admin
```

---

## Optional: Update User Creation Endpoint

If you want to restrict which admins can create users, update the existing create user endpoint:

### In `server/src/routes/admin.ts`

Find the user creation route and add permission check:

```typescript
router.post('/users', async (req: AuthedRequest, res) => {
  // ... existing validation ...

  // Add this check before creating the user
  const hierarchy = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! }
  })

  if (hierarchy && !hierarchy.canManageUsers) {
    res.status(403).json({ error: 'This admin does not have permission to create users' })
    return
  }

  // ... rest of user creation logic ...

  // After user is created, automatically assign to creating admin if not already assigned
  if (req.userId) {
    await prisma.userAdminAssignment.create({
      data: {
        userId: u.id,
        adminId: req.userId,
        assignedBy: req.userId
      }
    }).catch(() => { /* ignore if already assigned */ })
  }
})
```

---

## Optional: Filter Users by Admin

Update the user listing to show only assigned users for non-Super-Admin admins:

### In `server/src/routes/admin.ts`

Update the `GET /users` endpoint:

```typescript
router.get('/users', async (req: AuthedRequest, res) => {
  // ... existing validation code ...

  // Check if caller is Super Admin
  const isSA = req.userId ? await isSuperAdmin(req.userId) : false

  // For non-Super-Admin admins, only show their assigned users
  if (!isSA) {
    const assignedUserIds = await prisma.userAdminAssignment.findMany({
      where: { adminId: req.userId! },
      select: { userId: true }
    })

    where.id = {
      in: assignedUserIds.map(a => a.userId)
    }
  }

  // ... rest of user listing logic ...
})
```

---

## Optional: Update Admin Responses

Show hierarchy information in admin endpoints:

### In `server/src/routes/admin.ts`

When returning user details, include admin info:

```typescript
router.get('/users/:id', async (req, res) => {
  // ... existing code ...

  const [holdings, walletBalances, ..., adminAssignment] = await Promise.all([
    // ... existing queries ...
    prisma.userAdminAssignment.findFirst({
      where: { userId: id },
      include: { admin: { select: { id: true, email: true, name: true } } }
    })
  ])

  res.json({
    user: publicUser(user),
    // ... other data ...
    admin: adminAssignment?.admin || null
  })
})
```

---

## Frontend Integration (Optional)

### Admin Management UI

Create a UI for Super Admin to manage admins. This would typically be a new page like `/admin/admins`:

```typescript
// In frontend - pages/AdminManagement.tsx
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function AdminManagement() {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/admins')
        setAdmins(res.admins)
      } catch (e) {
        console.error('Failed to load admins:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const createAdmin = async (email: string, name: string, password: string) => {
    try {
      const res = await api.post('/admin/admins', {
        email,
        name,
        password
      })
      setAdmins([...admins, res.admin])
    } catch (e) {
      console.error('Failed to create admin:', e)
    }
  }

  return (
    <div>
      <h1>Admin Management</h1>
      {/* UI for creating admins */}
      {/* UI for listing admins */}
      {/* UI for assigning users */}
    </div>
  )
}
```

---

## Environment Configuration

Add to your `.env` or `.env.local`:

```env
# Super Admin credentials
ADMIN_EMAIL=admin@verdexis.com
ADMIN_PASSWORD=Admin@Verdexis2024

# Optional: Custom port for testing
API_PORT=3000
```

---

## Database Verification

Verify the setup worked by checking the database:

```sql
-- Check if Super Admin exists
SELECT id, email, name, role, createdAt FROM "User" WHERE email = 'admin@verdexis.com';

-- Check AdminHierarchy
SELECT * FROM "AdminHierarchy" WHERE "canCreateAdmins" = true;

-- Check any sub-admins
SELECT * FROM "AdminHierarchy" WHERE "parentAdminId" IS NOT NULL;

-- Check user assignments
SELECT * FROM "UserAdminAssignment";
```

---

## Troubleshooting

### Issue: "Only Super Admin can create other admins" error when creating admin

**Solution**: Verify you're logged in as `admin@verdexis.com` and the email in your auth token matches exactly.

```bash
# Check stored auth
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Should show email: "admin@verdexis.com"
```

### Issue: Sub-admin created but cannot see users

**Solution**: Make sure users are assigned to the admin:

```bash
# Assign user to admin
curl -X POST http://localhost:3000/api/admin/assign-user \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "adminId": "admin_456"
  }'
```

### Issue: Can't create sub-admin - getting 403 error

**Solution**: Verify you're Super Admin:

```bash
# Check your admin permissions
curl -X GET http://localhost:3000/api/admin/admins/$(your_admin_id) \
  -H "Authorization: Bearer $TOKEN"

# Should show canCreateAdmins: true
```

---

## Summary

After integration:

1. ✅ `admin@verdexis.com` is Super Admin with full control
2. ✅ Super Admin can create other admins
3. ✅ Sub-admins cannot create other admins
4. ✅ Sub-admins can create and manage users
5. ✅ All actions are tracked in AdminAudit
6. ✅ Role hierarchy is properly enforced

---

## Support Files

- `server/src/lib/adminHierarchy.ts` - Helper functions
- `server/src/routes/admin-hierarchy.ts` - API endpoints
- `server/scripts/create-super-admin.mjs` - Setup script
- `ADMIN_HIERARCHY_GUIDE.md` - Full documentation
