import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Ensure DATABASE_URL is properly formatted
let databaseUrl = process.env.DATABASE_URL || ''

// If URL contains encoded characters, ensure it's properly formatted
if (databaseUrl && databaseUrl.includes('%')) {
  try {
    // Parse the URL to ensure proper encoding
    const url = new URL(databaseUrl)
    // Prisma expects the URL to be properly formatted
    databaseUrl = url.toString()
  } catch (err) {
    console.error('[verdexis-api] Invalid DATABASE_URL format:', err)
  }
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

// Ensure connection on startup with retries
let connectionAttempts = 0
const MAX_RETRIES = 5

async function ensureConnection() {
  console.log('[verdexis-api] Attempting to connect to database...')
  console.log('[verdexis-api] Database host:', databaseUrl.match(/@([^:]+):/)?.[1] || 'unknown')
  
  while (connectionAttempts < MAX_RETRIES) {
    try {
      await prisma.$connect()
      await prisma.$queryRaw`SELECT 1`
      console.log('[verdexis-api] Database connected successfully')
      return
    } catch (err) {
      connectionAttempts++
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[verdexis-api] Database connection attempt ${connectionAttempts}/${MAX_RETRIES} failed:`, errorMsg)
      if (connectionAttempts < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000)
        console.log(`[verdexis-api] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error('[verdexis-api] DATABASE CONNECTION FAILED - All retries exhausted')
        console.error('[verdexis-api] Check that:')
        console.error('  1. DATABASE_URL environment variable is set correctly')
        console.error('  2. PostgreSQL database exists and is running')
        console.error('  3. Network allows connections to the database')
        console.error('  4. Credentials are correct')
      }
    }
  }
}

// Start connection attempts
ensureConnection().catch(err => {
  console.error('[verdexis-api] Fatal: Could not establish database connection:', err)
})

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    try {
      await prisma.$disconnect()
    } catch (err) {
      console.error('[verdexis-api] Prisma disconnect error:', err)
    }
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
}
