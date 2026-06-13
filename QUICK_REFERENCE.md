# Quick Reference Card: New Utilities

Print this or keep it in your IDE for quick lookup.

---

## Error Handling Cheat Sheet

### Import
```typescript
import { sendError, VALIDATION_LIMITS, createErrorResponse } from '../errorHandler.js'
```

### Common Usage
```typescript
// 400 Bad Request
sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)

// 401 Unauthorized
sendError(res, 401, 'Invalid credentials')

// 403 Forbidden
sendError(res, 403, 'Insufficient permissions')

// 404 Not Found
sendError(res, 404, 'Resource not found', undefined, req.path)

// 429 Rate Limited
sendError(res, 429, 'Rate limit exceeded', { retryAfter: 60 })

// 500 Server Error
sendError(res, 500, 'Internal server error', err.message, req.path)

// 503 Unavailable
sendError(res, 503, 'Service unavailable', err.message)
```

### Response Format
```json
{
  "error": "message",
  "details": { "optional": "details" },
  "timestamp": "2026-01-15T10:30:45.123Z",
  "path": "/api/endpoint"
}
```

---

## Validation Limits Cheat Sheet

### Import
```typescript
import { VALIDATION_LIMITS } from '../errorHandler.js'
```

### All Limits
```typescript
VALIDATION_LIMITS = {
  SYMBOL_LENGTH: 20,           // Max ticker
  SYMBOL_MIN: 1,               // Min ticker
  ASSET_NAME_LENGTH: 120,      // Asset name
  NOTE_LENGTH: 200,            // Notes/refs
  CURRENCY_LENGTH: 20,         // Currency code
  MIN_AMOUNT: 0.00000001,      // Min transaction
  MAX_AMOUNT: 999999999,       // Max transaction
  EMAIL_MAX_LENGTH: 200,       // Email
  PASSWORD_MIN: 8,             // Password min
  PASSWORD_MAX: 200,           // Password max
  PHONE_MIN: 7,                // Phone min
  PHONE_MAX: 32,               // Phone max
  NAME_MIN: 1,                 // Name min
  NAME_MAX: 80,                // Name max
  REFERENCE_MAX: 200,          // Reference text
  QUERY_MAX: 2000,             // AI query
  CONTEXT_MAX: 4000,           // AI context
  PERSONA_MAX: 40,             // AI persona
}
```

### Using in Zod
```typescript
const schema = z.object({
  amount: z.number()
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

---

## Logging Cheat Sheet

### Import
```typescript
import { logger, logApiCall, logError, getRequestContext } from '../logging.js'
```

### Common Usage
```typescript
// Log success
logApiCall(req, 'user_created', { userId: user.id, email: user.email })

// Log error
logError(req, 'Transfer failed', { amount, error: err.message })

// Simple logging
logger.info('Server started', { port: 4000 })
logger.warn('High memory', { mb: 500 })
logger.error('Database down', { error: err.message })
logger.debug('Cache hit', { key: 'xyz' })  // Only if DEBUG=1

// Get context manually
const ctx = getRequestContext(req)
console.log(`Request ${ctx.requestId} took ${Date.now() - ctx.startTime}ms`)
```

### Log Format
```
[2026-01-15T10:30:45.123Z] [INFO] user_created {"requestId":"abc","userId":"u-1","method":"POST","path":"/api/users"}
```

---

## Validation Helpers Cheat Sheet

### Import
```typescript
import { isValidAmount, isValidSymbol, isValidCurrency } from '../errorHandler.js'
```

### Usage
```typescript
// Type guard for amounts
if (isValidAmount(value)) {
  // value is guaranteed: 0.00000001 <= value <= 999999999
  const result = value * 2
}

// Validate symbol
if (!isValidSymbol('BTC')) {
  sendError(res, 400, 'Invalid symbol')
}

// Validate currency
if (!isValidCurrency('USD')) {
  sendError(res, 400, 'Invalid currency')
}
```

---

## Rate Limits by Endpoint

```typescript
// Auth: 30/15min per email
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `${req.ip}|${req.body.email}`
})

// Trades: 20/min per user
const tradeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip
})

// Money: 30/min per user
const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip
})

// AI: 20/min per user
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip
})
```

---

## Complete Endpoint Template

```typescript
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { sendError, VALIDATION_LIMITS } from '../errorHandler.js'
import { logApiCall, logError } from '../logging.js'

const router = Router()

const schema = z.object({
  amount: z.number()
    .min(VALIDATION_LIMITS.MIN_AMOUNT)
    .max(VALIDATION_LIMITS.MAX_AMOUNT),
})

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  // 1. Validate
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)
    return
  }

  const { amount } = parsed.data

  try {
    // 2. Execute
    const result = await doSomething(req.userId!, amount)
    
    // 3. Log success
    logApiCall(req, 'operation_completed', { amount })
    
    // 4. Respond
    res.status(201).json(result)
  } catch (err) {
    // 5. Log error
    logError(req, 'Operation failed', {
      amount,
      error: err instanceof Error ? err.message : String(err),
    })

    // 6. Send error
    if (err instanceof Error && err.message.includes('Insufficient')) {
      sendError(res, 400, 'Insufficient funds', undefined, req.path)
    } else {
      sendError(res, 500, 'Operation failed', undefined, req.path)
    }
  }
})

export default router
```

---

## Testing Commands

```bash
# Test error format
curl -X GET http://localhost:4000/api/invalid

# Test validation
curl -X POST http://localhost:4000/api/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "amount": -1 }'

# Test request logging (check server output)
curl -H "X-Request-ID: test-123" http://localhost:4000/api/health

# Test rate limit
for i in {1..21}; do
  curl -X POST http://localhost:4000/api/ai/chat \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "query": "test" }' &
done

# Test cache clear (admin only)
curl -X POST http://localhost:4000/api/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "type": "market" }'
```

---

## Common Error Codes

| Code | Use Case | Example |
|------|----------|---------|
| 400 | Invalid input | Validation fails, oversized field |
| 401 | Auth required | Missing token, invalid token |
| 403 | No permission | Non-admin accessing admin endpoint |
| 404 | Not found | User/resource doesn't exist |
| 409 | Conflict | Email already registered |
| 423 | Locked | Account hold, bonus locked |
| 429 | Rate limited | Too many requests |
| 500 | Server error | Unexpected exception |
| 502 | Bad gateway | Upstream service down |
| 503 | Unavailable | Database down, service unavailable |

---

## Useful Files

| File | Purpose | Read Time |
|------|---------|-----------|
| DEVELOPER_GUIDE.md | Complete usage guide | 10 min |
| MIGRATION_CHECKLIST.md | Step-by-step migration | 15 min |
| errorHandler.ts | Implementation details | 5 min |
| logging.ts | Logging implementation | 5 min |

---

## TL;DR (Too Long; Didn't Read)

1. **Import utilities**: `errorHandler.js`, `logging.js`
2. **Update schemas**: Use `VALIDATION_LIMITS` constants
3. **Replace errors**: Use `sendError(res, code, msg)` everywhere
4. **Add logging**: `logApiCall()` on success, `logError()` on failure
5. **Test**: Verify error format and request ID headers
6. **Deploy**: Run TypeScript check, deploy to staging first

---

## Questions?

- How do I use sendError? → See "Common Usage" above
- Where are the limits? → VALIDATION_LIMITS constants
- How do I log? → logApiCall() / logError() functions
- Need an example? → See "Complete Endpoint Template" above
- Still stuck? → Read DEVELOPER_GUIDE.md

---

**Last Updated**: January 15, 2026  
**Version**: 1.0  
**Status**: Ready for Production
