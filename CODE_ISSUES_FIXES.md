# Code Issues - Fixes Applied

**Final Scan Results**: 10 issues identified and reported to Code Issues Panel  
**Severity Breakdown**: 3 HIGH, 5 MEDIUM, 2 LOW  
**Status**: Ready for fixing

---

## Critical Issues (HIGH SEVERITY - Fix Immediately)

### 1. Race Condition: Username Availability Check ⚠️
**File**: `server/src/routes/profile.ts` (Lines 35-45)  
**Severity**: HIGH  
**Impact**: Two concurrent requests could create duplicate usernames

**Problem**:
```typescript
const taken = await prisma.user.findFirst({ where: { username: parsed.data.username, NOT: { id: userId } } })
if (taken) { res.status(409).json({ error: 'That username is already taken' }); return }
// ... later database write happens
data.username = parsed.data.username
```

**Fix**: Use database-level unique constraint with error handling:
```typescript
if (parsed.data.username !== undefined) {
  try {
    data.username = parsed.data.username
    // Let the database enforce uniqueness - Prisma will throw P2002
  } catch (e) {
    if (e instanceof Error && e.message.includes('P2002')) {
      res.status(409).json({ error: 'That username is already taken' })
      return
    }
    throw e
  }
}
```

---

### 2. Race Condition: Alert Trigger Check ⚠️
**File**: `server/src/routes/alerts.ts` (Lines 95-110)  
**Severity**: HIGH  
**Impact**: Alert state inconsistent if notification fails

**Problem**:
```typescript
// Update alert state
await prisma.priceAlert.update({
  where: { id: alert.id },
  data: { triggered: true, triggeredAt: new Date(), active: false },
})
// ... then create notification (can fail!)
await prisma.notification.create(...)
```

**Fix**: Make both operations atomic:
```typescript
await prisma.$transaction([
  prisma.priceAlert.update({
    where: { id: alert.id },
    data: { triggered: true, triggeredAt: new Date(), active: false },
  }),
  prisma.notification.create({
    data: {
      userId,
      kind: 'alert',
      title: `${alert.name} ${alert.direction} $${alert.target}`,
      body: `Current price: $${tick.price.toFixed(2)}`,
    },
  }),
])
triggered.push(alert)
```

---

### 3. Missing Transaction Rollback Protection ⚠️
**File**: `server/src/routes/admin.ts` (Lines 800-850)  
**Severity**: HIGH  
**Impact**: User debited but never notified if notification fails

**Problem**:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // ... balance updated here ...
  return { balance, transaction }
})
// Notification OUTSIDE transaction
if (parsed.data.notify) {
  await prisma.notification.create(...).catch(() => {}) // Fails silently!
}
```

**Fix**: Include notification in transaction or use compensating action:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // ... balance update ...
  const balance = await tx.walletBalance.upsert(...)
  const transaction = await tx.transaction.create(...)
  
  // Create notification in same transaction
  if (parsed.data.notify) {
    await tx.notification.create({
      data: { userId, kind: 'deposit', title: `...`, body: `...` },
    })
  }
  return { balance, transaction }
})
```

---

## Medium Priority Issues (MEDIUM SEVERITY - Fix Next Sprint)

### 4. Silent Audit Logging Failures 📋
**File**: `server/src/routes/admin.ts` (Lines 80-90)  
**Severity**: MEDIUM  
**Impact**: Compliance audit trail loss, undetected issues

**Problem**:
```typescript
async function audit(actorId: string, action: string, targetUserId: string | null, payload: unknown) {
  try {
    await prisma.adminAudit.create(...)
  } catch (e) {
    console.error('[admin audit] failed:', e)  // Silently swallows error
  }
}
```

**Fix**: Log failures but notify admins:
```typescript
async function audit(actorId: string, action: string, targetUserId: string | null, payload: unknown) {
  try {
    await prisma.adminAudit.create({
      data: {
        actorId,
        action,
        targetUserId: targetUserId ?? undefined,
        payload: payload === undefined ? null : JSON.stringify(payload).slice(0, 4000),
      },
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error('[admin audit] CRITICAL: audit logging failed', {
      action,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    })
    // TODO: Send alert to admin monitoring
  }
}
```

---

### 5. Unsafe JSON Parsing Without Type Safety 🔒
**File**: `server/src/routes/admin.ts` (Lines 110-120)  
**Severity**: MEDIUM  
**Impact**: Runtime errors, potential security issues

**Problem**:
```typescript
let prefs: Record<string, unknown> = {}
try { if (u.prefs) prefs = JSON.parse(u.prefs) } catch { prefs = {} }
// prefs could contain anything - no type validation
const security = (typeof prefs.security === 'object' && prefs.security) ? prefs.security : {}
```

**Fix**: Use Zod validation:
```typescript
import { z } from 'zod'

const prefsSchema = z.object({
  security: z.object({
    lastLogin: z.object({
      at: z.string(),
      ip: z.string(),
      geo: z.object({
        country: z.string().optional(),
        // ... other fields
      }).optional(),
    }).optional(),
  }).optional(),
}).passthrough()

let prefs: Record<string, unknown> = {}
try {
  if (u.prefs) {
    const parsed = JSON.parse(u.prefs)
    prefs = prefsSchema.parse(parsed)
  }
} catch (e) {
  console.error('Invalid prefs JSON:', e)
  prefs = {}
}
```

---

### 6. Unchecked Array Access 🔢
**File**: `server/src/routes/admin.ts` (Lines 55-65)  
**Severity**: MEDIUM  
**Impact**: Potential undefined reference errors

**Problem**:
```typescript
const [total, users] = await Promise.all([...])
const hydrated = users.map((u) => {
  // ... if users is empty or undefined, this could fail
})
```

**Fix**: Add validation:
```typescript
const [total, users] = await Promise.all([...])
if (!Array.isArray(users)) {
  res.status(500).json({ error: 'Invalid database response' })
  return
}
const hydrated = users.map((u) => {
  const { lastLoginAt, lastLoginIp, lastLoginGeo } = readLastLoginMeta(u.prefs)
  const { prefs: _prefs, ...rest } = u
  return { ...rest, lastLoginAt, lastLoginIp, lastLoginGeo }
})
```

---

### 7. Missing Future Timestamp Validation ⏰
**File**: `server/src/routes/admin.ts` (Lines 190-200)  
**Severity**: MEDIUM  
**Impact**: Data integrity issues, incorrect transaction timestamps

**Problem**:
```typescript
const { createdAt, ...rest } = parsed.data
// createdAt could be in the future!
const data: Record<string, unknown> = { ...rest }
if (createdAt) data.createdAt = new Date(createdAt)
```

**Fix**: Validate timestamp bounds:
```typescript
const { createdAt, ...rest } = parsed.data
const data: Record<string, unknown> = { ...rest }

if (createdAt) {
  const ts = new Date(createdAt)
  const now = new Date()
  
  if (isNaN(ts.getTime())) {
    res.status(400).json({ error: 'Invalid createdAt timestamp' })
    return
  }
  
  if (ts.getTime() > now.getTime()) {
    res.status(400).json({ error: 'createdAt cannot be in the future' })
    return
  }
  
  data.createdAt = ts
}
```

---

## Low Priority Issues (LOW SEVERITY - Nice-to-Have)

### 8. Redundant Validation Check ✓
**File**: `server/src/routes/holdings.ts` (Lines 50-55)  
**Severity**: LOW  
**Impact**: Code clarity, small performance impact

**Problem**:
```typescript
const parsed = upsertSchema.safeParse(req.body)
// Schema already validates: amount: z.number().nonnegative()
// avgPrice: z.number().nonnegative()

if (amount < 0 || avgPrice < 0) {
  res.status(400).json({ error: 'Amount and avgPrice cannot be negative' })
  return
}
```

**Fix**: Remove redundant check:
```typescript
const parsed = upsertSchema.safeParse(req.body)
if (!parsed.success) {
  res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
  return
}

const { symbol, name, amount, avgPrice, type } = parsed.data
// Zod already validated amounts are non-negative - no need for extra check

const holding = await prisma.holding.upsert(...)
```

---

### 9. Inefficient Regex and toLowerCase Chaining 🔤
**File**: `server/src/routes/profile.ts` (Lines 8-10)  
**Severity**: LOW  
**Impact**: Code clarity, minor performance

**Problem**:
```typescript
username: z.string()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9_.-]+$/)
  .toLowerCase()  // Applied AFTER regex - inefficient
```

**Fix**: Use case-insensitive regex or reorder:
```typescript
username: z.string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9_.-]+$/i)  // Case-insensitive flag
  .toLowerCase()
```

---

### 10. Overly Broad Error Handling 🐛
**File**: `server/src/routes/watchlist.ts` (Lines 42-50)  
**Severity**: LOW  
**Impact**: Harder to debug, masks real errors

**Problem**:
```typescript
try {
  const item = await prisma.watchlist.upsert(...)
  res.json({ item })
} catch (e) {
  res.status(500).json({ error: 'Could not save watchlist item' })
}
```

**Fix**: Differentiate error types:
```typescript
try {
  const item = await prisma.watchlist.upsert(...)
  res.json({ item })
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  
  if (msg.includes('P2002') || msg.includes('Unique constraint')) {
    res.status(409).json({ error: 'That item is already in your watchlist' })
  } else if (msg.includes('validation')) {
    res.status(400).json({ error: 'Invalid watchlist item' })
  } else {
    console.error('[watchlist] unexpected error:', msg)
    res.status(500).json({ error: 'Could not save watchlist item' })
  }
}
```

---

## Summary of Fixes

| Issue | Severity | Type | Fix Time |
|-------|----------|------|----------|
| 1. Username race condition | HIGH | Critical | 30 min |
| 2. Alert trigger race condition | HIGH | Critical | 30 min |
| 3. Missing transaction rollback | HIGH | Critical | 45 min |
| 4. Silent audit failures | MEDIUM | Enhancement | 20 min |
| 5. Unsafe JSON parsing | MEDIUM | Security | 45 min |
| 6. Unchecked array access | MEDIUM | Reliability | 15 min |
| 7. Future timestamp validation | MEDIUM | Data integrity | 20 min |
| 8. Redundant validation | LOW | Cleanup | 5 min |
| 9. Inefficient regex | LOW | Cleanup | 5 min |
| 10. Broad error handling | LOW | Improvement | 15 min |

**Total Estimated Fix Time**: 3-4 hours

---

## Implementation Priority

### Immediate (Today)
1. Fix username race condition (prevents data corruption)
2. Fix alert trigger race condition (prevents data corruption)
3. Fix transaction rollback issue (prevents user data loss)

### This Sprint
4. Fix audit logging failures (compliance requirement)
5. Fix unsafe JSON parsing (security issue)
6. Fix unchecked array access (stability)

### Next Sprint
7-10. Low priority cleanup and improvements

---

## Testing Checklist

After fixes are applied:

- [ ] Username uniqueness enforced (test concurrent PATCH requests)
- [ ] Alert triggering is atomic (test with notification failures injected)
- [ ] All money movements include notifications (verify audit logs)
- [ ] Audit logging catches and reports failures
- [ ] Prefs JSON parsing fails safely
- [ ] Array operations handle empty arrays
- [ ] Timestamps cannot be in future
- [ ] Error messages are specific, not generic

---

## Code Review Checklist

Before merging fixes:

- [ ] All try-catch blocks have meaningful error handling
- [ ] Database transactions are properly atomic
- [ ] No silent catch statements without logging
- [ ] Array operations have bounds checking
- [ ] Timestamp validation prevents future dates
- [ ] JSON parsing uses Zod validation
- [ ] Race conditions prevented with DB constraints or transactions
- [ ] Tests pass for all scenarios
