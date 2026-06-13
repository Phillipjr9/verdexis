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
import referralRoutes from './routes/referral.js'
import dcaRoutes from './routes/dca.js'
import depositAddressesRoutes from './routes/depositAddresses.js'
import depositsRoutes from './routes/deposits.js'
import { isDbUnavailableError } from './dbError.js'
import { requestContextMiddleware } from './logging.js'
import { createErrorResponse } from './errorHandler.js'

const app = express()
app.set('etag', false)

const IS_PROD = env.NODE_ENV === 'production'
if (IS_PROD && !process.env.JWT_SECRET) {
  console.error('[verdexis-api] JWT_SECRET is required in production')
  process.exit(1)
}

const CORS_ORIGIN = env.CORS_ORIGIN.split(',').map((s) => s.trim())
const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$|\s+/g, '')
const SELF_ORIGINS = [process.env.RENDER_EXTERNAL_URL, process.env.PUBLIC_URL, process.env.PRODUCTION_ORIGIN, env.APP_BASE_URL]
  .filter((s): s is string => !!s)
  .map(normalizeOrigin)
const LAN_ORIGIN_RE = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?$/
const ALLOWED_ORIGINS = new Set([...CORS_ORIGIN, ...SELF_ORIGINS])

app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(compression())
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true)
      if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return cb(null, true)
      if (!IS_PROD && LAN_ORIGIN_RE.test(origin)) return cb(null, true)
      cb(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Idempotent-Replay'],
  }),
)
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

app.get('/api/health', async (_req, res) => {
  const dbReady = DB_READY
  const dbStatus = dbReady ? 'Ready' : 'Unavailable'
  res.json({
    ok: true,
    service: 'verdexis-api',
    version: '0.1.0',
    env: env.NODE_ENV,
    uptimeSec: Math.round((Date.now() - SERVER_BOOT_TIME) / 1000),
    nodeVersion: process.version,
    bootedAt: new Date(SERVER_BOOT_TIME).toISOString(),
    database: dbStatus,
    databaseReady: dbReady,
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
app.use('/api/referrals', referralRoutes)
app.use('/api/dca', dcaRoutes)
app.use('/api/deposit-addresses', depositAddressesRoutes)
app.use('/api/deposits', depositsRoutes)

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
    res.status(503).json(createErrorResponse('Database unavailable', err.message || String(err), req.path))
    return
  }
  res.status(500).json(createErrorResponse('Internal server error', err?.message || String(err), req.path))
})

export default app
