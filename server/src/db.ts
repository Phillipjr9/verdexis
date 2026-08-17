import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const rawDatabaseProvider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
const DEFAULT_SQLITE_URL = 'file:./dev.db'
const DEFAULT_PROD_SQLITE_URL = `file:${path.join(os.tmpdir(), 'verdexis.db')}`
const FALLBACK_SQLITE_FILE = path.join(os.tmpdir(), 'verdexis.db')
const RENDER_SQLITE_FILE = path.join(os.tmpdir(), 'verdexis-render.db')
const DEFAULT_DATABASE_URL = rawDatabaseProvider === 'sqlite'
  ? DEFAULT_SQLITE_URL
  : 'postgresql://postgres:postgres@127.0.0.1:5432/verdexis'
const isPostgresUrl = (value: string): boolean => /^postgres(?:ql)?:\/\//i.test(value)
const isSqliteUrl = (value: string): boolean => /^(file:|sqlite:)/i.test(value)
const normalizeSqliteUrl = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_SQLITE_URL
  if (isSqliteUrl(trimmed)) return trimmed
  if (trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('/')) return `file:${trimmed}`
  return `file:${trimmed}`
}
let databaseUrl = (process.env.DATABASE_URL || '').trim()
let provider = rawDatabaseProvider
let databaseUrlSource = 'env'

const maskDatabaseUrl = (url: string): string => {
  if (!url) return '<unset>'
  try {
    const parsed = new URL(url)
    if (parsed.password) parsed.password = '***'
    return parsed.toString()
  } catch {
    return url.replace(/:(?:[^:@]*?)@/, ':***@')
  }
}

if (databaseUrl && isSqliteUrl(databaseUrl)) {
  provider = 'sqlite'
}

if (provider === 'sqlite') {
  databaseUrl = normalizeSqliteUrl(databaseUrl)
}

if (!databaseUrl) {
  if (provider === 'sqlite') {
    databaseUrlSource = 'default'
    console.warn('[verdexis-api] DATABASE_URL not set for sqlite provider; using local SQLite default file: ./dev.db')
    databaseUrl = DEFAULT_DATABASE_URL
  } else {
    throw new Error('DATABASE_URL is required when DATABASE_PROVIDER=postgresql. No SQLite fallback is allowed in production.')
  }
} else if (provider === 'sqlite' && !isSqliteUrl(databaseUrl)) {
  throw new Error(`DATABASE_URL must be a valid SQLite URL when DATABASE_PROVIDER=sqlite. Received: ${databaseUrl}`)
} else if (provider !== 'sqlite' && !isPostgresUrl(databaseUrl)) {
  throw new Error(`DATABASE_URL must be a valid Postgres URL when DATABASE_PROVIDER=postgresql. Received: ${databaseUrl}`)
}

if (provider === 'sqlite' && databaseUrl.includes('%')) {
  try {
    const url = new URL(databaseUrl)
    databaseUrl = url.toString()
  } catch (err) {
    console.error('[verdexis-api] Invalid DATABASE_URL format:', err instanceof Error ? err.message : String(err))
  }
} else if (provider !== 'sqlite' && databaseUrl.includes('%')) {
  try {
    const url = new URL(databaseUrl)
    databaseUrl = url.toString()
  } catch (err) {
    console.error('[verdexis-api] Invalid DATABASE_URL format:', err instanceof Error ? err.message : String(err))
  }
}

process.env.DATABASE_URL = databaseUrl
process.env.DATABASE_PROVIDER = provider
process.env.DIRECT_URL = databaseUrl

console.log('[verdexis-api] Prisma raw DATABASE_PROVIDER env:', rawDatabaseProvider)
console.log('[verdexis-api] Prisma provider:', provider)
console.log('[verdexis-api] Prisma database URL:', maskDatabaseUrl(databaseUrl))
console.log('[verdexis-api] Prisma database URL source:', databaseUrlSource)

const prismaClientOptions: any = {
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'minimal',
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
}

if (provider !== 'sqlite') {
  const poolSize = Math.min(parseInt(process.env.DATABASE_POOL_SIZE || '20'), 30)
  const connectionTimeout = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000')

  if (databaseUrl.includes('rds.amazonaws.com')) {
    prismaClientOptions.datasources.db.url = `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require&connection_limit=${poolSize}&connect_timeout=${connectionTimeout}`
  } else if (databaseUrl.includes('supabase.co') && !/sslmode=/i.test(databaseUrl)) {
    prismaClientOptions.datasources.db.url = `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require&connection_limit=${poolSize}`
  } else {
    prismaClientOptions.datasources.db.url = `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=${poolSize}`
  }
}

function createDbUnavailableError(message: string): Error {
  const error = new Error(message)
  ;(error as Error & { code?: string }).code = 'P1001'
  return error
}

function createFallbackValue(message: string): any {
  const thrower = () => {
    throw createDbUnavailableError(message)
  }

  return new Proxy(thrower, {
    get: (_target, prop) => {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined
      }
      return createFallbackValue(message)
    },
    apply: () => {
      throw createDbUnavailableError(message)
    },
  })
}

// If we're running with the SQLite fallback at runtime, attempt to apply the
// Prisma schema to the runtime SQLite file before instantiating the client so
// tables exist (useful for Render ephemeral files). This uses top-level await
// which is supported in ESM Node runtimes (Node >= 14.8 with `type: module`).
if (provider === 'sqlite') {
  try {
    console.log('[verdexis-api] Applying Prisma schema to runtime SQLite database before client init')
    const { execSync } = await import('node:child_process')
    execSync('npx prisma db push --schema prisma/schema.sqlite.prisma', { env: process.env, stdio: 'inherit' })
    console.log('[verdexis-api] Runtime prisma db push completed')
  } catch (err) {
    console.warn('[verdexis-api] runtime prisma db push failed:', err instanceof Error ? err.message : String(err))
  }
}

let currentPrismaClient = global.__prisma || new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = currentPrismaClient
}

function createPrismaOperationProxy<T extends object>(target: T): T {
  return new Proxy(target, {
    get(innerTarget, innerProp, innerReceiver) {
      const value = Reflect.get(innerTarget, innerProp, innerReceiver)
      if (typeof value === 'function') {
        const fn = value as (...args: unknown[]) => unknown
        return async (...args: unknown[]) => {
          await waitForDatabaseInitialization()
          return (fn as Function).apply(innerTarget, args)
        }
      }
      if (value && typeof value === 'object') {
        return createPrismaOperationProxy(value)
      }
      return value
    },
  }) as T
}

// Ensure connection on startup with retries, but do not crash the whole server if
// the database is unavailable. The app can continue in a degraded local-auth mode.
let connectionAttempts = 0
const MAX_RETRIES = 3
export let dbUnavailable = false
let databaseInitializationPromise: Promise<void> | null = null

// Health check cache: avoid hitting DB on every operation
let lastHealthCheckTime = 0
let lastHealthCheckResult = false
const HEALTH_CHECK_CACHE_TTL = 30000 // 30 seconds

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(currentPrismaClient, prop, receiver)
    if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown
      return async (...args: unknown[]) => {
        // Wait for initial connection only on first startup
        if (!databaseInitializationPromise && lastHealthCheckTime === 0) {
          await waitForDatabaseInitialization()
        }
        // On subsequent operations, use cached health check
        await checkDatabaseHealth()
        return (fn as Function).apply(currentPrismaClient, args)
      }
    }
    if (value && typeof value === 'object') {
      return createPrismaOperationProxy(value)
    }
    return value
  },
}) as PrismaClient

export const databaseProvider = provider
export const isSqliteDatabase = provider === 'sqlite'

async function ensureFallbackDatabaseSeed() {
  if (provider !== 'sqlite') return

  try {
    const fallbackClient = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })
    await fallbackClient.$connect()
    const adminEmail = (process.env.ADMIN_EMAILS || 'admin@verdexisgroup.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)[0]
    if (adminEmail) {
      const existing = await fallbackClient.user.findUnique({ where: { email: adminEmail } })
      if (!existing) {
        const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin@Verdexis2024'
        const passwordHash = await bcrypt.hash(seedPassword, 12)
        await fallbackClient.user.create({
          data: {
            email: adminEmail,
            name: 'Admin',
            passwordHash,
            investmentId: `VDX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            role: 'admin',
          },
        })
        console.log(`[verdexis-api] Seeded fallback admin user ${adminEmail}`)
      }
    }
    await fallbackClient.$disconnect()
  } catch (error) {
    console.warn('[verdexis-api] Failed to seed fallback SQLite admin user:', error instanceof Error ? error.message : String(error))
  }
}

async function ensureConnection() {
  dbUnavailable = false
  const dbHost = databaseUrl.match(/@([^:/?]+)/) ? databaseUrl.match(/@([^:/?]+)/)![1] : 'unknown'
  console.log('[verdexis-api] Attempting to connect to database...')
  console.log('[verdexis-api] Database host:', dbHost)

  while (connectionAttempts < MAX_RETRIES) {
    try {
      await currentPrismaClient.$connect()
      await currentPrismaClient.$queryRaw`SELECT 1`
      if (provider === 'sqlite') {
        await ensureFallbackDatabaseSeed()
      }
      console.log('[verdexis-api] ✅ Database connected successfully')
      return
    } catch (err) {
      connectionAttempts++
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[verdexis-api] ⚠️ Connection attempt ${connectionAttempts}/${MAX_RETRIES} failed: ${errorMsg}`)

      if (provider !== 'sqlite' && process.env.NODE_ENV === 'production') {
        dbUnavailable = true
        console.error('[verdexis-api] Production database connection failed. Refusing to fall back to SQLite so the app does not silently use the wrong database.')
        console.error('[verdexis-api] Check DATABASE_URL, Render networking, SSL settings, and the Postgres service status.')
        console.error('[verdexis-api] Current database target:', maskDatabaseUrl(databaseUrl))
        return
      }

      if (connectionAttempts < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000)
        console.log(`[verdexis-api] ⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        dbUnavailable = true
        console.warn('[verdexis-api] ⚠️ Database unavailable; continuing in degraded local-auth mode')
        return
      }
    }
  }
}

export function waitForDatabaseInitialization(): Promise<void> {
  // Only run ensureConnection once on startup
  if (databaseInitializationPromise) {
    return databaseInitializationPromise
  }

  databaseInitializationPromise = ensureConnection()
    .catch(err => {
      dbUnavailable = true
      console.warn('[verdexis-api] ⚠️ Database initialization skipped:', err instanceof Error ? err.message : String(err))
      throw err
    })

  return databaseInitializationPromise
}

// Per-operation health check with caching to avoid repeated connection checks
// Does NOT throw - allows queries to proceed even if health check fails
async function checkDatabaseHealth(): Promise<void> {
  const now = Date.now()
  
  // Use cached result if fresh (within 30s)
  if ((now - lastHealthCheckTime) < HEALTH_CHECK_CACHE_TTL) {
    return
  }
  
  // Run health check (simple query) - silently fail, don't propagate error
  try {
    await currentPrismaClient.$queryRaw`SELECT 1`
    lastHealthCheckResult = true
    lastHealthCheckTime = now
  } catch (err) {
    // Don't throw - let the actual query fail naturally if DB is down
    // This prevents spurious 503s from the health check itself
    lastHealthCheckResult = false
    lastHealthCheckTime = now
    // Don't set dbUnavailable here; let individual queries fail on their own
  }
}

// Start connection attempts without crashing the process.
waitForDatabaseInitialization()

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    try {
      await prisma.$disconnect()
      console.log('[verdexis-api] Database connection closed gracefully')
    } catch (err) {
      console.error('[verdexis-api] Error during graceful shutdown:', err instanceof Error ? err.message : String(err))
    }
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
}
