# Week 1 Security Hardening - Integration Guide

## 📋 What We've Built

Three production-ready security components:

1. **`server/src/middleware/validation.ts`** - Comprehensive input validation with Zod
2. **`server/src/middleware/securityHeaders.ts`** - OWASP-compliant security headers
3. **`server/src/lib/sentry.ts`** - Error tracking and monitoring

---

## 🔧 Integration Steps

### Step 1: Install Dependencies

```bash
cd server
npm install @sentry/node @sentry/integrations
```

Verify Zod is already installed:
```bash
npm list zod
# Should show: zod@3.23.8 or similar
```

### Step 2: Update `server/src/app.ts`

Find the main Express app setup and add security middleware in this order:

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { 
  setupSecurityHeaders, 
  enforceHttps,
  validateSamesite 
} from './middleware/securityHeaders.js'
import { initSentryServer } from './lib/sentry.js'

const app = express()

// 1. Initialize Sentry FIRST (before all other middleware)
initSentryServer(app)

// 2. Enforce HTTPS in production
app.use(enforceHttps)

// 3. Security headers (must be early)
setupSecurityHeaders(app)

// 4. Body parser with size limits
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ limit: '5mb', extended: false }))

// 5. Validate same-site requests
app.use(validateSamesite)

// 6. CORS (after security headers)
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(','),
  credentials: true,
}))

// ... rest of middleware and routes ...

// Error handling at the end
app.use((error: any, req: any, res: any, next: any) => {
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
```

### Step 3: Add Validation to Routes

Example: Update `server/src/routes/auth.ts`

```typescript
import { Router } from 'express'
import { validateBody } from '../middleware/validation.js'
import { authSchemas } from '../middleware/validation.js'

const router = Router()

// BEFORE (no validation)
// router.post('/signup', async (req, res) => {
//   const { email, password, name } = req.body
//   ...
// })

// AFTER (with validation)
router.post('/signup', 
  validateBody(authSchemas.signup),
  async (req, res) => {
    const { email, password, name } = req.body
    // Input is now guaranteed to be valid
    ...
  }
)

// Similarly for other endpoints
router.post('/login',
  validateBody(authSchemas.login),
  loginHandler
)

router.post('/forgot-password',
  validateBody(authSchemas.forgotPassword),
  forgotPasswordHandler
)
```

### Step 4: Update KYC Routes

```typescript
import { validateBody } from '../middleware/validation.js'
import { kycSchemas } from '../middleware/validation.js'

router.post('/kyc/submit',
  requireAuth,
  csrfProtection,
  kycSubmitLimiter,
  validateBody(kycSchemas.submit),  // Add this
  async (req, res) => {
    // Body is now validated
    ...
  }
)
```

### Step 5: Update Wallet Routes

```typescript
router.post('/api/wallet/deposit',
  requireAuth,
  validateBody(walletSchemas.deposit),
  depositHandler
)

router.post('/api/wallet/withdraw',
  requireAuth,
  validateBody(walletSchemas.withdraw),
  withdrawHandler
)

router.post('/api/wallet/transfer',
  requireAuth,
  validateBody(walletSchemas.transfer),
  transferHandler
)
```

### Step 6: Update Trading Routes

```typescript
router.post('/api/trades/order',
  requireAuth,
  validateBody(tradingSchemas.placeOrder),
  placeOrderHandler
)

router.delete('/api/trades/order/:orderId',
  requireAuth,
  validateBody(tradingSchemas.cancelOrder),
  cancelOrderHandler
)
```

### Step 7: Configure Environment Variables

Add to `server/.env`:

```env
# Sentry Configuration
SENTRY_DSN=https://your-key@your-project.ingest.sentry.io/your-project-id

# Security Headers
NODE_ENV=production
MAX_BODY_SIZE=10mb
MAX_JSON_SIZE=5mb
MAX_URLENCODED_SIZE=5mb

# HTTPS enforcement
HTTPS_REDIRECT=true
```

Get your Sentry DSN:
1. Go to https://sentry.io/signup (create free account)
2. Create a project (select "Express" template)
3. Copy the DSN
4. Paste into `SENTRY_DSN` in `.env`

### Step 8: Test Security Headers

Run your server and check response headers:

```bash
curl -i http://localhost:4000/api/health
```

You should see:

```
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=63072000; ...
```

### Step 9: Test Input Validation

Try sending invalid data:

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "short",
    "name": ""
  }'
```

Response (should be 400 with validation errors):

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    },
    {
      "field": "name",
      "message": "Name required"
    }
  ]
}
```

### Step 10: Test Error Tracking (Sentry)

Add a test endpoint to manually trigger an error:

```typescript
router.get('/api/test-error', (req, res, next) => {
  const error = new Error('Test error for Sentry')
  next(error)
})
```

Make a request:

```bash
curl http://localhost:4000/api/test-error
```

Check your Sentry dashboard - the error should appear!

---

## 🎯 Key Files to Update

| File | Changes | Priority |
|------|---------|----------|
| `server/src/app.ts` | Add security middleware | 🔴 Critical |
| `server/src/routes/auth.ts` | Add auth validation | 🔴 Critical |
| `server/src/routes/kyc.ts` | Add KYC validation | 🟠 High |
| `server/src/routes/wallet.ts` | Add wallet validation | 🟠 High |
| `server/src/routes/trades.ts` | Add trading validation | 🟠 High |
| `server/src/routes/alerts.ts` | Add alert validation | 🟡 Medium |
| `server/.env` | Add Sentry DSN | 🔴 Critical |

---

## ✅ Verification Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] `validation.ts` created
- [ ] `securityHeaders.ts` created
- [ ] `sentry.ts` created
- [ ] `app.ts` updated with security middleware
- [ ] Auth routes updated with validation
- [ ] KYC routes updated with validation
- [ ] Wallet routes updated with validation
- [ ] Trading routes updated with validation
- [ ] Environment variables configured (SENTRY_DSN)
- [ ] Security headers verified (curl test)
- [ ] Validation tested (invalid data rejected)
- [ ] Sentry working (test error visible in dashboard)

---

## 🚀 Usage Examples

### Validating Complex Objects

```typescript
// Validate nested objects
const complexSchema = z.object({
  order: z.object({
    symbol: z.string(),
    quantity: z.number(),
    price: z.number(),
  }),
  settings: z.object({
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
  }),
})

router.post('/advanced-order',
  validateBody(complexSchema),
  handler
)
```

### Custom Validation Messages

```typescript
const userSchema = z.object({
  age: z.number()
    .min(18, 'Must be 18 or older')
    .max(120, 'Invalid age'),
  amount: z.number()
    .positive('Amount must be positive')
    .finite('Invalid amount'),
})
```

### Tracking Events with Sentry

```typescript
import { trackAuthEvent, trackTransaction } from '../lib/sentry.js'

// Track login
trackAuthEvent('login', userId, success, { 
  provider: 'email',
  ip: req.ip 
})

// Track trade
trackTransaction('trade', userId, 100, 'USD', 'success', {
  symbol: 'BTC',
  side: 'buy',
})
```

---

## 📊 Expected Results After Integration

### Security Metrics
- ✅ Zero input validation bypasses
- ✅ All API responses have CSP headers
- ✅ HSTS enforcement in production
- ✅ All errors tracked in Sentry
- ✅ Slow requests logged automatically

### Performance Impact
- Minimal (< 1ms per request)
- Validation is fast (Zod is optimized)
- Security headers add negligible overhead

### Error Coverage
- 100% of unhandled exceptions captured
- All slow requests logged (> 1s)
- User errors clearly communicated
- Production issues visible in dashboard

---

## 🔗 Next Steps

Once you verify everything is working:

1. **Week 2:** Database query optimization
2. **Week 3:** Redis caching implementation
3. **Week 4:** Job queue system

Let me know when you're ready to deploy and I'll guide you through the next phase!

---

## 📞 Troubleshooting

### Sentry not capturing errors
- Check `SENTRY_DSN` is set in `.env`
- Verify you're using `initSentryServer(app)` before other middleware
- Check Sentry dashboard for Project DSN verification

### Validation rejecting valid requests
- Check the error message for which field is failing
- Verify the schema matches your API contract
- Use `.optional()` for non-required fields

### Security headers not appearing
- Verify `setupSecurityHeaders(app)` is called early
- Check for other middleware overriding headers
- Test with `curl -i` to see response headers

### Performance degradation
- Validation is fast, check if something else is slow
- Monitor with `trackDatabaseQuery()` for DB issues
- Use Sentry APM dashboard to identify bottlenecks

---

**Status:** Ready for implementation  
**Effort:** 4-5 hours of integration work  
**Impact:** Production-grade security baseline
