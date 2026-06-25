## Super Admin Funding Hierarchy Implementation

### Overview
Super admins can now fund admins, and admins can fund their assigned users. This creates a three-tier funding structure:
- **Super Admin** → funds regular admins and their assigned users
- **Admin** → funds their assigned users and other assigned admins
- **User** → receives funding from their assigned admin

### Changes Made

#### 1. Admin Hierarchy Library (`server/src/lib/adminHierarchy.ts`)
Added a new function to support flexible user/admin assignments:
- `canAssignUser()` - Validates that both regular users and admins can be assigned to another admin

#### 2. Admin Routes (`server/src/routes/admin.ts`)
Updated funding endpoints to support the hierarchy:

**Deposit Endpoint** (`POST /api/admin/users/:id/deposit`)
- Super admin can deposit to any user or admin
- Sub-admins can deposit to their assigned users or admins
- No changes to deduct, hold, transfer, or fee endpoints (already support the hierarchy through the assignment check)

**Deduct Endpoint** (`POST /api/admin/users/:id/deduct`)
- Same permissions as deposit

**Hold Endpoint** (`POST /api/admin/users/:id/hold`)
- Same permissions as deposit

**Transfer Endpoint** (`POST /api/admin/transfer`)
- Super admin can transfer from any user
- Sub-admins can transfer from their assigned users or admins

**Fee Endpoint** (`POST /api/admin/users/:id/fee`)
- Same permissions as deposit

#### 3. Admin Hierarchy Routes (`server/src/routes/admin-hierarchy.ts`)
Enhanced to support assigning both users and admins:

**Assign User/Admin** (`POST /api/admin/assign-user`)
- Can now assign both regular users and admins to an admin
- Super admin can assign any user/admin to any admin
- Sub-admins can only assign to their own sub-admins
- Response indicates whether a "User" or "Admin" was assigned

**List Assignments** (`GET /api/admin/admins/:adminId/users`)
- Returns both users and admins assigned to an admin
- Includes a `type` field indicating whether each assignment is a 'user' or 'admin'

### Funding Flow Example

```
Super Admin
├── Can seed treasury with USD
├── Can fund Admin A
│   └── Admin A can now fund their assigned Users (1, 2, 3)
│   └── Admin A can fund Admin B (if Admin B is assigned)
│       └── Admin B can fund their assigned Users (4, 5, 6)
└── Can fund Admin C
    └── Admin C can fund their assigned Users (7, 8, 9)
```

### Key Permissions

| Action | Super Admin | Sub-Admin |
|--------|-----------|---------|
| Deposit to user | ✓ | ✓ (assigned only) |
| Deposit to admin | ✓ | ✓ (assigned only) |
| Deduct from user | ✓ | ✓ (assigned only) |
| Deduct from admin | ✓ | ✓ (assigned only) |
| Transfer from user | ✓ | ✓ (assigned only) |
| Transfer from admin | ✓ | ✓ (assigned only) |
| Assign user/admin | ✓ | ✓ (to own sub-admins) |
| Create admin | ✓ | ✗ |

### Database Schema
No schema changes required. Uses existing:
- `UserAdminAssignment` - Maps both users and admins to their managing admin
- `AdminHierarchy` - Tracks admin parent/child relationships and permissions

### API Usage Examples

**Super Admin assigns Admin B to Admin A (for funding):**
```json
POST /api/admin/assign-user
{
  "userId": "admin-b-id",
  "adminId": "admin-a-id"
}
```

**Admin A deposits to Admin B (now possible):**
```json
POST /api/admin/users/admin-b-id/deposit
{
  "currency": "USD",
  "amount": 10000,
  "reason": "manual_bank_wire",
  "status": "completed"
}
```

**Admin B deposits to their assigned User 1:**
```json
POST /api/admin/users/user-1-id/deposit
{
  "currency": "USD",
  "amount": 5000,
  "reason": "manual_bank_wire",
  "status": "completed"
}
```

### Testing the Implementation

1. Create Super Admin (already exists as admin@verdexis.com)
2. Create Admin A via `/api/admin/admins` (Super Admin only)
3. Create Admin B via `/api/admin/admins` (Super Admin only)
4. Assign Admin B to Admin A via `/api/admin/assign-user`
5. Assign User 1 to Admin B via `/api/admin/assign-user`
6. Admin A can now fund Admin B
7. Admin B can now fund User 1

### Audit Trail
All funding operations are logged via the existing `audit()` function, so the full hierarchy of who funded whom is recorded in the `AdminAudit` table.
