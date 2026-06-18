# Passkeys Implementation

## Overview
Passkeys allow users to authenticate using biometrics (fingerprint, Face ID) or hardware security keys instead of passwords. This implementation uses the WebAuthn standard.

## Features
- ✅ Register passkeys (fingerprint, Face ID, hardware keys)
- ✅ Authenticate with passkeys
- ✅ Manage multiple passkeys per user
- ✅ View passkey usage history
- ✅ Delete passkeys
- ✅ Cross-platform support (desktop, mobile, tablets)

## Tech Stack
### Backend
- `@simplewebauthn/server` - WebAuthn server-side verification
- Prisma ORM with PostgreSQL
- Express.js routes

### Frontend
- `@simplewebauthn/browser` - WebAuthn client-side handling
- React 19
- TypeScript

## Database Schema
```prisma
model Passkey {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  credentialId     String   @unique
  publicKey        String
  counter          Int      @default(0)
  transports       String?
  deviceName       String?
  lastUsedAt       DateTime?
  createdAt        DateTime @default(now())

  @@index([userId])
}
```

## API Endpoints

### GET `/api/passkeys`
List all passkeys for the authenticated user.

**Response:**
```json
{
  "passkeys": [
    {
      "id": "clx...",
      "credentialId": "base64url...",
      "deviceName": "iPhone 15",
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

### POST `/api/passkeys/register/options`
Start passkey registration. Returns WebAuthn creation options.

**Response:**
```json
{
  "options": {
    "challenge": "...",
    "rp": { "name": "Verdexis", "id": "localhost" },
    "user": { "id": "...", "name": "user@example.com", "displayName": "User" },
    ...
  }
}
```

### POST `/api/passkeys/register/verify`
Complete passkey registration.

**Request:**
```json
{
  "response": { /* WebAuthn credential response */ },
  "deviceName": "iPhone 15"
}
```

**Response:**
```json
{
  "verified": true,
  "passkey": {
    "id": "clx...",
    "deviceName": "iPhone 15"
  }
}
```

### POST `/api/passkeys/auth/options`
Start passkey authentication. Returns WebAuthn request options.

**Request:**
```json
{
  "email": "user@example.com"  // Optional
}
```

**Response:**
```json
{
  "options": {
    "challenge": "...",
    "rpId": "localhost",
    ...
  }
}
```

### POST `/api/passkeys/auth/verify`
Complete passkey authentication.

**Request:**
```json
{
  "response": { /* WebAuthn credential response */ }
}
```

**Response:**
```json
{
  "verified": true,
  "token": "jwt...",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "User",
    "role": "user"
  }
}
```

### DELETE `/api/passkeys/:id`
Delete a passkey.

**Response:**
```json
{
  "ok": true
}
```

## Frontend Usage

### Check Support
```typescript
import { isPasskeySupported } from '@/lib/passkeys'

if (isPasskeySupported()) {
  // Show passkey UI
}
```

### Register a Passkey
```typescript
import { registerPasskey } from '@/lib/passkeys'

const passkey = await registerPasskey('My iPhone')
// User will be prompted for biometric/PIN
```

### Authenticate with Passkey
```typescript
import { authenticateWithPasskey } from '@/lib/passkeys'

const { token, user } = await authenticateWithPasskey('user@example.com')
// Store token and redirect to dashboard
```

### List Passkeys
```typescript
import { listPasskeys } from '@/lib/passkeys'

const passkeys = await listPasskeys()
```

### Delete a Passkey
```typescript
import { deletePasskey } from '@/lib/passkeys'

await deletePasskey(passkeyId)
```

## User Flow

### Registration Flow
1. User logs in with email/password
2. Goes to Settings → Security
3. Clicks "Add passkey"
4. Enters device name (e.g., "iPhone 15")
5. Browser prompts for biometric/PIN
6. Passkey is registered and saved

### Authentication Flow
1. User clicks "Sign in with passkey" on login page
2. Optionally enters email (helps filter passkeys)
3. Browser prompts for biometric/PIN
4. User is authenticated and redirected to dashboard

## Security Features
- **Challenge-Response**: Prevents replay attacks
- **Origin Validation**: Ensures requests come from legitimate domain
- **Counter Verification**: Detects cloned authenticators
- **User Verification**: Requires biometric or PIN
- **Resident Keys**: Allows discoverable credentials
- **HTTPS Required**: WebAuthn only works on secure contexts

## Browser Support
- ✅ Chrome/Edge 67+
- ✅ Firefox 60+
- ✅ Safari 13+
- ✅ iOS Safari 14+
- ✅ Android Chrome 70+

## Testing

### Local Testing
Passkeys work on localhost without HTTPS for development.

### Production Requirements
- HTTPS is required
- Valid SSL certificate
- Proper `rpID` configuration (usually your domain)
- Proper `origin` configuration

## Configuration

### Environment Variables
```env
# server/.env
APP_BASE_URL=https://yourdomain.com
```

The `rpID` is automatically derived from `APP_BASE_URL` (e.g., "yourdomain.com").

## Troubleshooting

### "Passkeys not supported"
- Browser might be too old
- Not using HTTPS (except localhost)
- WebAuthn not available in incognito mode on some browsers

### "Challenge expired"
- User took too long to complete authentication
- Challenges expire after 5 minutes
- User should retry

### "Passkey not found"
- User might have deleted the passkey
- User might be on a different device
- User should use password login

## Future Enhancements
- [ ] Passkey-only accounts (no password required)
- [ ] Sync passkeys across devices (via platform providers)
- [ ] Conditional UI (show passkey option only if available)
- [ ] Platform authenticator detection
- [ ] Backup codes for passkey-only accounts
- [ ] Admin passkey management
- [ ] Passkey usage analytics

## References
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [SimpleWebAuthn Docs](https://simplewebauthn.dev/)
- [Passkeys.dev](https://passkeys.dev/)
- [FIDO Alliance](https://fidoalliance.org/)
