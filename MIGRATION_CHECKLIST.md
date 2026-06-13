# Migration Checklist: Updating Routes with New Utilities

Use this checklist when updating existing route files to use the new error handling, validation, and logging utilities.

---

## Pre-Migration Checklist

- [ ] Have `errorHandler.ts` and `logging.ts` been deployed?
- [ ] Main server (`index.ts`) has been updated with middleware?
- [ ] All team members have pulled latest changes?
- [ ] Staging environment deployed and tested?

---

## Per-Route Migration Steps

### Step 1: Update Imports

```typescript
// ❌ OLD
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'

// ✅ NEW
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { 
  sendError, 
  VALIDATION_LIMITS, 
  isValidAmount, 
  isValidSymbol,
  isValidCurrency 
} from '../errorHandler.js'
import { logApiCall, logError } from '../logging.js'
```

### Step 2: Update Validation Schemas

```typescript
// ❌ OLD
const depositSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1).max(20),
  note: z.string().max(200).optional(),
})

// ✅ NEW
const depositSchema = z.object({
  amount: z.number()
    .positive()
    .min(VALIDATION_LIMITS.MIN_AMOUNT)
    .max(VALIDATION_LIMITS.MAX_AMOUNT),
  currency: z.string()
    .min(1)
    .max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  note: z.string()
    .max(VALIDATION_LIMITS.NOTE_LENGTH)
    .optional(),
})
```

### Step 3: Update GET Endpoints

```typescript
// ❌ OLD
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  
  try {
    const data = await prisma.user.findUnique({ where: { id: userId } })
    res.json(data)
  } catch (err) {
    console.error('Error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ✅ NEW
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    sendError(res, 401, 'Unauthorized')
    return
  }
  
  try {
    const data = await prisma.user.findUnique({ where: { id: userId } })
    if (!data) {
      sendError(res, 404, 'User not found', undefined, req.path)
      return
    }
    logApiCall(req, 'user_fetched', { userId })
    res.json(data)
  } catch (err) {
    logError(req, 'Failed to fetch user', { 
      error: err instanceof Error ? err.message : String(err) 
    })
    sendError(res, 500, 'Internal server error', undefined, req.path)
  }
})
```

### Step 4: Update POST Endpoints with Validation

```typescript
// ❌ OLD
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ 
      error: 'Invalid input', 
      details: parsed.error.flatten() 
    })
    return
  }
  
  const { amount, currency } = parsed.data
  
  // Manual validation
  if (amount <= 0 || amount > 999999999) {
    res.status(400).json({ error: 'Invalid amount' })
    return
  }
  
  try {
    const result = await deposit(req.userId!, amount, currency)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: 'Deposit failed' })
  }
})

// ✅ NEW
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)
    return
  }
  
  const { amount, currency } = parsed.data
  
  // Zod already validated amount and currency bounds
  // No need for manual checks
  
  try {
    const result = await deposit(req.userId!, amount, currency)
    logApiCall(req, 'deposit_created', { amount, currency })
    res.status(201).json(result)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logError(req, 'Deposit failed', { amount, currency, error: errorMsg })
    
    if (errorMsg.includes('Insufficient')) {
      sendError(res, 400, 'Insufficient funds', undefined, req.path)
    } else {
      sendError(res, 500, 'Deposit failed', undefined, req.path)
    }
  }
})
```

### Step 5: Update Transaction Endpoints

```typescript
// ❌ OLD
router.post('/transfer', requireAuth, moneyLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({
    amount: z.number().positive(),
    recipientId: z.string().min(1),
  })
  
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  
  const { amount, recipientId } = parsed.data
  
  try {
    // Check recipient exists
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } })
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' })
      return
    }
    
    // Execute transfer
    const tx = await prisma.$transaction(async () => {
      // transfer logic
    })
    
    res.status(201).json(tx)
  } catch (err) {
    console.error('Transfer error:', err)
    res.status(500).json({ error: 'Transfer failed' })
  }
})

// ✅ NEW
router.post('/transfer', requireAuth, moneyLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({
    amount: z.number()
      .min(VALIDATION_LIMITS.MIN_AMOUNT)
      .max(VALIDATION_LIMITS.MAX_AMOUNT),
    recipientId: z.string().min(1).max(100),
  })
  
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)
    return
  }
  
  const { amount, recipientId } = parsed.data
  
  try {
    // Check recipient exists
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } })
    if (!recipient) {
      sendError(res, 404, 'Recipient not found', undefined, req.path)
      return
    }
    
    // Execute transfer
    const tx = await prisma.$transaction(async () => {
      // transfer logic
    })
    
    logApiCall(req, 'transfer_created', { recipientId, amount })
    res.status(201).json(tx)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logError(req, 'Transfer failed', { recipientId, amount, error: errorMsg })
    
    if (errorMsg.includes('Insufficient')) {
      sendError(res, 400, 'Insufficient funds', undefined, req.path)
    } else if (errorMsg.includes('locked')) {
      sendError(res, 423, 'Account restricted', undefined, req.path)
    } else {
      sendError(res, 500, 'Transfer failed', undefined, req.path)
    }
  }
})
```

### Step 6: Update DELETE/Mutation Endpoints

```typescript
// ❌ OLD
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id
  
  try {
    const deleted = await prisma.resource.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' })
  }
})

// ✅ NEW
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id
  
  // Validate ID format
  if (!id || typeof id !== 'string' || id.length === 0) {
    sendError(res, 400, 'Invalid ID', undefined, req.path)
    return
  }
  
  try {
    const deleted = await prisma.resource.delete({ where: { id } })
    if (!deleted) {
      sendError(res, 404, 'Resource not found', undefined, req.path)
      return
    }
    logApiCall(req, 'resource_deleted', { resourceId: id })
    res.json({ ok: true })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logError(req, 'Delete failed', { resourceId: id, error: errorMsg })
    sendError(res, 500, 'Delete failed', undefined, req.path)
  }
})
```

---

## Common Migration Patterns

### Pattern 1: Input Validation

```typescript
// ❌ OLD - Manual validation scattered
if (!email) res.status(400).json({ error: 'Email required' })
if (email.length > 100) res.status(400).json({ error: 'Email too long' })
if (password.length < 8) res.status(400).json({ error: 'Password too short' })

// ✅ NEW - Centralized in Zod schema
const schema = z.object({
  email: z.string().email().max(VALIDATION_LIMITS.EMAIL_MAX_LENGTH),
  password: z.string().min(VALIDATION_LIMITS.PASSWORD_MIN),
})
const parsed = schema.safeParse(req.body)
if (!parsed.success) {
  sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)
  return
}
```

### Pattern 2: Error Handling

```typescript
// ❌ OLD - Inconsistent error responses
catch (err) {
  console.error(err)
  res.status(500).json({ error: 'Failed' })
}

// ✅ NEW - Structured logging + standardized response
catch (err) {
  logError(req, 'Operation failed', { 
    error: err instanceof Error ? err.message : String(err) 
  })
  sendError(res, 500, 'Operation failed', undefined, req.path)
}
```

### Pattern 3: Success Logging

```typescript
// ❌ OLD - No logging
const result = await createUser(data)
res.status(201).json(result)

// ✅ NEW - Log successful operations
const result = await createUser(data)
logApiCall(req, 'user_created', { userId: result.id, email: result.email })
res.status(201).json(result)
```

---

## Testing Your Migration

After updating each route, test:

```bash
# 1. Check TypeScript compilation
npm run build

# 2. Test validation errors
curl -X POST http://localhost:4000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{ "amount": -1 }'
# Should return standardized error with VALIDATION_LIMITS

# 3. Test request logging
curl -H "X-Request-ID: test-123" http://localhost:4000/api/endpoint
# Check logs for request context

# 4. Test success path
curl -X POST http://localhost:4000/api/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 100 }'
# Should log successful operation

# 5. Verify error responses
curl -X GET http://localhost:4000/api/endpoint/nonexistent
# Should return standardized 404 error
```

---

## Rollout Strategy

### Option 1: Big Bang (Not Recommended)
- Update all routes at once
- Risk: Multiple issues simultaneously

### Option 2: Gradual (Recommended)
1. Update core routes first (auth, wallet)
2. Test thoroughly in staging
3. Deploy to production
4. Update remaining routes in subsequent PRs

### Option 3: Feature Flag
```typescript
// Temporary feature flag during rollout
const USE_NEW_ERROR_HANDLER = process.env.USE_NEW_ERROR_HANDLER === 'true'

if (USE_NEW_ERROR_HANDLER) {
  sendError(res, 400, 'Invalid', parsed.error.flatten())
} else {
  res.status(400).json({ error: 'Invalid' })
}
```

---

## Verification Checklist

After migrating each route:

- [ ] All imports are correct
- [ ] Validation schemas use `VALIDATION_LIMITS`
- [ ] Error responses use `sendError()` function
- [ ] Successful operations call `logApiCall()`
- [ ] Error cases call `logError()`
- [ ] TypeScript compilation passes
- [ ] Tests pass (if test coverage exists)
- [ ] Code review approved
- [ ] Tested in staging environment

---

## Troubleshooting

### Issue: "Cannot find module 'errorHandler'"

**Solution**: Ensure file is at `server/src/errorHandler.ts` and import path is correct:
```typescript
import { sendError } from '../errorHandler.js'  // ✅ Correct
import { sendError } from './errorHandler.js'   // ❌ Wrong if in routes/
```

### Issue: "VALIDATION_LIMITS is not defined"

**Solution**: Import it from errorHandler:
```typescript
import { VALIDATION_LIMITS } from '../errorHandler.js'
```

### Issue: "Request logging not appearing"

**Solution**: Ensure middleware is registered in `index.ts`:
```typescript
app.use(requestContextMiddleware)  // Before route handlers
app.use('/api/...', routes)
```

### Issue: "X-Request-ID not in response headers"

**Solution**: Middleware sets it automatically, check:
```bash
curl -v http://localhost:4000/api/endpoint 2>&1 | grep X-Request-ID
```

---

## Performance Checklist

After migration, verify performance hasn't degraded:

```bash
# Baseline test before migration
ab -n 1000 -c 10 http://localhost:4000/api/endpoint

# After migration - should be similar
ab -n 1000 -c 10 http://localhost:4000/api/endpoint
```

Expected overhead: <5ms per request from new logging/validation

---

## Sign-Off Template

Use this when submitting a migrated route for review:

```
## Route Migration: [route name]

**Files modified**:
- `server/src/routes/[file].ts`

**Changes**:
- [x] Updated imports to include errorHandler, logging
- [x] Updated validation schemas with VALIDATION_LIMITS
- [x] Replaced all error responses with sendError()
- [x] Added logApiCall() for successful operations
- [x] Added logError() for error cases
- [x] TypeScript compilation passes
- [x] Tested in dev environment

**Testing**:
- [x] Validation errors return standardized format
- [x] Success paths log correctly
- [x] Request ID header is set
- [x] Error cases handled gracefully

**Backward compatibility**: ✅ Maintained
```

---

## Timeline Estimate

- **Per route**: 15-30 minutes
- **Testing**: 10 minutes
- **Code review**: 10 minutes
- **Total per route**: ~1 hour

With ~15 main routes, total migration: **2-3 days**

---

## Need Help?

Refer to:
- `DEVELOPER_GUIDE.md` - Detailed usage examples
- `errorHandler.ts` - Implementation details
- `logging.ts` - Logging setup
- Existing migrated routes in:
  - `wallet.ts`
  - `trades.ts`
  - `ai.ts`
