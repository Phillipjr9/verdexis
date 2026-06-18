# Passkeys Testing Guide

## Prerequisites
- ✅ Backend built successfully
- ✅ Frontend built successfully
- ✅ Database migration applied
- ✅ Browser that supports WebAuthn (Chrome 67+, Safari 13+, Firefox 60+)

## Test Scenarios

### Scenario 1: Register a Passkey (Settings)
**Goal**: User adds a passkey from Settings page

1. **Login** with email/password
   - Email: your test email
   - Password: your test password

2. **Navigate** to Settings
   - Click your avatar/name in top right
   - Select "Settings"

3. **Go to Security tab**
   - Click "Security" in left sidebar

4. **Add passkey**
   - Find "Passkeys" section
   - Click "Add passkey" button
   - Enter device name: `Test MacBook`
   - Browser will prompt for authentication

5. **Complete registration**
   - Use Touch ID / Face ID / Windows Hello / PIN
   - See success toast: "Passkey registered successfully"
   - Passkey appears in list with device name and creation date

**Expected Results**:
- ✅ Passkey appears in list
- ✅ Shows device name "Test MacBook"
- ✅ Shows creation date (today)
- ✅ Shows last used: "Never"

---

### Scenario 2: Sign In with Passkey
**Goal**: User logs in using registered passkey

1. **Logout**
   - Settings → Logout

2. **Click "Sign in with passkey"**
   - On login modal, click the passkey button
   - Browser will prompt for authentication

3. **Complete authentication**
   - Use Touch ID / Face ID / Windows Hello / PIN
   - No password needed!
   - Redirected to dashboard

**Expected Results**:
- ✅ No password prompt
- ✅ Fast authentication
- ✅ Redirected to dashboard
- ✅ User is logged in

---

### Scenario 3: Sign In with Passkey + Email
**Goal**: User provides email to filter passkeys

1. **Logout** again

2. **Enter email** in login form
   - Type your email (don't fill password)

3. **Click "Sign in with passkey"**
   - Browser uses email to filter available passkeys
   - Prompt appears for authentication

4. **Complete authentication**

**Expected Results**:
- ✅ Email helps filter passkeys (useful if multiple accounts)
- ✅ Authentication succeeds
- ✅ Logged in

---

### Scenario 4: View Passkey Usage
**Goal**: Check last used date updates

1. **After logging in with passkey**, go to Settings → Security

2. **View passkey list**
   - Should show last used date (today)
   - Counter should be > 0 (not visible in UI, but in database)

**Expected Results**:
- ✅ Last used date shows today
- ✅ Device name still correct

---

### Scenario 5: Delete a Passkey
**Goal**: User removes a passkey

1. **In Settings → Security → Passkeys**

2. **Click "Remove"** on a passkey
   - Confirmation dialog appears

3. **Confirm deletion**
   - Passkey disappears from list
   - Toast: "Passkey removed"

4. **Try to login with deleted passkey**
   - Should fail (browser won't find it)

**Expected Results**:
- ✅ Passkey removed from list
- ✅ Cannot use deleted passkey to login
- ✅ Other passkeys still work (if any)

---

### Scenario 6: Multiple Passkeys
**Goal**: User registers multiple devices

1. **Register passkey #1**: `MacBook Pro`
2. **Register passkey #2**: `iPhone 15`
3. **Register passkey #3**: `YubiKey`

4. **View all in Settings**
   - All 3 appear
   - Each shows unique name and date

5. **Login with any passkey**
   - Browser shows available options
   - Choose one
   - Login succeeds

**Expected Results**:
- ✅ All passkeys listed separately
- ✅ Can login with any passkey
- ✅ Can delete individual passkeys

---

## Edge Cases to Test

### Edge Case 1: Unsupported Browser
**Test in**: Old browser or incognito mode (some browsers)

**Expected**: 
- "Add passkey" button shows but displays error when clicked
- Error: "Passkeys are not supported on this device/browser"

### Edge Case 2: Cancel During Registration
**Steps**:
1. Click "Add passkey"
2. Cancel browser prompt (press ESC or click Cancel)

**Expected**:
- No error
- Passkey not registered
- Can try again

### Edge Case 3: Cancel During Login
**Steps**:
1. Click "Sign in with passkey"
2. Cancel browser prompt

**Expected**:
- Stay on login page
- Can try password instead
- No error shown

### Edge Case 4: No Passkeys Registered
**Steps**:
1. Fresh account with no passkeys
2. Try to login with passkey

**Expected**:
- Browser prompts for passkey
- If none registered, may show "no credentials" or allow platform to create one

### Edge Case 5: Challenge Expired
**Steps**:
1. Click "Sign in with passkey"
2. Wait 6+ minutes
3. Try to authenticate

**Expected**:
- Error: "Challenge expired"
- Can retry immediately

---

## API Testing (Advanced)

### Test Registration Options
```bash
curl -X POST http://localhost:4000/api/passkeys/register/options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{}'
```

**Expected Response**:
```json
{
  "options": {
    "challenge": "...",
    "rp": { "name": "Verdexis", "id": "localhost" },
    "user": { ... },
    ...
  }
}
```

### Test List Passkeys
```bash
curl http://localhost:4000/api/passkeys \
  -H "Authorization: Bearer YOUR_JWT"
```

**Expected Response**:
```json
{
  "passkeys": [
    {
      "id": "clx...",
      "credentialId": "...",
      "deviceName": "Test MacBook",
      "lastUsedAt": null,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Database Verification

### Check Passkey Table
```sql
-- Connect to your PostgreSQL database
SELECT * FROM "Passkey" WHERE "userId" = 'YOUR_USER_ID';
```

**Expected**:
- `credentialId`: Base64url string (unique)
- `publicKey`: Base64url string
- `counter`: Integer (increases with each use)
- `transports`: JSON array like ["internal"] or ["usb","nfc"]
- `deviceName`: Your friendly name
- `createdAt`: Timestamp
- `lastUsedAt`: NULL initially, then timestamp after first use

---

## Browser DevTools Inspection

### Registration Flow
1. Open DevTools (F12)
2. Go to Console
3. Click "Add passkey"
4. Watch console for:
   ```
   navigator.credentials.create(...)
   ```

### Authentication Flow
1. Click "Sign in with passkey"
2. Watch console for:
   ```
   navigator.credentials.get(...)
   ```

---

## Security Checks

### ✅ HTTPS Only (Production)
- Passkeys require HTTPS in production
- Localhost works for development

### ✅ Origin Validation
- Backend validates origin matches your domain
- Prevents phishing attacks

### ✅ Challenge-Response
- Each authentication uses a unique challenge
- Prevents replay attacks

### ✅ Counter Verification
- Counter increments with each use
- Detects cloned authenticators

---

## Troubleshooting

### Problem: "Passkeys not supported"
**Solution**: 
- Update browser to latest version
- Don't use incognito mode (varies by browser)
- Ensure HTTPS in production

### Problem: "Challenge expired"
**Solution**:
- User waited too long (5 min limit)
- Simply retry

### Problem: "Passkey not found"
**Solution**:
- User deleted passkey
- Wrong device (passkeys may not sync)
- Use password login instead

### Problem: Browser doesn't prompt
**Solution**:
- Check browser console for errors
- Ensure localStorage has valid JWT
- Check backend logs for errors

---

## Success Criteria

✅ **Registration works**
- User can register passkey from Settings
- Passkey appears in list with correct name
- Database has new Passkey row

✅ **Authentication works**
- User can login with passkey
- No password needed
- JWT is issued
- User redirected to dashboard

✅ **Management works**
- User can view all passkeys
- User can delete passkeys
- Last used date updates correctly

✅ **Security works**
- Origin validation passes
- Challenge expires after 5 min
- Counter increments
- Cannot use deleted passkeys

---

## Next: Production Testing

When deploying to production:
1. Update `APP_BASE_URL` in `server/.env`
2. Ensure HTTPS certificate is valid
3. Test on multiple devices
4. Test on multiple browsers
5. Monitor error logs for issues

---

**Happy Testing! 🎉**

All tests should pass. If any fail, check:
- Backend logs (`server/`)
- Browser console (F12)
- Network tab (API requests)
- Database (Passkey table)
