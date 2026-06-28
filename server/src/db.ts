import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Ensure DATABASE_URL is properly formatted
let databaseUrl = process.env.DATABASE_URL || ''

// Validate DATABASE_URL format
if (!databaseUrl) {
  console.error('[verdexis-api] CRITICAL: DATABASE_URL environment variable is not set')
  throw new Error('DATABASE_URL is required')
}

// If URL contains encoded characters, ensure it's properly formatted
if (databaseUrl && databaseUrl.includes('%')) {
  try {
    // Parse the URL to ensure proper encoding
    const url = new URL(databaseUrl)
    // Prisma expects the URL to be properly formatted
    databaseUrl = url.toString()
  } catch (err) {
    console.error('[verdexis-api] Invalid DATABASE_URL format:', err instanceof Error ? err.message : String(err))
    // Continue with original URL if parsing fails
  }
}

const prismaClientOptions: any = {
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'minimal',
}

// For RDS PostgreSQL connections with SSL
if (databaseUrl.includes('rds.amazonaws.com')) {
  prismaClientOptions.datasources = {
    db: {
      url: `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`,
    },
  }
} else {
  prismaClientOptions.datasources = {
    db: {
      url: databaseUrl,
    },
  }
}

export const prisma = global.__prisma || new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}

// Ensure connection on startup with retries
let connectionAttempts = 0
const MAX_RETRIES = 5

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
      console.error(`[verdexis-api] ❌ Connection attempt ${connectionAttempts}/${MAX_RETRIES} failed: ${errorMsg}`)
      
      if (connectionAttempts < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000)
        console.log(`[verdexis-api] ⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error('[verdexis-api] ❌ DATABASE CONNECTION FAILED - All retries exhausted')
        console.error('[verdexis-api] Troubleshooting checklist:')
        console.error('  1. DATABASE_URL is set in Render environment variables')
        console.error('  2. PostgreSQL database exists and is running')
        console.error('  3. Database credentials are correct')
        console.error('  4. RDS security group allows inbound connections')
        console.error('  5. Database URL format: postgresql://user:password@host:port/dbname')
        throw new Error('Database connection failed after retries')
      }
    }
  }
}

// Start connection attempts
ensureConnection().catch(err => {
  console.error('[verdexis-api] FATAL: Could not establish database connection:', err instanceof Error ? err.message : String(err))
  process.exit(1)
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
