# Admin Dashboard Quick Troubleshooting

## Issue: Clicking Admin Menu Items Redirects to Dashboard

### Quick Fix Checklist

- ✅ **Updated Navigation.tsx** - Admin menu now shows Users, Audit, Transfer, Settings
- ✅ **Updated RequireAdmin.tsx** - Better error handling and retry logic
- ✅ **No backend changes needed** - Auth middleware already works

### Steps to Verify Fix

1. **Clear browser cache**
   ```javascript
   // In DevTools Console:
   localStorage.clear()
   location.reload()
   ```

2. **Re-login as admin**
   - Log out: Click Settings → Log Out
   - Log in again with admin credentials

3. **Check admin role**
   ```javascript
   // In DevTools Console:
   JSON.parse(localStorage.getItem('verdexis_auth')).role
   // Should output: "admin"
   ```

4. **Verify token exists**
   ```javascript
   // In DevTools Console:
   localStorage.getItem('verdexis_token')
   // Should output: "eyJ..." (long JWT)
   ```

### Test Each Admin Page

| Page | URL | Expected |
|------|-----|----------|
| Users | `/admin/users` | User list table |
| Audit | `/admin/audit` | Audit log entries |
| Transfer | `/admin/transfer` | Transfer form |
| Settings | `/admin/settings` | Settings panel |

### Common Issues

**Issue: Still getting redirected**

1. Check backend is running: `npm run dev` in `/server` directory
2. Verify token in browser console (see step 4 above)
3. Check network tab in DevTools for `/api/auth/me` response
4. Look for error messages in browser console

**Issue: Admin nav items not showing**

1. Make sure you're logged in as admin (role = "admin")
2. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. Clear browser storage: Open Settings → Clear site data

**Issue: Pages load but blank**

1. Check browser console for JavaScript errors
2. Check network tab for failed API requests
3. Verify backend is responding to admin routes:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:4000/api/admin/stats
   ```

### Debug: Check Your Credentials

```javascript
// In DevTools Console - Copy-paste all at once:
(function() {
  const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
  const token = localStorage.getItem('verdexis_token')
  console.log('User:', auth.email)
  console.log('Role:', auth.role)
  console.log('Token exists:', !!token)
  console.log('Token length:', token?.length)
  console.log('Full auth:', auth)
})()
```

Expected output:
```
User: admin@example.com
Role: admin
Token exists: true
Token length: 200+ (usually 500+ characters)
```

### Mobile Menu Check

On mobile/tablet:
1. Tap hamburger icon (three lines)
2. Scroll down in menu
3. Admin items should appear below main nav
4. Tap any admin link (e.g., "Users")
5. Should navigate to `/admin/users`

### Still Not Working?

1. **Restart frontend**: `npm run dev` in `/app` directory
2. **Restart backend**: `npm run dev` in `/server` directory  
3. **Clear everything**: 
   - Delete browser cache and cookies
   - Log out and log back in
4. **Check backend logs** for auth errors

### Verify Backend Auth Middleware

The backend has these protections in place (no changes needed):

```typescript
router.use(adminLimiter)  // Rate limit
router.use(requireAuth)   // Check JWT valid
router.use(requireAdmin)  // Check role === 'admin'
```

If `/api/auth/me` returns 401 or 403, your token is invalid or you're not admin.

---

**Everything should work now!** The fix is minimal and only adds missing navigation links + retry logic for auth validation.
