# Developer Guide: Using Standardized Error Handling & Logging

This guide explains how to use the new error handling, validation, and logging utilities in the VERDEXIS API.

---

## Error Handling

### Creating Standardized Error Responses

Use `createErrorResponse()` for all error responses:

```typescript
import { createErrorResponse, sendError } from '../errorHandler.js'

// Method 1: Create response object
const errorObj = createErrorResponse(
  'Invalid input',
  { field: 'email', reason: 'not_valid' },
  req.path
)
res.status(400).json(errorObj)

// Method 2: Use helper (shorter)
sendError(res, 400, 'Invalid input', { field: 'email' }, req.path)
```

**Response Format**:
```json
{
  "error": "Invalid input",
  "details": { "field": "email", "reason": "not_valid" },
  "timestamp": "2026-01-15T10:30:45.123Z",
  "path": "/api/auth/login"
}
```

### Common Patterns

```typescript
// Invalid input
sendError(res, 400, 'Invalid input', parsed.error.flatten())

// Unauthorized
sendError(res, 401, 'Invalid credentials')

// Forbidden
sendError(res, 403, 'Insufficient permissions')

// Not found
sendError(res, 404, 'User not found')

// Too many requests
sendError(res, 429, 'Rate limit exceeded', { retryAfter: 60 })

// Server error
sendError(res, 500, 'Internal server error', err.message)

// Unavailable service
sendError(res, 503, 'Database unavailable', err.message)
```

---

## Validation

### Using Validation Limits

Import and use `VALIDATION_LIMITS` for consistent bounds:

```typescript
import { VALIDATION_LIMITS, isValidSymbol, isValidAmount } from '../errorHandler.js'
import { z } from 'zod'

// Option 1: Use constants in Zod schemas
const tradeSchema = z.object({
  symbol: z.string()
    .min(VALIDATION_LIMITS.SYMBOL_MIN)
    .max(VALIDATION_LIMITS.SYMBOL_LENGTH),
  amount: z.number()
    .min(VALIDATION_LIMITS.MIN_AMOUNT)
    .max(VALIDATION_LIMITS.MAX_AMOUNT),
  reference: z.string()
    .max(VALIDATION_LIMITS.REFERENCE_MAX)
    .optional(),
})

// Option 2: Use type guard functions
if (!isValidAmount(amount)) {
  sendError(res, 400, 'Invalid amount', {
    min: VALIDATION_LIMITS.MIN_AMOUNT,
    max: VALIDATION_LIMITS.MAX_AMOUNT,
  })
  return
}

if (!isValidSymbol(symbol)) {
  sendError(res, 400, 'Invalid symbol', {
    maxLength: VALIDATION_LIMITS.SYMBOL_LENGTH,
  })
  return
}
```

### Available Validation Limits

```typescript
VALIDATION_LIMITS = {
  SYMBOL_LENGTH: 20,           // Max length for ticker symbols
  SYMBOL_MIN: 1,               // Min length for symbols
  ASSET_NAME_LENGTH: 120,      // Max length for asset names
  NOTE_LENGTH: 200,            // Max length for notes/references
  CURRENCY_LENGTH: 20,         // Max length for currency codes
  MIN_AMOUNT: 0.00000001,      // Minimum transaction amount
  MAX_AMOUNT: 999999999,       // Maximum transaction amount
  EMAIL_MAX_LENGTH: 200,       // Max email length
  PASSWORD_MIN: 8,             // Minimum password length
  PASSWORD_MAX: 200,           // Maximum password length
  PHONE_MIN: 7,                // Minimum phone number length
  PHONE_MAX: 32,               // Maximum phone number length
  NAME_MIN: 1,                 // Minimum name length
  NAME_MAX: 80,                // Maximum name length
  REFERENCE_MAX: 200,          // Max length for transaction references
  QUERY_MAX: 2000,             // Max length for AI queries
  CONTEXT_MAX: 4000,           // Max length for AI context
  PERSONA_MAX: 40,             // Max length for AI persona selector
}
```

### Validation Helper Functions

```typescript
// Type guard for amounts
if (isValidAmount(value)) {
  // value is guaranteed to be: number >= MIN_AMOUNT && <= MAX_AMOUNT
}

// Validate symbol format
if (!isValidSymbol('BTC')) {
  console.error('Invalid symbol')
}

// Validate currency code
if (!isValidCurrency('USD')) {
  console.error('Invalid currency')
}
```

---

## Structured Logging

### Using the Logger

```typescript
import { logger, logApiCall, logError, getRequestContext } from '../logging.js'

// Simple logging
logger.info('User created', { userId: user.id, email: user.email })
logger.warn('High memory usage', { memoryMB: process.memoryUsage().heapUsed / 1024 / 1024 })
logger.error('Database connection failed', { error: err.message })
logger.debug('Cache hit', { key: 'market:BTC' }) // Only if DEBUG env var set

// Request-scoped logging (includes requestId, userId, userRole)
logApiCall(req, 'user_created', { userId: user.id, email: user.email })
logError(req, 'Trade failed', { symbol: 'BTC', error: err.message })

// Get request context manually
const context = getRequestContext(req)
if (context) {
  console.log(`Request ${context.requestId} took ${Date.now() - context.startTime}ms`)
}
```

### Log Format

```
[2026-01-15T10:30:45.123Z] [INFO] User created {"requestId":"abc-123","userId":"user-456","userRole":"user","email":"test@example.com"}
[2026-01-15T10:30:46.456Z] [ERROR] Trade failed {"requestId":"abc-123","userId":"user-456","method":"POST","path":"/api/trades","symbol":"BTC","error":"Insufficient funds"}
```

### Request Context Injection

The `requestContextMiddleware` automatically:
- Generates a unique `X-Request-ID` header (or uses provided one)
- Tracks request start time
- Logs all responses with duration, status code, and user info
- Sets `X-Request-ID` response header for tracing

```typescript
// Client can provide a request ID for tracing across services
curl -H "X-Request-ID: my-trace-id-123" http://localhost:4000/api/health
# Response header: X-Request-ID: my-trace-id-123
```

---

## Rate Limiting Configuration

### Current Limits by Endpoint

```typescript
// Auth endpoints: 30 requests per 15 minutes (per email/username)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 30,
  keyGenerator: (req) => `${req.ip}|${req.body.email}`
})

// Trade endpoints: 20 requests per minute (per user)
const tradeLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  limit: 20,
  keyGenerator: (req) => req.userId || req.ip
})

// Money/wallet endpoints: 30 requests per minute (per user)
const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  limit: 30,
  keyGenerator: (req) => req.userId || req.ip
})

// AI endpoints: 20 requests per minute (per user)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  limit: 20,
  keyGenerator: (req) => req.userId || req.ip
})

// Global API limit: 600 requests per minute (per user)
// Keyed by userId when authenticated, falls back to IP
```

### Creating Custom Limiters

```typescript
import rateLimit from 'express-rate-limit'

const customLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute window
  limit: 50,                // Max 50 requests
  standardHeaders: 'draft-7', // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip || 'anon',
})

router.post('/endpoint', requireAuth, customLimiter, handler)
```

---

## Error Handling in Routes

### Complete Example

```typescript
import { sendError, VALIDATION_LIMITS, isValidAmount } from '../errorHandler.js'
import { logApiCall, logError } from '../logging.js'

router.post('/transfer', requireAuth, moneyLimiter, async (req: AuthedRequest, res) => {
  // 1. Validate input
  const schema = z.object({
    amount: z.number().min(VALIDATION_LIMITS.MIN_AMOUNT).max(VALIDATION_LIMITS.MAX_AMOUNT),
    recipientId: z.string().min(1).max(100),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)
    return
  }

  const { amount, recipientId } = parsed.data

  try {
    // 2. Business logic
    const result = await transferFunds(req.userId, recipientId, amount)
    
    // 3. Log success
    logApiCall(req, 'transfer_completed', { recipientId, amount })
    
    // 4. Response
    res.json({ ok: true, transactionId: result.id })
  } catch (err) {
    // 5. Log error with context
    logError(req, 'Transfer failed', {
      recipientId,
      amount,
      error: err instanceof Error ? err.message : String(err),
    })

    // 6. Send standardized error
    if (err instanceof Error && err.message.includes('Insufficient')) {
      sendError(res, 400, 'Insufficient funds', { amount, available: 0 }, req.path)
    } else {
      sendError(res, 500, 'Transfer failed', undefined, req.path)
    }
  }
})
```

---

## Migrating Existing Endpoints

### Before (Old Style)

```typescript
router.post('/example', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.body.field) {
    res.status(400).json({ error: 'Missing field' })
    return
  }
  
  try {
    const result = await doSomething(req.body.field)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed', detail: err.message })
  }
})
```

### After (New Style)

```typescript
import { sendError, VALIDATION_LIMITS } from '../errorHandler.js'
import { logApiCall, logError } from '../logging.js'

router.post('/example', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    field: z.string().min(1).max(VALIDATION_LIMITS.NAME_MAX),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    sendError(res, 400, 'Invalid input', parsed.error.flatten(), req.path)
    return
  }

  try {
    const result = await doSomething(parsed.data.field)
    logApiCall(req, 'example_completed', { field: parsed.data.field })
    res.json(result)
  } catch (err) {
    logError(req, 'Example failed', { field: parsed.data.field, error: err instanceof Error ? err.message : String(err) })
    sendError(res, 500, 'Example failed', undefined, req.path)
  }
})
```

---

## Testing

### Unit Test Example

```typescript
import { createErrorResponse, isValidAmount, VALIDATION_LIMITS } from '../errorHandler'

describe('Error Handler', () => {
  it('creates standardized error response', () => {
    const response = createErrorResponse('Test error', { code: 'E001' }, '/api/test')
    expect(response).toHaveProperty('error', 'Test error')
    expect(response).toHaveProperty('timestamp')
    expect(response).toHaveProperty('details')
    expect(response).toHaveProperty('path')
  })

  it('validates amounts within bounds', () => {
    expect(isValidAmount(VALIDATION_LIMITS.MIN_AMOUNT)).toBe(true)
    expect(isValidAmount(VALIDATION_LIMITS.MAX_AMOUNT)).toBe(true)
    expect(isValidAmount(0)).toBe(false)
    expect(isValidAmount(-1)).toBe(false)
    expect(isValidAmount(VALIDATION_LIMITS.MAX_AMOUNT + 1)).toBe(false)
  })
})
```

---

## Key Takeaways

1. **Always use `createErrorResponse()` or `sendError()`** for consistent error handling
2. **Use `VALIDATION_LIMITS` constants** in all Zod schemas
3. **Call `logApiCall()` on success**, `logError()` on failure
4. **Request ID is automatic** via middleware - no manual tracking needed
5. **Rate limits are pre-configured** - reuse or extend existing limiters
6. **Type safety first** - use type guards and Zod validation

---

## Questions?

Refer to:
- Error types: `server/src/errorHandler.ts`
- Logging setup: `server/src/logging.ts`
- Middleware integration: `server/src/index.ts`
- Example routes: `server/src/routes/wallet.ts`, `trades.ts`, `ai.ts`
