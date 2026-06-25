# Admin Hierarchy Setup Guide

## Phase 1: Initialize Super Admin

### 1.1 Run Super Admin Creation Script

```bash
cd server
npm run create-super-admin
```

Environment variables:
- `ADMIN_EMAIL` - Super Admin email (default: `admin@verdexis.com`)
- `ADMIN_PASSWORD` - Super Admin password (default: `Admin@Verdexis2024`)

Expected output:
```
✅ Super Admin user created
✅ Super Admin hierarchy initialized with full permissions
✅ Initial wallet balances created
```

### 1.2 Verify Setup

```bash
curl http://localhost:3000/api/health
```

## Phase 2: Create Sub-Admins

### 2.1 Create Sub-Admin via API

```bash
curl -X POST http://localhost:3000/api/admin/hierarchy/admins \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@example.com",
    "name": "Admin One",
    "password": "SecurePassword123"
  }'
```

Response:
```json
{
  "ok": true,
  "admin": {
    "id": "<ADMIN_ID>",
    "email": "admin1@example.com",
    "name": "Admin One",
    "role": "admin",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "Admin admin1@example.com created successfully. They can create users but cannot create other admins."
}
```

### 2.2 List Sub-Admins

```bash
curl http://localhost:3000/api/admin/hierarchy/admins \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```

## Phase 3: User Auto-Assignment

### 3.1 Configure Default Admin

Set environment variable `DEFAULT_ADMIN_ID` to automatically assign new users to this admin:

```bash
export DEFAULT_ADMIN_ID="<ADMIN_ID>"
```

When users sign up, they'll be automatically assigned to this admin.

### 3.2 Manual User Assignment

Assign an existing user to an admin:

```bash
curl -X POST http://localhost:3000/api/admin/hierarchy/assign-user \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<USER_ID>",
    "adminId": "<ADMIN_ID>"
  }'
```

## Phase 4: Query Admin Data

### 4.1 View Admin Details

```bash
curl http://localhost:3000/api/admin/hierarchy/admins/<ADMIN_ID> \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```

Response includes:
- Admin user details
- Hierarchy permissions
- Assigned users count
- Parent admin info

### 4.2 List Admin's Users

```bash
curl http://localhost:3000/api/admin/hierarchy/admins/<ADMIN_ID>/users \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```

### 4.3 Remove User Assignment

```bash
curl -X POST http://localhost:3000/api/admin/hierarchy/remove-assignment \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<USER_ID>",
    "adminId": "<ADMIN_ID>"
  }'
```

## Permission Model

### Super Admin
- Can create new admins (sub-admins)
- Can manage all users
- Can manage all deposits
- Can manage all transactions
- Can view all sub-admins

### Sub-Admin (created by Super Admin)
- Cannot create other admins
- Can manage assigned users
- Can manage deposits for assigned users
- Can manage transactions for assigned users
- Cannot view other admins' users

### Regular User
- No admin privileges
- Assigned to an admin by Super Admin or automatically at signup
- Can be reassigned or unassigned by Super Admin

## Testing Checklist

- [ ] Super Admin user created with full permissions
- [ ] Super Admin can create sub-admins
- [ ] Sub-admin cannot create other admins
- [ ] Users auto-assign to default admin on signup
- [ ] Super Admin can view all sub-admins
- [ ] Super Admin can manually assign/reassign users
- [ ] Sub-admin can view only their assigned users
- [ ] Proper 403 Forbidden responses when unauthorized

## Troubleshooting

### "Only Super Admin can create new admins"
- Verify you're using Super Admin token (admin@verdexis.com)
- Check JWT token is valid and not expired

### "Email already exists"
- Use unique email for new admin creation

### Auto-assignment not working
- Verify `DEFAULT_ADMIN_ID` environment variable is set
- Check admin ID exists in database
- Ensure admin has role='admin'

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/hierarchy/admins` | Super Admin | Create sub-admin |
| GET | `/api/admin/hierarchy/admins` | Super Admin | List all sub-admins |
| GET | `/api/admin/hierarchy/admins/:adminId` | Super Admin/Self | View admin details |
| POST | `/api/admin/hierarchy/assign-user` | Super Admin/Admin | Assign user to admin |
| GET | `/api/admin/hierarchy/admins/:adminId/users` | Super Admin/Admin | List admin's users |
| POST | `/api/admin/hierarchy/remove-assignment` | Super Admin | Remove user assignment |
