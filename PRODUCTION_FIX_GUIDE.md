## PRODUCTION FIX GUIDE

### STEP 1: Update Prisma Schema

Add these models to `prisma/schema.prisma`:

```prisma
// KYC & Compliance
model KYCDocument {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  type String // passport, driver_license, national_id, residence_permit
  documentNumber String
  documentUrl String
  issuedAt DateTime
  expiresAt DateTime
  country String
  status String @default("pending") // pending, approved, rejected, expired
  uploadedAt DateTime @default(now())
  verifiedAt DateTime?
  verifiedBy String?
  rejectionReason String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, type])
  @@index([userId])
  @@index([status])
}

model LivenessCheck {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  status String @default("pending") // pending, passed, failed
  score Float @default(0)
  attempts Int @default(0)
  createdAt DateTime @default(now())
  completedAt DateTime?

  @@index([userId])
  @@index([status])
}

model RiskScore {
  userId String @id
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  score Int @default(0)
  level String @default("low") // low, medium, high, critical
  factors String[] @default([])
  updatedAt DateTime @updatedAt
}

// API Management
model APIKey {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  name String
  keyPrefix String
  keyHash String @unique
  permissions String[] @default(["read"])
  rateLimit Int @default(1000)
  active Boolean @default(true)
  lastUsedAt DateTime?
  createdAt DateTime @default(now())
  expiresAt DateTime?
  usage APIKeyUsage[]

  @@index([userId])
  @@index([active])
}

model APIKeyUsage {
  id String @id @default(cuid())
  apiKeyId String
  apiKey APIKey @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)
  endpoint String
  method String
  statusCode Int
  createdAt DateTime @default(now())

  @@index([apiKeyId])
  @@index([createdAt])
}

// Audit & Compliance
model AuditLog {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  action String
  resource String
  resourceId String
  changes String // JSON
  ipAddress String
  userAgent String
  status String @default("success") // success, failure
  errorMessage String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}

model UserAction {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  action String
  details String // JSON
  ipAddress String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([action])
}

// Rate Limiting
model RateLimitLog {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint String
  statusCode Int
  createdAt DateTime @default(now())

  @@index([userId, endpoint, createdAt])
  @@index([createdAt])
}

// Webhooks
model Webhook {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  url String
  events String[] @default([])
  secretHash String
  active Boolean @default(true)
  lastTriggeredAt DateTime?
  failureCount Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([active])
}

// Loyalty & Referrals
model UserLoyalty {
  userId String @id
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  points Int @default(0)
  tier String @default("Bronze")
  totalSpent Float @default(0)
  referralsCount Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Trading
model Order {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol String
  type String // market, limit, stop_loss, take_profit
  side String // buy, sell
  amount Float
  basePrice Float
  stopPrice Float?
  status String @default("pending") // pending, filled, partially_filled, cancelled, expired
  filledAmount Float @default(0)
  expiresAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  cancelledAt DateTime?

  @@index([userId])
  @@index([symbol])
  @@index([status])
}

// Device Management
model TrustedDevice {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  fingerprint String
  deviceName String
  ipAddress String
  lastSeenAt DateTime @default(now())
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, fingerprint])
  @@index([userId])
  @@index([expiresAt])
}

model LoginAttempt {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  success Boolean
  ipAddress String
  userAgent String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([success])
  @@index([createdAt])
}
```

### STEP 2: Update User Model

Add these fields to the User model:

```prisma
model User {
  // ... existing fields ...
  
  // Phone verification
  phoneVerified Boolean @default(false)
  phoneVerifiedAt DateTime?
  
  // Liveness verification
  livenessVerified Boolean @default(false)
  livenessVerifiedAt DateTime?
  
  // Relations to new models
  kycDocuments KYCDocument[]
  livenessChecks LivenessCheck[]
  riskScore RiskScore?
  apiKeys APIKey[]
  auditLogs AuditLog[]
  userActions UserAction[]
  rateLimitLogs RateLimitLog[]
  webhooks Webhook[]
  loyalty UserLoyalty?
  orders Order[]
  trustedDevices TrustedDevice[]
  loginAttempts LoginAttempt[]
}
```

### STEP 3: Run Database Migration

```bash
cd server
npx prisma migrate dev --name add_kyc_compliance_trading_models
```

### STEP 4: Install Missing Dependencies

```bash
npm install @aws-sdk/client-cognito-identity-provider
```

### STEP 5: Update Service Method Calls

All services use static methods. Update routes to call them correctly:

**Before:**
```typescript
const result = await analyticsService.getUserMetrics()
```

**After:**
```typescript
const result = await AnalyticsService.getUserMetrics()
```

Apply this pattern to all services:
- `TOTPService`
- `APIKeyService`
- `AnalyticsService`
- `WebhookService`
- `RateLimitService`
- `AuditComplianceService`
- `AdvancedTradingService`
- `WalletService`
- `AdminDashboardService`
- `ReferralLoyaltyService`
- `DataExportService`
- `KYCService`
- `NotificationService`
- `DeviceFingerprintService`

### STEP 6: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Should show 0 errors.

### STEP 7: Run Tests

```bash
npm test
```

### STEP 8: Production Deployment

```bash
npm run build
npm start
```

---

## VERIFICATION CHECKLIST

- [ ] Prisma schema updated
- [ ] Database migrations applied
- [ ] AWS SDK installed
- [ ] All route files updated
- [ ] TypeScript compilation passes
- [ ] Tests passing
- [ ] No console errors
- [ ] All endpoints responding
- [ ] Database connections working
- [ ] Ready for production

---

## ROLLBACK PLAN

If issues occur in production:

1. Revert database migration:
   ```bash
   npx prisma migrate resolve --rolled-back add_kyc_compliance_trading_models
   ```

2. Revert code changes:
   ```bash
   git revert <commit-hash>
   ```

3. Restart server:
   ```bash
   npm start
   ```

---

## MONITORING

After deployment, monitor:
- Error logs
- Database connection pool
- API response times
- Rate limit hits
- Webhook delivery success rate
- Audit log volume

---

Estimated time to complete: 2-3 hours
