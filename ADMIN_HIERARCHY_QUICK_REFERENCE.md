# Admin Hierarchy - Quick Reference Card

## 🔐 Getting Your Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@verdexis.com",
    "password": "Admin@Verdexis2024"
  }'

# Copy the token from response, use as:
# export TOKEN="eyJhbGc..."
```

---

## 📌 All Endpoints

### 1. Create Sub-Admin
**POST** `/api/admin/hierarchy/admins`
```bash
curl -X POST http://localhost:3000/api/admin/hierarchy/admins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@company.com",
    "name": "Company Admin",
    "password": "SecurePassword123"
  }'
```
- **Auth**: Super Admin only
- **Returns**: New admin user object with ID

---

### 2. List All Sub-Admins
**GET** `/api/admin/hierarchy/admins`
```bash
curl http://localhost:3000/api/admin/hierarchy/admins \
  -H "Authorization: Bearer $TOKEN"
```
- **Auth**: Super Admin only
- **Returns**: Array of admins with their permissions

---

### 3. Get Admin Details
**GET** `/api/admin/hierarchy/admins/:adminId`
```bash
curl http://localhost:3000/api/admin/hierarchy/admins/usr_abc123 \
  -H "Authorization: Bearer $TOKEN"
```
- **Auth**: Super Admin or the admin themselves
- **Returns**: Admin details, permissions, parent admin, assigned users count

---

### 4. Assign User to Admin
**POST** `/api/admin/hierarchy/assign-user`
```bash
curl -X POST http://localhost:3000/api/admin/hierarchy/assign-user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_user123",
    "adminId": "usr_admin456"
  }'
```
- **Auth**: Super Admin or the admin themselves
- **Returns**: Success confirmation

---

### 5. List Admin's Users
**GET** `/api/admin/hierarchy/admins/:adminId/users`
```bash
curl http://localhost:3000/api/admin/hierarchy/admins/usr_admin456/users \
  -H "Authorization: Bearer $TOKEN"
```
- **Auth**: Super Admin or the admin themselves
- **Returns**: Array of assigned users with details

---

### 6. Remove User Assignment
**POST** `/api/admin/hierarchy/remove-assignment`
```bash
curl -X POST http://localhost:3000/api/admin/hierarchy/remove-assignment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_user123",
    "adminId": "usr_admin456"
  }'
```
- **Auth**: Super Admin only
- **Returns**: Success confirmation

---

## ⚙️ Setup Commands

### Initialize Super Admin
```bash
cd server
npm run create-super-admin
```
**Environment variables:**
- `ADMIN_EMAIL=admin@verdexis.com`
- `ADMIN_PASSWORD=YourPassword123`

---

### Test All Endpoints
```bash
npm run test-admin-hierarchy
```
**Expected output:** ✅ All tests pass

---

### Set Default Admin for New Users
```bash
export DEFAULT_ADMIN_ID="usr_admin456"
npm run dev  # Restart server
```

---

## 🎯 Common Workflows

### Workflow 1: Create New Admin & Assign Users
```bash
# 1. Get Super Admin token
export TOKEN="<your_token>"

# 2. Create admin
ADMIN_ID=$(curl -X POST ... | jq -r '.admin.id')

# 3. Assign users
curl -X POST .../assign-user \
  -d "{\"userId\": \"usr_123\", \"adminId\": \"$ADMIN_ID\"}"
```

### Workflow 2: Auto-Assign New Users
```bash
# 1. Get admin ID to use as default
export ADMIN_ID="<admin_id>"

# 2. Set environment variable
export DEFAULT_ADMIN_ID="$ADMIN_ID"

# 3. Restart server (new signups auto-assign)
npm run dev
```

### Workflow 3: Move User Between Admins
```bash
# 1. Get old admin, new admin, user IDs
# 2. Remove from old admin
curl -X POST .../remove-assignment \
  -d "{\"userId\": \"$USER_ID\", \"adminId\": \"$OLD_ADMIN\"}"

# 3. Assign to new admin
curl -X POST .../assign-user \
  -d "{\"userId\": \"$USER_ID\", \"adminId\": \"$NEW_ADMIN\"}"
```

---

## ✅ Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (invalid data) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (email already exists) |

---

## 🚨 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Only Super Admin..." | Using non-Super Admin token | Use admin@verdexis.com token |
| "Invalid input" | Missing/wrong fields | Check request format |
| "Email already exists" | Email in use | Use new unique email |
| "Unauthorized" | No token | Add Authorization header |
| "Invalid or expired token" | Bad token | Get new token via login |
| "User not found" | Wrong ID | Verify user ID exists |

---

## 📊 Permission Model Cheat Sheet

| Action | Super Admin | Sub-Admin | User |
|--------|:----------:|:--------:|:----:|
| Create admins | ✅ | ❌ | ❌ |
| List all admins | ✅ | ❌ | ❌ |
| Assign users | ✅ | ❌ | ❌ |
| View own users | ✅ | ✅ | ❌ |
| View others' users | ✅ | ❌ | ❌ |
| Remove assignments | ✅ | ❌ | ❌ |

---

## 🔧 Environment Variables

```bash
# Super Admin credentials
ADMIN_EMAIL=admin@verdexis.com
ADMIN_PASSWORD=Admin@Verdexis2024

# Auto-assign new users
DEFAULT_ADMIN_ID=usr_xxxxx

# Server
NODE_ENV=production
JWT_SECRET=your_secret
DATABASE_URL=your_db_url
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/admin-hierarchy.ts` | API endpoints |
| `server/src/lib/adminHierarchy.ts` | Business logic |
| `server/scripts/create-super-admin.mjs` | Initialize Super Admin |
| `server/scripts/test-admin-hierarchy.mjs` | Test suite |
| `app/src/components/AdminHierarchyManager.tsx` | Frontend UI |
| `ADMIN_HIERARCHY_SETUP.md` | Full setup guide |

---

## 🎓 Example: Full Admin Setup Flow

```bash
#!/bin/bash

# 1. Initialize Super Admin
npm run create-super-admin

# 2. Start server
npm run dev &
SERVER_PID=$!

# 3. Wait for server
sleep 2

# 4. Get Super Admin token
LOGIN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@verdexis.com",
    "password": "Admin@Verdexis2024"
  }')

TOKEN=$(echo $LOGIN | jq -r '.token')
echo "Token: $TOKEN"

# 5. Create first admin
ADMIN=$(curl -X POST http://localhost:3000/api/admin/hierarchy/admins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "name": "Company Admin",
    "password": "SecurePass123"
  }')

ADMIN_ID=$(echo $ADMIN | jq -r '.admin.id')
echo "Admin ID: $ADMIN_ID"

# 6. Set as default for new users
export DEFAULT_ADMIN_ID=$ADMIN_ID

# 7. Run tests
npm run test-admin-hierarchy

# 8. Cleanup
kill $SERVER_PID
```

---

## 🆘 Quick Help

**I need to...** | **Run this**
---|---
Create Super Admin | `npm run create-super-admin`
Create a new admin | `curl -X POST .../admins [see above]`
Assign a user | `curl -X POST .../assign-user [see above]`
View admin's users | `curl .../admins/:id/users [see above]`
Test everything | `npm run test-admin-hierarchy`
Set auto-assignment | `export DEFAULT_ADMIN_ID=...`
Get my token | `curl .../auth/login [see above]`
Check server health | `curl .../health`

---

## 📞 Support

1. Check `ADMIN_HIERARCHY_SETUP.md` for detailed setup
2. Review `ADMIN_HIERARCHY_COMPLETE.md` for comprehensive docs
3. Run `npm run test-admin-hierarchy` to validate setup
4. Check logs: `tail -f server.log`
5. Test endpoint: `curl http://localhost:3000/api/health`

**Remember**: Copy-paste commands above, replace `$TOKEN`, `$USER_ID`, etc. with actual values!
