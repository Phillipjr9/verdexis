// server/src/app.ts
import 'dotenv/config'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { env } from './env.js'
import { prisma } from './db.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import compression from 'compression'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import holdingsRoutes from './routes/holdings.js'
import walletRoutes from './routes/wallet.js'
import tradesRoutes from './routes/trades.js'
import watchlistRoutes from './routes/watchlist.js'
import alertsRoutes from './routes/alerts.js'
import notificationsRoutes from './routes/notifications.js'
import aiRoutes from './routes/ai.js'
import marketRoutes from './routes/market.js'
import reviewsRoutes from './routes/reviews.js'
import adminRoutes from './routes/admin.js'
import adminEmailActionsRoutes from './routes/adminEmailActions.js'
import referralRoutes from './routes/referral.js'
import dcaRoutes from './routes/dca.js'
import depositAddressesRoutes from './routes/depositAddresses.js'
import depositsRoutes from './routes/deposits.js'
import amazonOAuthRoutes from './routes/amazon-oauth.js'
import advancedOrdersRoutes from './routes/advancedOrders.js'
import passkeysRoutes from './routes/passkeys.js'
import kycRoutes from './routes/kyc.js'
import copyTradingRoutes from './routes/copyTrading.js'
import auditRoutes from './routes/audit.js'
import nftRoutes from './routes/nft.js'
import adminHierarchyRoutes from './routes/admin-hierarchy.js'
import otpRoutes from './routes/otp.js'
import withdrawalsRoutes from './routes/withdrawals.js'
import portfolioRoutes from './routes/portfolio.js'
import stakingRoutes from './routes/staking.js'
import walletVerificationRoutes from './routes/wallet-verification.js'
import transactionExportRoutes from './routes/transaction-export.js'
import limitsRoutes from './routes/limits.js'
import adminFeaturesRoutes from './routes/admin-features.js'
import advancedTradingRoutes from './routes/advanced-trading.js'
import riskManagementRoutes from './routes/risk-management.js'
import notificationsManagementRoutes from './routes/notifications-management.js'
import tokenRegistryRoutes from './routes/tokenRegistry.js'
import kycEnhancedRoutes, { setPrisma as setKycEnhancedPrisma } from './routes/kyc-enhanced.js'
import analyticsRoutes from './routes/analytics.js'
import advancedAnalyticsRoutes from './routes/advanced-analytics.js'
import advancedTaxRoutes from './routes/advanced-tax.js'
import advancedComplianceRoutes from './routes/advanced-compliance.js'
import advancedNotificationsRoutes from './routes/advanced-notifications.js'
import securityRoutes from './routes/security.js'
import adminWithdrawalConfigRoutes from './routes/admin-withdrawal-config.js'
import userSecurityRoutes from './routes/userSecurity.js'
import apiKeysRoutes from './routes/apiKeys.js'
import adminSettingsRoutes from './routes/admin-settings.js'
import { requestContextMiddleware } from './logging.js'
import { createErrorResponse } from './errorHandler.js'
import { isDbUnavailableError } from './dbError.js'
import { registerOpenApiDocs } from './openapiDocs.js'
import './securityJobs.js'

const app = express()
app.set('etag', false)

const IS_PROD = env.NODE_ENV === 'production'
if (IS_PROD && !process.env.JWT_SECRET) {
  console.error('[verdexis-api] JWT_SECRET is required in production')
  process.exit(1)
}

const normalizeOrigin = (value: string): string => value.trim().toLowerCase()
  .replace(/\/+$/g, '')
  .replace(/\s+/g, '')
  .replace(/:443$/, '')
  .replace(/:80$/, '')
const CORS_ORIGIN = env.CORS_ORIGIN.split(',').map((s) => normalizeOrigin(s)).filter(Boolean)
const SELF_ORIGINS = [process.env.RENDER_EXTERNAL_URL, process.env.PUBLIC_URL, process.env.PRODUCTION_ORIGIN, env.APP_BASE_URL]
  .filter((s): s is string => !!s)
  .map(normalizeOrigin)
const EXTRA_ORIGINS = [
  'https://verdexisgroup.com',
  'https://www.verdexisgroup.com',
  'https://verdexisgroup.com/',
  'https://www.verdexisgroup.com/',
  'https://verdexis.vercel.app',
  'https://verdexis-bice.vercel.app',
]
const LAN_ORIGIN_RE = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?$/
const PAGES_DEV_ORIGIN_RE = /^https:\/\/(?:[a-z0-9-]+\.)*pages\.dev(?:\:443)?$/i
const VERCEL_APP_ORIGIN_RE = /^https:\/\/(?:[a-z0-9-]+\.)*vercel\.app(?:\:443)?$/i
const PAGES_DEV_ORIGINS = new Set(['https://verdexis.pages.dev', 'https://www.verdexis.pages.dev'])
const ALLOWED_ORIGINS = new Set([...CORS_ORIGIN, ...SELF_ORIGINS, ...EXTRA_ORIGINS, ...PAGES_DEV_ORIGINS])
console.log('[verdexis-api] CORS allowed origins:', JSON.stringify(Array.from(ALLOWED_ORIGINS).sort()))

app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
}))
app.use(compression())
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const normalizedOrigin = normalizeOrigin(origin)
      if (
        ALLOWED_ORIGINS.has(normalizedOrigin) ||
        PAGES_DEV_ORIGIN_RE.test(normalizedOrigin) ||
        VERCEL_APP_ORIGIN_RE.test(normalizedOrigin)
      ) return cb(null, true)
      if (!IS_PROD && LAN_ORIGIN_RE.test(normalizedOrigin)) return cb(null, true)
      console.warn(`[CORS] Blocked origin: ${origin} normalized: ${normalizedOrigin}`)
      cb(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Idempotent-Replay'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
  }),
)
app.options('*', cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    const normalizedOrigin = normalizeOrigin(origin)
    if (
      ALLOWED_ORIGINS.has(normalizedOrigin) ||
      PAGES_DEV_ORIGIN_RE.test(normalizedOrigin) ||
      VERCEL_APP_ORIGIN_RE.test(normalizedOrigin)
    ) return cb(null, true)
    if (!IS_PROD && LAN_ORIGIN_RE.test(normalizedOrigin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
}))
app.use(express.json({ limit: '512kb' }))
app.use(cookieParser())
app.use(morgan(IS_PROD ? 'combined' : 'dev'))
app.use(requestContextMiddleware)

function rateLimitKey(req: express.Request): string {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(header.slice(7)) as { sub?: string } | null
      if (decoded?.sub) return `u:${decoded.sub}`
    } catch {
      /* fall through to IP */
    }
  }
  return `ip:${req.ip || 'anon'}`
}
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
  }),
)

registerOpenApiDocs(app)

const SERVER_BOOT_TIME = Date.now()
let DB_READY = false

async function initializeDatabase(): Promise<void> {
  try {
    await prisma.$connect()
    DB_READY = true
    console.log('[verdexis-api] Database initialized and schema synced')
  } catch (err) {
    console.error('[verdexis-api] Database initialization failed:', err)
  }
}

initializeDatabase()
setKycEnhancedPrisma(prisma)

app.get('/api/health', async (_req, res) => {
  const dbReady = DB_READY
  let dbStatus = dbReady ? 'Ready' : 'Unavailable'

  if (!dbReady) {
    try {
      await prisma.$queryRaw`SELECT 1`
      dbStatus = 'Connected'
    } catch {
      dbStatus = 'Failed'
    }
  }

  // Never expose internal error details, env name, node version, or DB URL
  // status in a public health endpoint — only return what a load-balancer needs.
  res.json({
    ok: true,
    service: 'verdexis-api',
    uptimeSec: Math.round((Date.now() - SERVER_BOOT_TIME) / 1000),
    database: dbStatus,
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/holdings', holdingsRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/trades', tradesRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/market', marketRoutes)
app.use('/api/reviews', reviewsRoutes)
// Short-lived, signed deposit approval links embedded in internal admin mail.
// This route intentionally sits outside the normal session-authenticated
// admin router because the signed token is the one-time capability.
app.use('/api/admin/email-actions', adminEmailActionsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/dca', dcaRoutes)
app.use('/api/deposit-addresses', depositAddressesRoutes)
app.use('/api/deposits', depositsRoutes)
app.use('/api/oauth', amazonOAuthRoutes)
app.use('/api/trades/advanced', advancedOrdersRoutes)
// advancedTradingRoutes registered below under its own path
app.use('/api/passkeys', passkeysRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/kyc/enhanced', kycEnhancedRoutes)
app.use('/api/copy-trading', copyTradingRoutes)
app.use('/api', auditRoutes)
app.use('/api/nfts', nftRoutes)
app.use('/api/admin/hierarchy', adminHierarchyRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/withdrawals', withdrawalsRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/staking', stakingRoutes)
app.use('/api/wallet/verification', walletVerificationRoutes)
app.use('/api/transactions', transactionExportRoutes)
app.use('/api/limits', limitsRoutes)
app.use('/api/admin/features', adminFeaturesRoutes)
app.use('/api/advanced-trading', advancedTradingRoutes)
app.use('/api/risk', riskManagementRoutes)
app.use('/api/notifications-management', notificationsManagementRoutes)
app.use('/api/admin/token-registry', tokenRegistryRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/analytics/advanced', advancedAnalyticsRoutes)
app.use('/api/tax', advancedTaxRoutes)
app.use('/api/compliance', advancedComplianceRoutes)
app.use('/api/notifications/advanced', advancedNotificationsRoutes)
app.use('/api/security', securityRoutes)
app.use('/api/admin/withdrawal-config', adminWithdrawalConfigRoutes)
app.use('/api/user-security', userSecurityRoutes)
app.use('/api/api-keys', apiKeysRoutes)
app.use('/api/admin/settings', adminSettingsRoutes)

app.post('/api/admin/cache/clear', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json(createErrorResponse('Unauthorized'))
    return
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { sub?: string }
    const user = decoded?.sub ? await prisma.user.findUnique({ where: { id: decoded.sub }, select: { role: true } }) : null
    if (user?.role !== 'admin') {
      res.status(403).json(createErrorResponse('Forbidden: admin access required'))
      return
    }
  } catch {
    res.status(401).json(createErrorResponse('Invalid or expired token'))
    return
  }

  const type = String(req.body.type ?? 'all').toLowerCase()
  const validTypes = ['market', 'news', 'all']
  if (!validTypes.includes(type)) {
    res.status(400).json(createErrorResponse('Invalid cache type', { type, valid: validTypes }))
    return
  }

  res.json({ ok: true, cleared: type, timestamp: new Date().toISOString() })
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const STATIC_DIR = path.resolve(__dirname, '../public')
if (IS_PROD && fs.existsSync(STATIC_DIR)) {
  app.use(
    express.static(STATIC_DIR, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (/\/assets\/.+\.[a-f0-9]{6,}\.(js|css|woff2?|png|jpg|svg)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    }),
  )
  app.get(/^(?!\/api\/).*/, (_req, res, next) => {
    const indexPath = path.join(STATIC_DIR, 'index.html')
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath)
    next()
  })
}

app.use((req, res) => {
  res.status(404).json(createErrorResponse('Not found', undefined, req.path))
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[verdexis-api] unhandled error on ${req.method} ${req.path}:`, err)
  if (isDbUnavailableError(err)) {
    res.status(503).json(createErrorResponse('Database unavailable', undefined, req.path))
    return
  }
  const detail = IS_PROD ? undefined : (err?.message || String(err))
  res.status(500).json(createErrorResponse('Internal server error', detail, req.path))
})

export default app
