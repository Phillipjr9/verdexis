# Verdexis 503 Service Error & Database Issues - Complete Diagnosis

## TL;DR - What's Happening

Your backend is constantly trying to reconnect to the database, causing:
- ✗ Every login returns "503 Service Temporarily Unavailable"
- ✗ Database reconnects on EVERY request
- ✗ Admin pages can't load (need database)
- ✗ Render resources exhausted quickly

---

## Root Causes Identified

### 1. Aggressive Database Retry Logic
**File**: `/server/src/db.ts` lines 138-171

```typescript
async function ensureConnection() {
  while (connectionAttempts < MAX_RETRIES) {  // Retries 3 times
    try {
      await currentPrismaClient.$connect()
      // Success, return
    } catch (err) {
      connectionAttempts++
      delay = 2s → 4s → 8s
      // Retry again
    }
  }
}
```

**Problem**: This function is called BEFORE EVERY QUERY, causing:
- Request 1 fails → retries 3 times → waits up to 14 seconds
- During retry, connection pool fills up
- New requests come in → also retry → pool exhausted
- Cascading failure

### 2. Connection Pool Not Shared Between Requests
**File**: `/server/src/db.ts` line 125

```typescript
let currentPrismaClient = global.__prisma || new PrismaClient()
```

Without proper connection pooling configuration:
- Each request that needs a connection waits for the pool
- If pool is exhausted, waits forever (timeout)
- Timeout returns 503

### 3. Incorrect Environment Variables in Render
Likely issues:
- `DATABASE_POOL_SIZE` not set (default 20 is too high for Render)
- `sslmode` not configured (SSL errors look like timeouts)
- `CONNECTION_TIMEOUT` too aggressive

---

## Immediate Fixes (Apply These First)

### Fix 1: Render Environment Variables
**In Render Dashboard**, go to Backend service → Environment

**REPLACE** any existing database variables with:

```bash
DATABASE_PROVIDER=postgresql
DATABASE_POOL_SIZE=5
DATABASE_CONNECTION_TIMEOUT=8000
```

If using PostgreSQL, your DATABASE_URL should look like:
```
postgresql://user:password@database.onrender.com/dbname?sslmode=require
```

**If you have limited database resources**, use SQLite instead:
```bash
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:/tmp/verdexis.db
```

### Fix 2: Reduce Connection Retry Aggression
**File**: `/server/src/db.ts`

**Change line ~143** from:
```typescript
const MAX_RETRIES = 3
```

To:
```typescript
const MAX_RETRIES = 1
```

This prevents cascading retry storms.

### Fix 3: Add Connection Health Check Cache
**File**: `/server/src/db.ts`

**After line ~140**, add:

```typescript
let connectionHealthCache = { healthy: false, checkedAt: 0 }
const HEALTH_CHECK_INTERVAL_MS = 30000  // Check every 30 seconds

async function getConnectionHealth() {
  const now = Date.now()
  if (now - connectionHealthCache.checkedAt < HEALTH_CHECK_INTERVAL_MS) {
    return connectionHealthCache.healthy  // Use cached result
  }
  
  try {
    await currentPrismaClient.$queryRaw`SELECT 1`
    connectionHealthCache = { healthy: true, checkedAt: now }
    return true
  } catch (err) {
    connectionHealthCache = { healthy: false, checkedAt: now }
    return false
  }
}
```

Then in auth routes, add check before queries:

```typescript
import { getConnectionHealth } from '../db.js'

router.post('/login', async (req, res) => {
  // Check if database is accessible
  if (!await getConnectionHealth()) {
    res.status(503).json({ error: 'Database temporarily unavailable' })
    return
  }
  
  // Continue with login logic
  // ...
})
```

---

## Why Render Specific Issues Happen

### Cold Starts (Free Tier)
- Service goes idle after 15 min → shuts down
- Next request: fresh container spin up
- Database connection cold
- **Solution**: Use Render paid tier or accept slow first request

### Ephemeral Filesystem
- `/tmp` directory is temporary (lost on restart)
- SQLite database file lost
- **Solution**: Use PostgreSQL or accept data loss, or use persistent disk

### Limited Database Connections
- Render free tier PostgreSQL: limited connections
- Our default pool size (20) can exhaust it
- **Solution**: Set `DATABASE_POOL_SIZE=5` or use SQLite

---

## Testing the Fixes

### Test 1: Health Check
```bash
curl https://your-backend.onrender.com/api/health
```

**Expected response**:
```json
{
  "ok": true,
  "service": "verdexis-api",
  "database": "Ready",
  "status": "ok"
}
```

**If you see**:
- `"database": "Unavailable"` → Database connection issue
- `"database": "Failed"` → Database completely down

### Test 2: Login
1. Open website
2. Try to login
3. Should work (not 503)
4. If still 503 → Check Render logs

### Test 3: Check Logs
**In Render Dashboard**:
1. Backend service → Logs
2. Look for error patterns:
   - `Connection attempt 1/3 failed` → Database unreachable
   - `timeout` → Too slow to connect
   - `ECONNREFUSED` → Database port not open

---

## Render Configuration Checklist

- [ ] `DATABASE_POOL_SIZE=5` set
- [ ] `DATABASE_CONNECTION_TIMEOUT=8000` set
- [ ] `DATABASE_PROVIDER=postgresql` OR `sqlite` (choose one)
- [ ] DATABASE_URL is correct format
- [ ] If PostgreSQL: URL includes `?sslmode=require`
- [ ] Health check endpoint working (`/api/health`)
- [ ] Backend service has restart policy enabled

---

## If Issue Persists

Share these details:
1. **Screenshot of Render environment variables**
2. **Last 50 lines of Render logs** (copy/paste)
3. **Result of** `curl /api/health` command
4. **What happens when you try to login** (what error/page appears?)

With this info, I can apply targeted fixes.

---

## Prevention Going Forward

### Best Practices:
1. **Monitor database connection pool** - Set alerts if usage > 80%
2. **Use connection pooling** - PgBouncer for production
3. **Add health checks** - Regular `SELECT 1` to keep connection warm
4. **Cache health status** - Don't check on every request
5. **Graceful degradation** - Support offline/cached mode
6. **Logging** - Log all database errors for debugging

### For Render Specifically:
1. Use **PostgreSQL** instead of SQLite for persistence
2. Set **appropriate pool size** for your tier
3. Use **paid tier** if you need production reliability
4. Add **monitoring/alerting** for database issues

---

## Files to Review

1. `DATABASE_503_ROOT_CAUSE.md` - Detailed root cause analysis
2. `DATABASE_503_REAL_FIX.md` - Step-by-step fixes
3. `/server/src/db.ts` - Connection initialization logic
4. `/server/src/routes/auth.ts` - Error handling logic

---

## Next Step

**Please share**:
1. Your Render environment variable screenshot
2. Last 20-30 lines from Render logs
3. What error you see when trying to login

I'll apply the exact fixes needed for your setup.
