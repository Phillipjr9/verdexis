import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const rawDatabaseProvider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
const DEFAULT_DATABASE_URL = rawDatabaseProvider === 'sqlite'
  ? 'file:./dev.db'
  : 'postgresql://postgres:postgres@127.0.0.1:5432/verdexis'
const isPostgresUrl = (value: string): boolean => /^postgres(?:ql)?:\/\//i.test(value)
const isSqliteUrl = (value: string): boolean => /^(file:|sqlite:)/i.test(value)

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

if (!databaseUrl) {
  databaseUrlSource = 'default'
  if (provider === 'sqlite') {
    console.warn('[verdexis-api] DATABASE_URL not set; using local SQLite fallback file: ./dev.db')
    databaseUrl = DEFAULT_DATABASE_URL
  } else {
    console.warn('[verdexis-api] DATABASE_URL not set; using default Postgres fallback')
    databaseUrl = DEFAULT_DATABASE_URL
  }
} else if (provider === 'sqlite' && !isSqliteUrl(databaseUrl)) {
  databaseUrlSource = 'fallback'
  console.warn(`[verdexis-api] DATABASE_PROVIDER=sqlite but DATABASE_URL '${databaseUrl}' is not a valid SQLite URL; using default SQLite file: ./dev.db`)
  databaseUrl = 'file:./dev.db'
} else if (provider !== 'sqlite' && !isPostgresUrl(databaseUrl)) {
  databaseUrlSource = 'fallback'
  console.warn(`[verdexis-api] DATABASE_URL '${databaseUrl}' is not a valid Postgres URL; using default Postgres fallback`)
  databaseUrl = DEFAULT_DATABASE_URL
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

if (provider !== 'sqlite' && databaseUrl.includes('rds.amazonaws.com')) {
  const poolSize = Math.min(parseInt(process.env.DATABASE_POOL_SIZE || '20'), 30)
  const connectionTimeout = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000')
  prismaClientOptions.datasources.db.url = `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require&connection_limit=${poolSize}&connect_timeout=${connectionTimeout}`
} else if (provider !== 'sqlite') {
  const poolSize = Math.min(parseInt(process.env.DATABASE_POOL_SIZE || '20'), 30)
  prismaClientOptions.datasources.db.url = `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=${poolSize}`
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

const actualPrismaClient = global.__prisma || new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = actualPrismaClient
}

// Ensure connection on startup with retries, but do not crash the whole server if
// the database is unavailable. The app can continue in a degraded local-auth mode.
let connectionAttempts = 0
const MAX_RETRIES = 3
export let dbUnavailable = false

export const prisma = new Proxy(actualPrismaClient, {
  get(target, prop, receiver) {
    if (dbUnavailable) {
      if (prop === '$connect') {
        return async () => {
          throw createDbUnavailableError('[verdexis-api] Database unavailable; Prisma access is disabled in degraded startup mode')
        }
      }
      if (prop === '$disconnect') {
        return async () => undefined
      }
      if (prop === '$queryRaw') {
        return async () => {
          throw createDbUnavailableError('[verdexis-api] Database unavailable; Prisma access is disabled in degraded startup mode')
        }
      }
      if (prop === '$transaction') {
        return async () => {
          throw createDbUnavailableError('[verdexis-api] Database unavailable; Prisma access is disabled in degraded startup mode')
        }
      }
      if (typeof prop === 'string' && prop.startsWith('$')) {
        return async () => {
          throw createDbUnavailableError('[verdexis-api] Database unavailable; Prisma access is disabled in degraded startup mode')
        }
      }
      return createFallbackValue('[verdexis-api] Database unavailable; request skipped until the database is reachable')
    }

    return Reflect.get(target, prop, receiver)
  },
}) as PrismaClient

export const databaseProvider = provider
export const isSqliteDatabase = provider === 'sqlite'

async function ensureConnection() {
  const dbHost = databaseUrl.match(/@([^:/?]+)/) ? databaseUrl.match(/@([^:/?]+)/)![1] : 'unknown'
  console.log('[verdexis-api] Attempting to connect to database...')
  console.log('[verdexis-api] Database host:', dbHost)

  while (connectionAttempts < MAX_RETRIES) {
    try {
      await prisma.$connect()
      await prisma.$queryRaw`SELECT 1`
      console.log('[verdexis-api] ✅ Database connected successfully')
      return
    } catch (err) {
      connectionAttempts++
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[verdexis-api] ⚠️ Connection attempt ${connectionAttempts}/${MAX_RETRIES} failed: ${errorMsg}`)

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

// Start connection attempts without crashing the process.
ensureConnection().catch(err => {
  dbUnavailable = true
  console.warn('[verdexis-api] ⚠️ Database initialization skipped:', err instanceof Error ? err.message : String(err))
})

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
