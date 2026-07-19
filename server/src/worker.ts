import { startBackgroundJobs } from './backgroundJobs.js'
import { emailDigest } from './emailDigestService.js'
import { pushNotifications } from './pushNotificationService.js'
import redisService from './lib/redis.js'

let digestInterval: NodeJS.Timeout | null = null

export async function startWorker(): Promise<void> {
  console.log('[worker] starting background worker')

  try {
    await redisService.initRedis()
  } catch (err) {
    console.warn('[worker] redis init failed, continuing without redis:', err)
  }

  // Start background interval-based jobs
  startBackgroundJobs()

  // Schedule email digests once/day; also run once immediately
  try {
    await emailDigest.scheduleDigests()
  } catch (err) {
    console.error('[worker] initial email digest run failed:', err)
  }

  digestInterval = setInterval(async () => {
    try {
      await emailDigest.scheduleDigests()
    } catch (err) {
      console.error('[worker] scheduled email digest failed:', err)
    }
  }, 24 * 60 * 60 * 1000) // daily

  // Push notifications service is initialized on import; log status
  console.log('[worker] push notifications initialized')
}

export function stopWorker(): void {
  if (digestInterval) {
    clearInterval(digestInterval)
    digestInterval = null
  }
  console.log('[worker] stopped')
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('worker.ts')) {
  startWorker().catch((err) => {
    console.error('[worker] failed to start:', err)
    process.exitCode = 1
  })
}
