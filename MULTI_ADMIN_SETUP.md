# Multi-Admin Hierarchy System - Complete Setup Guide

## Overview

This feature enables:
- ✅ Multiple admins with their own user management
- ✅ Admin hierarchy (parent admins can create sub-admins)
- ✅ Each admin manages specific users
- ✅ Admins can add/modify user bank details
- ✅ Admins can add/modify user wallet addresses
- ✅ Granular permissions per admin

## Architecture

```
Super Admin (root)
    ├── Admin A (can create sub-admins)
    │   ├── Users assigned to Admin A
    │   ├── Sub-Admin A1
    │   │   └── Users assigned to Sub-Admin A1
    │   └── Sub-Admin A2
    │       └── Users assigned to Sub-Admin A2
    │
    └── Admin B (manages users only)
        └── Users assigned to Admin B
```

## Database Schema

### New Tables

1. **AdminHierarchy**
   - Links admin users to their parent admins
   - Stores admin permissions
   - Tracks who created the admin

2. **UserAdminAssignment**
   - Maps users to their assigned admins
   - One-to-many relationship

3. **AdminBankAccount**
   - Stores bank details admins add for users
   - Can be verified by another admin

4. **AdminWalletDetail**
   - Stores wallet addresses admins add for users
   - Supports multiple chains

## Implementation Steps

### Step 1: Database Migration

```bash
# Apply the migration
npx prisma migrate deploy

# Or manually run the SQL in:
# server/prisma/migrations/20250215_multi_admin_hierarchy.sql
```

### Step 2: Update Prisma Schema

Add the new models to `server/prisma/schema.prisma`:

```prisma
model AdminHierarchy {
  id               String   @id @default(cuid())
  adminId          String   @unique
  admin            User     @relation("AdminProfile", fields: [adminId], references: [id], onDelete: Cascade)
  
  parentAdminId    String?
  parentAdmin      User?    @relation("SubAdmins", fields: [parentAdminId], references: [id], onDelete: SetNull)
  
  canCreateAdmins        Boolean @default(false)
  canManageUsers         Boolean @default(false)
  canManageDeposits      Boolean @default(true)
  canManageTransactions  Boolean @default(true)
  
  createdAt        DateTime @default(now())
  createdBy        String
  createdByUser    User     @relation("AdminCreatedBy", fields: [createdBy], references: [id], onDelete: Cascade)
  
  @@index([parentAdminId])
}

// ... (see schema-additions.txt for full models)
```

Also add relations to User model:
```prisma
model User {
  // ... existing fields ...
  
  // Admin hierarchy relations
  adminProfile  AdminHierarchy?       @relation("AdminProfile")
  parentAdmins  AdminHierarchy[]      @relation("SubAdmins")
  createdAdmins AdminHierarchy[]      @relation("AdminCreatedBy")
  admins        UserAdminAssignment[] @relation("UserAdmins")
  assignmentsMade UserAdminAssignment[] @relation("AssignedBy")
  bankAccounts  AdminBankAccount[]    @relation("UserBankAccounts")
  walletDetails AdminWalletDetail[]   @relation("UserWalletDetails")
}
```

### Step 3: Backend Routes

1. Create new routes file: `server/src/routes/admin-hierarchy.ts`
2. Copy code from `/server/src/routes/admin-hierarchy.ts`
3. Register in main Express app:

```typescript
import adminHierarchyRouter from './routes/admin-hierarchy.js'
app.use('/api/admin', adminHierarchyRouter)
```

### Step 4: Frontend API Client

1. Create `app/src/lib/admin-hierarchy-api.ts`
2. Add methods to main `api` object:

```typescript
export const api = {
  // ... existing methods ...
  adminHierarchy: {
    createSubAdmin: (...) => ...,
    getHierarchy: (...) => ...,
    // ... etc
  }
}
```

### Step 5: Frontend Components

1. Create `app/src/components/AdminHierarchyPanel.tsx`
2. Add to admin dashboard:

```tsx
import { AdminHierarchyPanel } from '../components/AdminHierarchyPanel'

export function AdminDashboard() {
  return (
    <div>
      <AdminHierarchyPanel />
    </div>
  )
}
```

## API Endpoints

### Admin Management

**Create Sub-Admin**
```bash
POST /api/admin/admins/create
Authorization: Bearer <admin-token>

Body:
{
  "email": "subadmin@example.com",
  "name": "Sub Admin Name",
  "canCreateAdmins": false,
  "canManageUsers": true,
  "canManageDeposits": true,
  "canManageTransactions": true
}

Response:
{
  "admin": {
    "id": "admin_id",
    "email": "subadmin@example.com",
    "name": "Sub Admin Name",
    "tempPassword": "generated_password"
  }
}
```

**Get Admin Hierarchy**
```bash
GET /api/admin/admins/hierarchy
Authorization: Bearer <admin-token>

Response:
{
  "adminInfo": {...},
  "subAdmins": [{...}],
  "managedUsers": [{...}]
}
```

### User Management

**Assign User to Admin**
```bash
POST /api/admin/users/:userId/assign-admin
Authorization: Bearer <admin-token>

Body:
{
  "adminId": "admin_id"
}
```

**Get Users for Admin**
```bash
GET /api/admin/admins/:adminId/users
Authorization: Bearer <admin-token>
```

### Bank Accounts

**Add Bank Account**
```bash
POST /api/admin/users/:userId/bank-accounts
Authorization: Bearer <admin-token>

Body:
{
  "bankName": "Bank of America",
  "accountNumber": "123456789",
  "routingNumber": "021000021",
  "accountHolder": "John Doe",
  "accountType": "checking",
  "country": "US"
}
```

**Get Bank Accounts**
```bash
GET /api/admin/users/:userId/bank-accounts
```

**Update Bank Account**
```bash
PATCH /api/admin/bank-accounts/:accountId
```

**Delete Bank Account**
```bash
DELETE /api/admin/bank-accounts/:accountId
```

### Wallet Details

**Add Wallet Detail**
```bash
POST /api/admin/users/:userId/wallet-details
Authorization: Bearer <admin-token>

Body:
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE",
  "chainId": "0x1",
  "walletType": "ethereum",
  "label": "Main Wallet",
  "notes": "Hardware wallet"
}
```

**Get Wallet Details**
```bash
GET /api/admin/users/:userId/wallet-details
```

**Update Wallet Detail**
```bash
PATCH /api/admin/wallet-details/:detailId
```

**Delete Wallet Detail**
```bash
DELETE /api/admin/wallet-details/:detailId
```

## Usage Examples

### Frontend - Create Sub-Admin

```tsx
import { api } from '../lib/api'
import { adminHierarchy } from '../lib/admin-hierarchy-api'

async function createSubAdmin() {
  const result = await adminHierarchy.createSubAdmin({
    email: 'subadmin@example.com',
    name: 'Sub Admin',
    canManageUsers: true,
    canManageDeposits: true,
  })
  
  console.log('Temp password:', result.admin.tempPassword)
}
```

### Frontend - Add User Bank Account

```tsx
async function addBankAccount(userId: string) {
  await adminHierarchy.addBankAccount(userId, {
    bankName: 'Chase Bank',
    accountNumber: '987654321',
    accountHolder: 'Jane Doe',
    accountType: 'savings',
  })
}
```

### Frontend - Add User Wallet

```tsx
async function addUserWallet(userId: string) {
  await adminHierarchy.addWalletDetail(userId, {
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE',
    chainId: '0x1',
    walletType: 'ethereum',
    label: 'User Main Wallet',
  })
}
```

## Permissions

### Permission Levels

| Permission | Description |
|-----------|-------------|
| `canCreateAdmins` | Can create sub-admins |
| `canManageUsers` | Can assign users and modify their details |
| `canManageDeposits` | Can approve/reject deposits |
| `canManageTransactions` | Can manage transactions |

### Default Permissions by Role

**Super Admin (root)**
- All permissions: `true`

**Admin (created by super)**
- `canCreateAdmins`: configurable
- `canManageUsers`: `true`
- `canManageDeposits`: `true`
- `canManageTransactions`: `true`

**Sub-Admin (created by admin)**
- `canCreateAdmins`: `false`
- `canManageUsers`: `true`
- `canManageDeposits`: `true`
- `canManageTransactions`: `true`

## Audit & Security

All admin actions are logged:
- Admin creations
- User assignments
- Bank account additions
- Wallet detail modifications

Queries include:
- Who performed the action
- When it happened
- What data was affected

## Best Practices

1. **Security**
   - Use strong passwords for admin accounts
   - Change temp passwords immediately
   - Restrict admin creation permissions
   - Verify bank accounts before using
   - Enable 2FA for admins

2. **Organization**
   - Limit sub-admin creation depth (2-3 levels max)
   - Assign clear responsibilities
   - Document permission levels
   - Regular admin audits

3. **Data Management**
   - Verify bank details before processing
   - Validate wallet addresses (EIP-55 checksum)
   - Keep audit logs
   - Regular backups

## Testing

### Test Scenarios

1. **Create Admin Hierarchy**
   - Create super admin
   - Create sub-admin under super
   - Create sub-admin under sub-admin

2. **User Assignment**
   - Assign user to admin
   - Verify user appears in admin's list
   - Transfer user between admins

3. **Bank Accounts**
   - Add multiple accounts per user
   - Edit account details
   - Delete accounts
   - Verify permission checks

4. **Wallet Details**
   - Add multiple wallets per user
   - Support different chains
   - Edit wallet labels
   - Delete wallets

### Test Queries

```sql
-- View admin hierarchy
SELECT a.id, a.adminId, a.parentAdminId, u.email, u.name
FROM AdminHierarchy a
JOIN User u ON u.id = a.adminId
LEFT JOIN User p ON p.id = a.parentAdminId;

-- View user assignments
SELECT u.email AS user, a.email AS admin, ua.assignedAt
FROM UserAdminAssignment ua
JOIN User u ON u.id = ua.userId
JOIN User a ON a.id = ua.adminId;

-- View bank accounts
SELECT u.email, ba.bankName, ba.accountHolder
FROM AdminBankAccount ba
JOIN User u ON u.id = ba.userId;
```

## Troubleshooting

### Admin Can't Create Users
- Check `canManageUsers` permission
- Verify user is assigned to admin

### Bank Account Not Saving
- Validate account number format
- Check account holder name
- Verify user exists

### Wallet Address Invalid
- Must be valid Ethereum address (0x...)
- Must be 42 characters
- Check EIP-55 checksum

## Migration from Flat Admin

If migrating from single admin to multi-admin:

1. Create root admin with all permissions
2. Assign existing users to root admin
3. Create sub-admins as needed
4. Transfer user assignments
5. Archive old admin records

## Future Enhancements

- [ ] Admin role templates (preset permission sets)
- [ ] Delegation levels (allow admins to delegate certain powers)
- [ ] Bulk user assignment
- [ ] User group management
- [ ] Permission inheritance
- [ ] Admin activity dashboard
- [ ] Two-factor approval for sensitive actions
- [ ] Automatic admin rotation

---

**Status:** Ready for Production
**Last Updated:** January 2025
**Version:** 1.0
