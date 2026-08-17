# Database Connection & 503 Error - Detailed Fix

## The Real Problem

The auth.ts code returns **503 for ALL database-related errors**, making it impossible for the client to distinguish between:

1. **True database unavailability** (should be 503)
   - Connection refused
   - Timeout
   - Authentication failed
   
2. **User not found/validation error** (should be 400/401)
   - Email doesn't exist
   - Invalid credentials
   - Account locked

3. **Application errors** (should be 500)
   - Unexpected error during query
   - Data corruption
   - Other server issues

---

## Current Code (WRONG)

```typescript
try {
  user = await findUserByEmailOrUsername(id)
} catch (dbError) {
  // For ANY error, returns 503
  if (!isDbUnavailableError(dbError)) {
    res.status(503).json({ error: 'Service temporarily unavailable' })
    return
  }
  res.status(503).json({ error: 'Database unavailable' })
  return
}
```

**Problem**: Even if the error is just "user not found", it returns 503 "Service unavailable"

---

## Why You See 503 Always

### Scenario 1: Database is fine, user not found
1. Query executes successfully
2. Returns null/empty
3. But code catches an error? NO WAIT...

Actually, `findUserByEmailOrUsername` returning null shouldn't throw an error. Let me check that function...

---

## The ACTUAL Root Issue

Looking more carefully, the function returns null if user not found. It doesn't throw an error.

**So why do you get 503?**

Options:
1. Database connection IS actually failing (check Render logs)
2. Some other error is being thrown
3. Multiple connection retries are blocking requests

---

## Real Solution: Check Render Logs

### In Render Dashboard:
1. Go to your Backend service
2. Click "Logs"
3. Look for lines like:
   - `Connection attempt 1/3 failed`
   - `Database error`
   - `ECONNREFUSED`
   - `timeout`

### What to share:
- Screenshot of last 50 log lines
- Any red error text
- Pattern of errors (constant? intermittent?)

---

## Fixes to Apply (In Order)

### Fix 1: Remove Redundant 503 Returns
The logic catches database errors and returns 503 for both branches. The message differs but both are 503.

**Better approach**: Only return 503 for true DB unavailability:

```typescript
try {
  user = await findUserByEmailOrUsername(id)
} catch (dbError) {
  if (isDbUnavailableError(dbError)) {
    // Only THIS is truly a database connectivity issue
    res.status(503).json({ error: 'Database temporarily unavailable' })
    return
  }
  // Any other error is a server error
  console.error('[verdexis-api] Login error:', dbError)
  res.status(500).json({ error: 'Internal server error' })
  return
}

// If no error and user found, continue
if (!user) {
  res.status(401).json({ error: 'Invalid credentials' })
  return
}
```

---

### Fix 2: Add Request Timeout

In Render, set a timeout so requests don't hang forever:

```typescript
// Add at top of request handler
const requestTimeout = setTimeout(() => {
  res.status(504).json({ error: 'Gateway Timeout' })
}, 10000) // 10 seconds

try {
  user = await findUserByEmailOrUsername(id)
} catch (dbError) {
  // ... handle error
} finally {
  clearTimeout(requestTimeout)
}
```

---

### Fix 3: Render Environment Configuration

**Current issue in Render**: Database pool exhaustion

**In Render dashboard environment variables**:

```
# PostgreSQL settings (if using Postgres)
DATABASE_PROVIDER=postgresql
DATABASE_POOL_SIZE=5
DATABASE_CONNECTION_TIMEOUT=8000

# Or use SQLite for simplicity (Recommended for Staging)
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:/tmp/verdexis.db
```

---

### Fix 4: Implement Caching

The database initialization retries ON EVERY REQUEST. This is the real culprit:

```typescript
// In db.ts
let dbHealthLastCheck = 0
let dbIsHealthy = true
const DB_HEALTH_CACHE_INTERVAL_MS = 30000  // Check every 30s

export async function isDatabaseHealthy() {
  const now = Date.now()
  
  // Use cached status
  if (now - dbHealthLastCheck < DB_HEALTH_CACHE_INTERVAL_MS) {
    return dbIsHealthy
  }

  // Check database health
  try {
    await prisma.$queryRaw`SELECT 1`
    dbIsHealthy = true
    dbHealthLastCheck = now
    return true
  } catch (err) {
    dbIsHealthy = false
    dbHealthLastCheck = now
    console.warn('[verdexis-api] Database health check failed:', err instanceof Error ? err.message : String(err))
    return false
  }
}
```

Then in auth.ts:
```typescript
import { isDatabaseHealthy } from '../db.js'

// At start of login endpoint
if (!await isDatabaseHealthy()) {
  res.status(503).json({ error: 'Database is temporarily unavailable. Please try again in a moment.' })
  return
}

try {
  user = await findUserByEmailOrUsername(id)
} catch (dbError) {
  console.error('[verdexis-api] Unexpected error:', dbError)
  res.status(500).json({ error: 'Internal server error' })
  return
}
```

---

## What to Do Now

1. **Check Render logs** - Screenshot and share any errors
2. **Set DATABASE_POOL_SIZE=5** in Render environment
3. **Test login** - Does it work or still 503?
4. **Check `/api/health` endpoint** - Does it respond with 200?

Share the Render logs and I'll apply the specific fixes needed.

---

## One-Line Debug

In Render logs, search for your email address. Share the full error message showing what went wrong.

Example of what to look for:
```
[verdexis-api] Login lookup failed: { 
  errorCode: 'P1001',
  errorMessage: 'Can\'t reach database server at `postgres.onrender.com:5432`' 
}
```

This tells us the exact issue and how to fix it.
