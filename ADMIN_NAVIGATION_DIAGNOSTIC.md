# 🔍 Admin Navigation Diagnostic Guide

## Issue
Cannot navigate to `/admin/users` - page redirects or doesn't load

## Possible Causes

### 1. Multi-Admin Hierarchy Permissions
The app has a **multi-admin hierarchy system** that might require special permissions.

### 2. Missing Admin Role
Your account might not have the `admin` role set in the database.

### 3. Auth Token Issues
JWT token might be invalid, expired, or missing the admin role.

### 4. Amplify Not Deployed Yet
Latest code changes may not be deployed to Amplify yet.

---

## Diagnostic Steps (Run These NOW)

### Step 1: Check Your Admin Status
Open browser DevTools (F12) and paste this in Console:

```javascript
// Check if you're marked as admin
const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
console.log('Your role:', auth.role)
console.log('Your email:', auth.email)
console.log('Full auth object:', auth)
```

**Expected output:**
```
Your role: admin
Your email: your@email.com
Full auth object: { id: "...", email: "your@email.com", role: "admin", ... }
```

**If role is "user":**
→ Go to Step 2

### Step 2: Check JWT Token
In Console:

```javascript
const token = localStorage.getItem('verdexis_token')
if (!token) {
  console.error('NO JWT TOKEN FOUND')
} else {
  // Decode JWT (copy the payload part)
  const parts = token.split('.')
  const payload = JSON.parse(atob(parts[1]))
  console.log('JWT Payload:', payload)
  console.log('User ID:', payload.sub)
  console.log('Expires at:', new Date(payload.exp * 1000))
}
```

**Expected:**
- Token exists
- `sub` (user ID) is present
- `exp` is in the future

**If missing or expired:**
→ Need to re-login

### Step 3: Check Backend Auth Response
In Console Network tab:

1. Press F12 → Network tab
2. Try to navigate to `/admin/users`
3. Look for request to `/api/auth/me`
4. Click on it → Response tab
5. Check what it returns

**Expected:**
```json
{
  "user": {
    "role": "admin",
    "id": "...",
    "email": "...",
    ...
  }
}
```

**If role is "user":**
→ Your account is not an admin in the database

**If 401/403 error:**
→ Token is invalid

### Step 4: Check Console Errors
In DevTools Console (F12):

Look for any red error messages when trying to navigate to `/admin/users`

Common errors:
- ❌ `"Admin access required"` → Your role is not admin
- ❌ `"Invalid or expired token"` → Token problem
- ❌ `"Cannot read properties of undefined"` → Code error

---

## Quick Fixes

### Fix 1: You're Not an Admin in Database

Your account needs admin role in database. Do this:

1. **In your server/db**, run:
```sql
-- Update your user to admin
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';

-- Verify
SELECT email, role FROM "User" WHERE email = 'your@email.com';
```

2. **Then in app**, log out and log back in:
   - Click Settings → Log Out
   - Log in again

### Fix 2: JWT Token Expired

```javascript
// Clear old token
localStorage.removeItem('verdexis_token')
localStorage.removeItem('verdexis_auth')
// Reload
location.reload()
// Log in again
```

### Fix 3: Amplify Not Deployed

Check AWS Amplify Console:
1. Go to: https://console.aws.amazon.com/amplify/
2. Find your app
3. Check "Deployments" tab
4. Look for latest commit `c7b7da6` (should have green checkmark)
5. If not there yet, wait 5-10 minutes

---

## The Multi-Admin Hierarchy System

Your app has a **multi-admin hierarchy** which includes:

✅ Super admins (you)  
✅ Sub-admins (created by you)  
✅ Managed users (assigned to admins)  
✅ Bank account management  
✅ Wallet details management  

This system is **optional** - you can ignore it if you just want basic admin access.

---

## Complete Diagnostic (Copy-Paste into Console)

```javascript
console.log('=== VERDEXIS ADMIN DIAGNOSTIC ===')

// 1. Check auth object
const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
console.log('✓ Auth Object:', {
  id: auth.id,
  email: auth.email,
  role: auth.role,
  kycStatus: auth.kycStatus
})

// 2. Check JWT token
const token = localStorage.getItem('verdexis_token')
if (token) {
  const parts = token.split('.')
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]))
    console.log('✓ JWT Valid:', {
      userId: payload.sub,
      expiresAt: new Date(payload.exp * 1000).toLocaleString(),
      isExpired: payload.exp < Date.now() / 1000
    })
  }
} else {
  console.error('✗ NO JWT TOKEN')
}

// 3. Check if you're admin
console.log('✓ Admin Status:', auth.role === 'admin' ? 'ADMIN ✓' : 'NOT ADMIN ✗')

// 4. Check localStorage keys
console.log('✓ LocalStorage Keys:', Object.keys(localStorage).filter(k => k.includes('verdexis')))

console.log('=== END DIAGNOSTIC ===')
```

Run this and paste the output back!

---

## If Admin Role is Missing

### Quick Fix via Database

If you have database access:

```sql
-- PostgreSQL
UPDATE "User" SET role = 'admin' 
WHERE email = 'your-email@example.com' OR username = 'your-username';

-- Or SQLite
UPDATE User SET role = 'admin'  
WHERE email = 'your-email@example.com';
```

Then log out and log back in.

### Via Backend API

If backend is running:

```bash
# Using curl
curl -X PATCH http://localhost:4000/api/admin/users/YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

## Testing Steps (After Fix)

1. **Clear cache:**
   ```
   F12 → Application → Clear site data
   Ctrl+Shift+R (hard refresh)
   ```

2. **Log out:**
   Settings → Log Out

3. **Log back in:**
   Use your credentials

4. **Check status:**
   ```javascript
   JSON.parse(localStorage.getItem('verdexis_auth')).role
   // Should show: "admin"
   ```

5. **Try navigation:**
   Click admin menu items or go to `/admin/users`

---

## What Should Happen (When Fixed)

```
1. You navigate to: /admin/users
2. Page shows loading spinner for 1-2 seconds
3. Admin Users table appears with:
   - User list
   - Search/filter boxes
   - Bulk action controls
   - Create user button
4. NO REDIRECT TO DASHBOARD ✓
```

---

## Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Admin access required" | Not admin role | Update DB, re-login |
| "Invalid or expired token" | Old JWT | Clear cache, re-login |
| Page redirects to /dashboard | Role check failed | Check auth status above |
| Blank page / loading forever | Deployment issue | Wait for Amplify deployment |
| 401 Unauthorized | No token | Re-login |
| 403 Forbidden | Not admin on backend | Update DB role |

---

## Debug Checklist

Run these checks in order:

- [ ] Open DevTools (F12)
- [ ] Check Console tab for errors
- [ ] Run diagnostic script above
- [ ] Verify `auth.role === 'admin'`
- [ ] Verify JWT token exists
- [ ] Verify JWT not expired
- [ ] Check `/api/auth/me` response in Network tab
- [ ] Confirm response shows `role: 'admin'`
- [ ] If not, update database
- [ ] Clear cache: Ctrl+Shift+R
- [ ] Re-login
- [ ] Try navigation again

---

## Still Not Working?

Do this in order:

1. **Clear everything:**
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

2. **Log in fresh:**
   - Use your admin email/password
   - Let it complete fully

3. **Check database directly:**
   - Connect to your database
   - Verify your user has `role = 'admin'`
   - If not, update it

4. **Check backend running:**
   ```bash
   curl http://localhost:4000/api/health
   # Should return: {"ok": true}
   ```

5. **Check Amplify deployment:**
   - AWS Amplify Console
   - Look for green checkmark
   - If red, check build logs

6. **If still stuck:**
   - Check browser console (F12) for JavaScript errors
   - Check backend logs for auth errors
   - Run diagnostic script above and share output

---

## Admin Pages URL Mapping

Once working, these should all load:

```
https://main.d28t5x0lqjdtjj.amplifyapp.com/admin          → Admin Dashboard
https://main.d28t5x0lqjdtjj.amplifyapp.com/admin/users    → User Management
https://main.d28t5x0lqjdtjj.amplifyapp.com/admin/audit    → Audit Log
https://main.d28t5x0lqjdtjj.amplifyapp.com/admin/settings → Admin Settings
https://main.d28t5x0lqjdtjj.amplifyapp.com/admin/transfer → Admin Transfer
```

If any redirect to dashboard, that's a permission issue.

---

## Next Actions

1. **Run the diagnostic** (copy-paste into console)
2. **Share the output** with me
3. **Check your database** - are you marked as admin?
4. **If not** - update the role via SQL
5. **Then** - log out, log in, try again

Let me know what the diagnostic shows!
