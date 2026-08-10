import 'dotenv/config'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { env } from './env.js'
import { prisma, waitForDatabaseInitialization } from './db.js'
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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WebSocketServer } from 'ws'
import http from 'node:http'
import authRoutes, { promoteAllAdminEmails } from './routes/auth.js'
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
import adminBonusRoutes from './routes/adminBonus.js'
import swapRoutes from './routes/swap.js'
import referralRoutes from './routes/referral.js'
import dcaRoutes from './routes/dca.js'
import depositAddressesRoutes from './routes/depositAddresses.js'
import depositsRoutes from './routes/deposits.js'
import amazonOAuthRoutes from './routes/amazon-oauth.js'
import advancedOrdersRoutes from './routes/advancedOrders.js'
import passkeysRoutes from './routes/passkeys.js'
import kycRoutes from './routes/kyc.js'
import withdrawalsRoutes from './routes/withdrawals.js'
import otpRoutes from './routes/otp.js'
import { startAlertPoller } from './alertPoller.js'
import { startDcaPoller } from './dcaPoller.js'
import { startKeepAlive } from './keepAlive.js'
import { isDbUnavailableError } from './dbError.js'
import { requestContextMiddleware } from './logging.js'
import { createErrorResponse } from './errorHandler.js'
import { priceStreamManager } from './websocket.js'
import { depositMonitor } from './depositMonitor.js'
import { startOTPCleanup } from './otpCleanup.js'
import redisService from './lib/redis.js'
import tokenRegistryRoutes from './routes/tokenRegistry.js'
import { registerComplianceRoutes } from './compliance/routes.js'
import { registerComplianceAdminRoutes } from './compliance/adminRoutes.js'
import { registerOpenApiDocs } from './openapiDocs.js'
import advancedAnalyticsRoutes from './routes/advanced-analytics.js'
import advancedTaxRoutes from './routes/advanced-tax.js'
import advancedComplianceRoutes from './routes/advanced-compliance.js'
import advancedNotificationsRoutes from './routes/advanced-notifications.js'

const app = express()
app.set('etag', false)
const PORT = env.PORT
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
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true)
    }

    const normalizedOrigin = normalizeOrigin(origin)

    // Check against allowed origins
    if (
      ALLOWED_ORIGINS.has(normalizedOrigin) ||
      PAGES_DEV_ORIGIN_RE.test(normalizedOrigin) ||
      VERCEL_APP_ORIGIN_RE.test(normalizedOrigin)
    ) {
      return callback(null, true)
    }

    console.warn(`[CORS] Blocked origin: ${origin} normalized: ${normalizedOrigin}`)

    // In production, only allow explicit origins from configuration.
    if (IS_PROD) {
      console.warn(`[CORS] Blocked origin in production: ${origin}`)
      return callback(new Error('Not allowed by CORS'), false)
    }

    // In development, allow localhost and LAN addresses
    if (!IS_PROD) {
      if (LAN_ORIGIN_RE.test(normalizedOrigin)) {
        return callback(null, true)
      }
      
      // Allow common development ports
      if (/^http:\/\/localhost:\d+$/.test(normalizedOrigin)) {
        return callback(null, true)
      }
    }

    // Block all other origins
    console.warn(`[CORS] Blocked origin: ${origin}`)
    return callback(new Error('Not allowed by CORS'), false)
  },
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control'
  ],
  exposedHeaders: ['Idempotent-Replay', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '512kb' }))
app.use(cookieParser())
app.use(morgan(IS_PROD ? 'combined' : 'dev'))
app.use(requestContextMiddleware)

// Rate limiting configuration
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

// Global API rate limiting (per IP/user)
const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 600, // 600 requests per minute per IP/user
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health'
  }
})

// Stricter rate limiting for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // 30 attempts per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const body = (req.body ?? {}) as { email?: string; identifier?: string }
    const identifier = body.email || body.identifier || ''
    return `auth:${req.ip || 'anon'}:${identifier.toLowerCase().trim()}`
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  message: { error: 'Too many authentication attempts, please try again later.' }
})

// Apply rate limiters
app.use('/api/', globalRateLimiter)
app.use('/api/auth/login', authRateLimiter)
app.use('/api/auth/signup', authRateLimiter)
app.use('/api/auth/forgot', authRateLimiter)
app.use('/api/auth/reset', authRateLimiter)

registerOpenApiDocs(app)

const SERVER_BOOT_TIME = Date.now()
let DB_READY = false
let ADMIN_BOOTSTRAP_STATUS: 'pending' | 'ready' | 'failed' = 'pending'

async function initializeDatabase(): Promise<void> {
  try {
    await waitForDatabaseInitialization()
    DB_READY = true
    console.log('[verdexis-api] Database initialized and schema synced')
    await promoteAllAdminEmails()
    ADMIN_BOOTSTRAP_STATUS = 'ready'
  } catch (err) {
    ADMIN_BOOTSTRAP_STATUS = 'failed'
    console.error('[verdexis-api] Database initialization failed:', err)
  }
}

initializeDatabase()

app.get('/api/health', async (_req, res) => {
  let dbStatus = DB_READY ? 'Ready' : 'Unavailable'
  if (!DB_READY) {
    try {
      await waitForDatabaseInitialization()
      dbStatus = 'Ready'
      DB_READY = true
    } catch {
      dbStatus = 'Failed'
    }
  }
  res.json({
    ok: true,
    service: 'verdexis-api',
    uptimeSec: Math.round((Date.now() - SERVER_BOOT_TIME) / 1000),
    database: dbStatus,
    adminBootstrap: ADMIN_BOOTSTRAP_STATUS,
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
app.use('/api/admin', adminRoutes)
app.use('/api/admin', adminBonusRoutes)
app.use('/api/swap', swapRoutes)
app.use('/api/admin/token-registry', tokenRegistryRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/dca', dcaRoutes)
app.use('/api/deposit-addresses', depositAddressesRoutes)
app.use('/api/deposits', depositsRoutes)
app.use('/api/oauth', amazonOAuthRoutes)
app.use('/api/trades/advanced', advancedOrdersRoutes)
app.use('/api/passkeys', passkeysRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/withdrawals', withdrawalsRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/analytics', advancedAnalyticsRoutes)
app.use('/api/tax', advancedTaxRoutes)
app.use('/api/compliance', advancedComplianceRoutes)
app.use('/api/notifications', advancedNotificationsRoutes)

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

process.on('unhandledRejection', (reason) => {
  console.error('[verdexis-api] unhandledRejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[verdexis-api] uncaughtException:', error)
  process.exit(1)
})

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server })
  priceStreamManager.connectClients(wss)

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`[verdexis-api] listening on http://0.0.0.0:${PORT} (LAN reachable)`)
    console.log(`[verdexis-api] WebSocket server running on ws://0.0.0.0:${PORT}`)
    
    // Initialize Redis cache
    try {
      await redisService.initRedis()
    } catch (error) {
      console.warn('[verdexis-api] Redis initialization failed, continuing without cache:', error)
    }

    const startPersistenceServices = () => {
      if (!DB_READY) {
        console.warn('[verdexis-api] Database not ready yet; delaying persistence-backed startup tasks')
        const retryTimer = setInterval(() => {
          if (DB_READY) {
            clearInterval(retryTimer)
            startPersistenceServices()
          }
        }, 1000)
        return
      }

      if (env.ALERT_POLL_ENABLED) {
        startAlertPoller({ intervalMs: env.ALERT_POLL_INTERVAL_MS })
      }
      if (env.ALERT_POLL_ENABLED) {
        startDcaPoller({ intervalMs: 60_000 })
      }

      depositMonitor.initialize().then(() => depositMonitor.start()).catch(e => console.error('[deposit-monitor] init failed:', e))
      promoteAllAdminEmails().catch((e) => console.error('[verdexis-api] admin bootstrap failed:', e))
      startOTPCleanup()
    }

    startKeepAlive()
    // Register compliance webhook routes
    registerComplianceRoutes(app)
    // Register compliance admin routes
    registerComplianceAdminRoutes(app)
    startPersistenceServices()
  })
}
