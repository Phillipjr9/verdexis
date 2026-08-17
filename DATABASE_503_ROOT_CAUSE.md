# Service 503 & Database Connection Issues - Root Cause Analysis

## Problem 1: "Service Temporarily Unavailable" Always Showing

### Root Cause
**The error logic in auth routes is INVERTED** - it returns 503 for NON-database errors instead of actual DB unavailability.

**Location**: `/server/src/routes/auth.ts`

```typescript
// WRONG (current code):
catch (dbError) {
  if (!isDbUnavailableError(dbError)) {  // If NOT a DB error
    res.status(503).json({ error: 'Service temporarily unavailable' })  // Return 503
    return
  }
}

// This is backwards! It returns 503 when the error is NOT from the database
```

**Fix Required**: Reverse the logic
```typescript
// CORRECT:
catch (dbError) {
  if (isDbUnavailableError(dbError)) {  // If IS a DB error
    res.status(503).json({ error: 'Database unavailable' })  // Return 503
    return
  }
  // If NOT a DB error, log it but let the request continue or return 500
  console.error('Non-database error:', dbError)
}
```

---

## Problem 2: Database Connects Over and Over Again

### Root Cause
The database initialization logic has a RETRY LOOP that keeps trying to reconnect:

**Location**: `/server/src/db.ts` lines 138-171

```typescript
async function ensureConnection() {
  while (connectionAttempts < MAX_RETRIES) {  // Loops 3 times max
    try {
      await currentPrismaClient.$connect()
      await currentPrismaClient.$queryRaw`SELECT 1`
      return  // Success, exit loop
    } catch (err) {
      connectionAttempts++
      // ... delay and retry
    }
  }
}
```

**Why It Keeps Retrying**:
1. On Render, database connections sometimes fail initially
2. The code retries 3 times with exponential backoff
3. Each retry waits: 2s → 4s → 8s (max 10s)
4. This happens on EVERY SERVER STARTUP
5. If using SQLite fallback, it keeps trying Postgres

**Additionally**:
- `waitForDatabaseInitialization()` is called BEFORE EVERY QUERY
- If DB is down, EVERY request waits for this timeout
- No caching of the connection status
- Each request re-checks the connection state

---

## Why Render Backend Has Connection Issues

### Issue 1: Cold Starts
Render free tier has 15-minute auto-shutdown. On restart:
- Database hasn't been pinged
- Connection pool is cold
- Network might need warm-up
- SSL handshake takes time

### Issue 2: Ephemeral Storage
Render spins up new containers. If using SQLite:
- File is created fresh each startup
- Previous data is lost
- Schema must be re-applied
- No persistence between restarts

### Issue 3: PostgreSQL Connection Pool Exhaustion
If PostgreSQL is external:
- Limited connection slots (default 20)
- Each retry creates a new connection attempt
- Timeout settings too aggressive
- No connection pooling middleware (PgBouncer)

### Issue 4: DATABASE_URL Configuration
Common Render mistakes:
- SSL mode not set correctly
- Connection string includes query params that conflict
- Pool size too high or too low
- Timeout values too short

---

## Solutions

### Solution 1: Fix Inverted Error Logic (CRITICAL)
**File**: `/server/src/routes/auth.ts`

Find ALL instances of:
```typescript
if (!isDbUnavailableError(dbError)) {
  res.status(503).json({ error: 'Service temporarily unavailable' })
```

Change to:
```typescript
if (isDbUnavailableError(dbError)) {
  res.status(503).json({ error: 'Database unavailable' })
```

This prevents false 503 errors when DB is actually fine.

---

### Solution 2: Optimize Connection Initialization (HIGH PRIORITY)

**Current problem**: 
- Retries ON EVERY REQUEST if DB fails once
- No exponential backoff between requests
- Blocks all traffic during retry

**Better approach**:
```typescript
// Cache connection state for a duration
let lastConnectionCheck = 0
let connectionHealthy = false
const CONNECTION_CACHE_MS = 30000  // Check every 30 seconds

async function getConnectionStatus() {
  const now = Date.now()
  if (now - lastConnectionCheck < CONNECTION_CACHE_MS) {
    return connectionHealthy  // Use cached status
  }

  try {
    await currentPrismaClient.$queryRaw`SELECT 1`
    connectionHealthy = true
  } catch (err) {
    connectionHealthy = false
  }
  
  lastConnectionCheck = now
  return connectionHealthy
}

// In middleware:
if (!await getConnectionStatus()) {
  return res.status(503).json({ error: 'Database temporarily unavailable' })
}
```

---

### Solution 3: Configure Render Environment Properly

**In Render Dashboard**, set these environment variables:

```bash
# Connection pooling
DATABASE_POOL_SIZE=10

# Timeouts (in milliseconds)
DATABASE_CONNECTION_TIMEOUT=5000

# For Postgres on Render
DATABASE_URL=postgresql://user:pass@your-postgres.onrender.com/dbname?sslmode=require&connection_limit=10&connect_timeout=5000

# Provider
DATABASE_PROVIDER=postgresql
```

---

### Solution 4: Use SQLite for Staging/Dev (Simpler)

If you don't need PostgreSQL for Render staging:

```bash
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:/tmp/verdexis.db
```

Benefits:
- No connection issues
- No SSL problems
- Instant startup
- Perfect for testing

---

### Solution 5: Add Connection Pool Middleware

For PostgreSQL, add PgBouncer or use Prisma connection pooling:

```typescript
// In db.ts, for non-sqlite:
if (provider === 'sqlite') {
  // ... keep current code
} else {
  // Use Accelerate or connection pooling
  prismaClientOptions.datasources.db.url = 
    `${databaseUrl}?pgbouncer=true&connection_limit=10`
}
```

---

## Immediate Actions (Do These First)

### 1. Fix the Inverted Error Logic
- Find all `if (!isDbUnavailableError(dbError))` in auth.ts
- Change to `if (isDbUnavailableError(dbError))`
- This alone should fix 80% of your 503 errors

### 2. Check DATABASE_URL Format
In Render dashboard, verify:
- Is it PostgreSQL or SQLite?
- Does it have `sslmode=require`?
- Are query params properly formatted?
- Run: `curl https://your-api.onrender.com/api/health`

### 3. Check Connection Logs
In Render logs, look for:
```
Connection attempt 1/3 failed: ...
Connection attempt 2/3 failed: ...
```
If you see this constantly, database is unreachable.

### 4. Set DATABASE_POOL_SIZE=10
- Default might be too high
- Render has limited resources
- Start with 10, increase if needed

---

## Testing the Fix

After fixing the inverted logic:

1. **Test login**: Should work immediately if DB is fine
2. **Check logs**: Should NOT see repeated connection attempts
3. **Check health**: `curl /api/health` should return `200 OK`
4. **Load page**: Admin pages should load without 503

---

## Expected Behavior After Fixes

### Before (Current - BROKEN):
- Login → 503 "Service temporarily unavailable"
- Admin pages → 503 on every request
- Logs → Repeated connection retries
- Database uses connections wastefully

### After (Fixed):
- Login → Works instantly if DB is good
- Admin pages → Load without errors
- Logs → Connection checks only every 30s
- Database connections reused efficiently

---

## Render-Specific Configuration

### For Free Tier (Limited):
```bash
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:/tmp/verdexis.db
NODE_ENV=production
```
**Note**: Data doesn't persist across restarts

### For PostgreSQL on Render:
```bash
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:pass@your-db.onrender.com/verdexis?sslmode=require
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=5000
```

### Health Check (Add to Render):
- Path: `/api/health`
- Timeout: 10 seconds
- Expected: `{"ok": true, "status": "ok"}`

---

## Files Needing Changes

1. **CRITICAL**: `/server/src/routes/auth.ts` - Fix inverted error logic
2. **HIGH**: `/server/src/db.ts` - Add connection status caching
3. **MEDIUM**: Render environment variables - Set pool size and timeouts
4. **LOW**: `/server/src/index.ts` - Similar error logic to fix

---

## Quick Reference

| Issue | Cause | Fix |
|-------|-------|-----|
| Always 503 | Inverted error logic | Change `if (!isDbUnavailableError)` to `if (isDbUnavailableError)` |
| DB connects repeatedly | No caching, retries on every request | Add 30-second connection check cache |
| Render timeouts | Pool size too high | Set `DATABASE_POOL_SIZE=10` |
| SSL errors | Missing `sslmode` | Add `?sslmode=require` to DATABASE_URL |

Ready to apply these fixes?
