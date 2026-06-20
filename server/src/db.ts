import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

// Ensure connection on startup with retries
let connectionAttempts = 0
const MAX_RETRIES = 5

async function ensureConnection() {
  while (connectionAttempts < MAX_RETRIES) {
    try {
      await prisma.$connect()
      console.log('[verdexis-api] Database connected successfully')
      return
    } catch (err) {
      connectionAttempts++
      console.error(`[verdexis-api] Database connection attempt ${connectionAttempts}/${MAX_RETRIES} failed:`, err)
      if (connectionAttempts < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000)
        console.log(`[verdexis-api] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error('[verdexis-api] DATABASE CONNECTION FAILED - All retries exhausted')
        console.error('[verdexis-api] DATABASE_URL format:', process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://***:***@'))
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
