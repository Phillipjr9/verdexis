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
  })

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

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
