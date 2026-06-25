# Super Admin Hierarchy System Documentation

## Overview

The system implements a hierarchical admin structure with `admin@verdexis.com` as the Super Admin who can create and manage other admins and users.

## Role Hierarchy

```
Super Admin (admin@verdexis.com)
├── Admin 1 (Created by Super Admin)
│   ├── User 1
│   ├── User 2
│   └── User 3
├── Admin 2 (Created by Super Admin)
│   ├── User 4
│   └── User 5
└── Admin 3 (Created by Super Admin)
    └── User 6
```

## Super Admin Capabilities

`admin@verdexis.com` with role='admin' is the Super Admin and can:

- ✅ Create new admins
- ✅ Create users
- ✅ Manage all deposits and transactions
- ✅ Manage KYC verification
- ✅ Assign users to admins
- ✅ View all sub-admins and their users
- ✅ Perform all admin operations

**Key**: Super Admin has email verification: `email === 'admin@verdexis.com'` AND `role === 'admin'`

## Sub-Admin Capabilities

Any admin created by Super Admin can:

- ✅ Create users (assign them to themselves)
- ✅ Manage their own users' deposits and transactions
- ✅ Manage KYC verification for their users
- ✅ View their assigned users
- ✅ All standard admin operations
- ❌ **Cannot** create other admins (only Super Admin can)
- ❌ **Cannot** create sub-admins under them

## Database Schema

### AdminHierarchy Model

```typescript
model AdminHierarchy {
  id                  String
  adminId             String @unique
  admin               User
  parentAdminId       String?
  parentAdmin         AdminHierarchy?
  children            AdminHierarchy[]
  canCreateAdmins     Boolean  // Only true for Super Admin
  canManageUsers      Boolean
  canManageDeposits   Boolean
  canManageTransactions Boolean
  createdBy           String
  createdAt           DateTime
  updatedAt           DateTime
}
```

### UserAdminAssignment Model

```typescript
model UserAdminAssignment {
  id          String
  userId      String
  user        User
  adminId     String
  admin       User
  assignedBy  String
  assignedAt  DateTime
  updatedAt   DateTime
}
```

## API Endpoints

### Create Sub-Admin (Super Admin Only)

```
POST /api/admin/admins
```

**Request:**
```json
{
  "email": "admin1@verdexis.com",
  "name": "Admin One",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "ok": true,
  "admin": {
    "id": "admin_id_1",
    "email": "admin1@verdexis.com",
    "name": "Admin One",
    "role": "admin",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Admin admin1@verdexis.com created successfully. They can create users but cannot create other admins."
}
```

### List All Sub-Admins (Super Admin Only)

```
GET /api/admin/admins
```

**Response:**
```json
{
  "admins": [
    {
      "id": "admin_id_1",
      "email": "admin1@verdexis.com",
      "name": "Admin One",
      "canCreateAdmins": false,
      "canManageUsers": true,
      "canManageDeposits": true,
      "canManageTransactions": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Get Admin Details

```
GET /api/admin/admins/:adminId
```

**Response:**
```json
{
  "admin": {
    "id": "admin_id_1",
    "email": "admin1@verdexis.com",
    "name": "Admin One",
    "role": "admin",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "hierarchy": {
    "canCreateAdmins": false,
    "canManageUsers": true,
    "canManageDeposits": true,
    "canManageTransactions": true,
    "parentAdmin": {
      "id": "super_admin_id",
      "email": "admin@verdexis.com",
      "name": "Super Admin"
    },
    "isSuperAdmin": false
  },
  "assignedUsers": [
    {
      "id": "user_1",
      "email": "user1@example.com",
      "name": "User One",
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ],
  "assignedUsersCount": 1
}
```

### Assign User to Admin

```
POST /api/admin/assign-user
```

**Request:**
```json
{
  "userId": "user_id_1",
  "adminId": "admin_id_1"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "User assigned successfully"
}
```

### Get Admin's Users

```
GET /api/admin/admins/:adminId/users
```

**Response:**
```json
{
  "users": [
    {
      "id": "user_1",
      "email": "user1@example.com",
      "name": "User One",
      "role": "user",
      "suspended": false,
      "kycStatus": "pending",
      "createdAt": "2024-01-15T11:00:00Z",
      "assignedAt": "2024-01-15T11:05:00Z"
    }
  ],
  "count": 1
}
```

## Setup Instructions

### 1. Initialize Super Admin

Run the migration to create the SuperAdmin:

```bash
node server/scripts/create-super-admin.mjs
```

This will:
- Create `admin@verdexis.com` with role 'admin'
- Initialize AdminHierarchy with `canCreateAdmins: true`
- Set up initial wallet balances

### 2. Super Admin Login

- Email: `admin@verdexis.com`
- Password: `Admin@Verdexis2024` (or custom via `ADMIN_PASSWORD` env var)

### 3. Create Sub-Admins

Super Admin can now use the API to create sub-admins:

```bash
curl -X POST http://localhost:3000/api/admin/admins \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@verdexis.com",
    "name": "Admin One",
    "password": "SecurePassword123!"
  }'
```

### 4. Assign Users to Admins

Super Admin assigns created users to admins:

```bash
curl -X POST http://localhost:3000/api/admin/assign-user \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id_123",
    "adminId": "admin_id_456"
  }'
```

## Permission Rules

### Super Admin (admin@verdexis.com)

- Can create admins: **Yes**
- Can create users: **Yes**
- Can manage other admins' users: **Yes**
- Parent admin: **None (root)**
- canCreateAdmins: **true**

### Sub-Admin (Created by Super Admin)

- Can create admins: **No** (Throws 403 error)
- Can create users: **Yes** (assign to themselves)
- Can manage own users: **Yes**
- Parent admin: **Super Admin**
- canCreateAdmins: **false**

### Checks in Code

**Creating Admin:**
```typescript
const isSuperAdmin = await isSuperAdmin(req.userId)
if (!isSuperAdmin) {
  throw new Error('Only Super Admin can create other admins')
}
```

**Creating User:**
```typescript
// Both Super Admin and Sub-Admin can create users
// Users are automatically assigned to the creating admin if not explicitly assigned
```

## Environment Variables

```env
# Set Super Admin email (defaults to admin@verdexis.com)
ADMIN_EMAIL=admin@verdexis.com

# Set Super Admin password
ADMIN_PASSWORD=Admin@Verdexis2024
```

## Helper Functions

Available in `server/src/lib/adminHierarchy.ts`:

### isSuperAdmin(userId: string): Promise<boolean>
Checks if a user is the Super Admin (email === 'admin@verdexis.com' AND role === 'admin')

### canCreateAdmins(adminId: string): Promise<boolean>
Checks if an admin can create other admins (only Super Admin)

### createSubAdmin(superAdminId, adminData): Promise<string>
Creates a new sub-admin under Super Admin (throws error if not Super Admin)

### getSubAdmins(superAdminId): Promise<any[]>
Get all sub-admins created by Super Admin

### assignUserToAdmin(adminId, userId, assignedByAdminId): Promise<void>
Assign a user to an admin

### getAdminUsers(adminId): Promise<string[]>
Get all users assigned to an admin

## Security Notes

1. Only `admin@verdexis.com` can create admins - verified by email check
2. Sub-admins cannot create other admins - checked via `canCreateAdmins` flag
3. Each admin can only see/manage their assigned users (unless Super Admin)
4. All admin actions are logged in AdminAudit table
5. Super Admin cannot demote themselves - built into user update logic
6. Parent admin IDs form a chain back to Super Admin for audit trail

## Migration Script

If updating existing database, run:

```bash
# In SQL or via Prisma migrations
# Add AdminHierarchy and UserAdminAssignment tables

# Then initialize Super Admin if they already exist as admin
node server/scripts/create-super-admin.mjs
```
