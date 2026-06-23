# KYC Enhancement & Security Hardening

## Overview
Complete overhaul of KYC system with enterprise-grade security, rate limiting, and progressive tier system.

## 🔐 Security Improvements

### 1. CSRF Protection
- ✅ CSRF tokens required for all state-changing endpoints (POST/DELETE)
- ✅ New `/kyc/csrf-token` endpoint to retrieve tokens
- ✅ Validated on backend using `csurf` middleware

### 2. Rate Limiting
- ✅ **KYC Submissions**: 10 per day per user
- ✅ **Document Uploads**: 100 per day per user
- ✅ Smart key generation based on user ID or IP

### 3. File Size Limits
- ✅ Reduced from 10MB to **8MB** per file
- ✅ DoS protection against large file uploads
- ✅ Validation at middleware level

### 4. File Validation
- ✅ Mime type checking (JPEG, PNG, PDF only)
- ✅ Magic number validation (prevent spoofed files)
- ✅ Corrupted file detection

## 📊 KYC Tier System

### Tier Progression
```
UNVERIFIED → TIER_1 → TIER_2 → TIER_3
```

### Tier Details

#### UNVERIFIED (No KYC)
- Daily Withdraw: $100
- Monthly Withdraw: $500
- Daily Transfer: $500
- Monthly Transfer: $2,000
- Max Trade Size: $1,000
- Requirements: None

#### TIER_1 (Basic)
- Daily Withdraw: $5,000
- Monthly Withdraw: $50,000
- Daily Transfer: $10,000
- Monthly Transfer: $100,000
- Max Trade Size: $50,000
- Requirements: Identity + Selfie

#### TIER_2 (Full)
- Daily Withdraw: $50,000
- Monthly Withdraw: $500,000
- Daily Transfer: $100,000
- Monthly Transfer: $1,000,000
- Max Trade Size: $500,000
- Requirements: Identity + Address + Selfie (Auto-assigned on submission)

#### TIER_3 (Enhanced)
- Daily Withdraw: $250,000
- Monthly Withdraw: $5,000,000
- Daily Transfer: $500,000
- Monthly Transfer: $10,000,000
- Max Trade Size: $5,000,000
- Requirements: Tier 2 + Admin Review (Manual approval only)

## 🔄 Flow

### KYC Submission Flow
1. Get CSRF token from `/kyc/csrf-token`
2. User uploads documents (10-100 per day limit)
3. User submits KYC form with CSRF token
4. System validates all documents present
5. User automatically assigned to TIER_2 (pending admin review)
6. Admin can approve/reject in admin panel
7. If approved: User stays in TIER_2 or escalates to TIER_3
8. If rejected: User reverts to UNVERIFIED

### Tier Limit Checking
Before any transaction, system checks:
```typescript
await checkTierLimit(userId, 'withdraw', amount)
// Returns: { allowed: boolean, reason?: string }
```

## 📝 Database Changes

### New User Fields
```sql
ALTER TABLE "User" ADD COLUMN "kycTier" VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "User" ADD COLUMN "kycTierUpdatedAt" TIMESTAMP(3);

-- Existing fields updated:
-- dailyWithdrawLimit (now synced with tier)
-- monthlyWithdrawLimit (now synced with tier)
-- dailyTransferLimit (now synced with tier)
-- monthlyTransferLimit (now synced with tier)
```

## 🚀 API Endpoints

### Public Endpoints
```
GET  /kyc/csrf-token                    - Get CSRF token
GET  /kyc/status                        - Get user's KYC status & tier
GET  /kyc/tier                          - Get user's current tier & limits
```

### Protected Endpoints (with CSRF)
```
POST /kyc/upload/:documentType          - Upload document (8MB max)
POST /kyc/submit                        - Submit complete KYC
GET  /kyc/documents                     - List uploaded documents
DELETE /kyc/document/:id                - Delete document (CSRF protected)
```

### Rate Limits
```
POST /kyc/upload   - 100/day per user
POST /kyc/submit   - 10/day per user
```

## 🛠️ Implementation Files

### Backend
- `server/src/routes/kyc-enhanced.ts` - Enhanced KYC routes with security
- `server/src/kycServiceEnhanced.ts` - KYC service with tier management
- `server/prisma/migrations/20250115000000_add_kyc_tiers/migration.sql` - Database migration

### Frontend
- `app/src/pages/KYCEnhanced.tsx` - Enhanced KYC UI with tier display

## 📋 Integration Steps

### 1. Install Dependencies
```bash
npm install csurf express-rate-limit
# or
yarn add csurf express-rate-limit
```

### 2. Run Database Migration
```bash
npm run db:migrate
# or
prisma migrate deploy
```

### 3. Update Express App
```typescript
import csrf from 'csurf'
import rateLimit from 'express-rate-limit'

// Add to main app.ts
app.use(express.urlencoded({ extended: false }))
app.use(csrf({ cookie: false }))
```

### 4. Import Enhanced Routes
```typescript
import kycRouter from './routes/kyc-enhanced.js'
app.use('/api/kyc', kycRouter)
```

### 5. Use Enhanced Frontend
Replace KYC.tsx with KYCEnhanced.tsx in routing

## 🔍 Security Checklist

- ✅ CSRF protection on all state-changing endpoints
- ✅ Rate limiting prevents spam/brute force
- ✅ File size limits prevent DoS
- ✅ File type validation prevents malicious uploads
- ✅ Magic number validation prevents spoofed files
- ✅ AES-256-GCM SSN encryption with auth tags
- ✅ Tier-based withdrawal/transfer limits
- ✅ Admin audit logging for all KYC actions
- ✅ User session validation on all endpoints

## 📊 Monitoring

### Audit Log Actions
- `kyc_submitted` - User submitted KYC
- `kyc_approved` - Admin approved KYC
- `kyc_rejected` - Admin rejected KYC
- `kyc_tier_updated` - Tier automatically updated

### Rate Limit Headers
All responses include standard headers:
```
RateLimit-Limit: 10
RateLimit-Remaining: 9
RateLimit-Reset: 1673568000
```

## 🔧 Configuration

### Environment Variables
```bash
# Use default from JWT_SECRET, or override:
KYC_ENCRYPTION_KEY=your-32-byte-hex-key

# Rate limit configuration in routes
# Can be customized:
RATE_LIMIT_SUBMIT=10         # per day
RATE_LIMIT_UPLOAD=100        # per day
```

## 🚨 Known Limitations

1. **Admin Tier 3 Assignment**: Must be done manually by admin (not auto-approved)
2. **SSN Decryption**: Requires KYC_ENCRYPTION_KEY or JWT_SECRET in env
3. **File Storage**: Implement `storeDocument()` from documentService.ts
4. **Email Notifications**: Implement email service for approval/rejection

## 🔄 Migration Path from Old KYC

```typescript
// Script to migrate existing users
async function migrateExistingKyc() {
  const users = await prisma.user.findMany({
    where: { kycStatus: 'approved' }
  })
  
  for (const user of users) {
    await updateUserTier(user.id)
  }
}
```

## 📚 References

- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CWE-352: CSRF](https://cwe.mitre.org/data/definitions/352.html)
- [Express Rate Limiting](https://github.com/nfriedly/express-rate-limit)
- [csurf Middleware](https://github.com/expressjs/csurf)

---

**Last Updated**: January 2025
**Version**: 2.0 (Enhanced with Security & Tiers)
