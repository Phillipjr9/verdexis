# ⚡ QUICK FIX - Admin Navigation Not Working

## Most Likely Issue
Your user account is **not marked as admin** in the database!

## Quick Diagnostic (2 seconds)

Open Browser DevTools (F12) and paste into Console:

```javascript
JSON.parse(localStorage.getItem('verdexis_auth')).role
```

**If it says `"admin"`** → Role is correct, issue is elsewhere  
**If it says `"user"`** → **THIS IS THE PROBLEM** - Need to update database

---

## THE FIX (3 steps)

### Step 1: Check Your Email/Username
```javascript
// Get your email from localStorage
JSON.parse(localStorage.getItem('verdexis_auth')).email
// Copy this - you'll need it
```

### Step 2: Update Database
Connect to your database (SQLite or PostgreSQL) and run:

**SQLite:**
```sql
UPDATE User SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
```

**PostgreSQL:**
```sql
UPDATE "User" SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
```

Replace `YOUR_EMAIL_HERE` with your actual email!

### Step 3: Log Out & Back In

1. Click **Settings** (gear icon)
2. Click **Log Out**
3. Log in again with your credentials
4. Now try `/admin/users`

---

## Verify the Fix Worked

In Console:
```javascript
JSON.parse(localStorage.getItem('verdexis_auth')).role
// Should now show: "admin"
```

---

## Still Not Working?

Run this diagnostic script in Console:

```javascript
const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
const token = localStorage.getItem('verdexis_token')
console.log('Email:', auth.email)
console.log('Role:', auth.role)
console.log('Has Token:', !!token)
```

Then check:
1. Is role `"admin"`?
2. Does it have a token?
3. Check `/api/auth/me` in Network tab - what does it return?

---

## If Database Update Doesn't Work

Try this SQL instead:

```sql
-- Show all users
SELECT id, email, role, suspended FROM User;

-- Find your user (by email)
SELECT * FROM User WHERE email = 'your-email@example.com';

-- Update to admin
UPDATE User SET role = 'admin' WHERE email = 'your-email@example.com';

-- Verify
SELECT email, role FROM User WHERE email = 'your-email@example.com';
```

---

## Multi-Admin Hierarchy Note

Your app has a **multi-admin system**, but it shouldn't block basic admin access.

If you're set as admin in database but still can't access pages, there might be a hierarchy permission issue.

Run full diagnostic: [ADMIN_NAVIGATION_DIAGNOSTIC.md](ADMIN_NAVIGATION_DIAGNOSTIC.md)

---

## Expected Result
Once fixed, this should work:
✅ Navigate to `/admin/users`  
✅ See admin users table  
✅ No redirect to dashboard  
✅ Can access all admin pages  

---

**Do this now:**
1. Open Console (F12)
2. Check your role
3. Update database if needed
4. Log out and back in
5. Try navigation again

Let me know if it works! 🚀
