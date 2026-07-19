import Redis from 'ioredis'

/**
 * VERDEXIS Redis Caching Layer
 * Week 3: Performance optimization with caching
 */

export interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
}

export interface CacheStrategy {
  ttl: number // Time to live in seconds
  invalidateOn?: string[] // Events that trigger cache invalidation
}

const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // Market data - Fast changing, moderate TTL
  marketPrices: { ttl: 30 },
  marketChart: { ttl: 60 },
  marketNews: { ttl: 300 },

  // User data - Medium TTL, invalidate on user action
  userPortfolio: { ttl: 60, invalidateOn: ['trade-executed', 'deposit-processed', 'withdraw-processed'] },
  userProfile: { ttl: 300, invalidateOn: ['profile-updated'] },
  userSettings: { ttl: 600, invalidateOn: ['settings-updated'] },

  // Portfolio analytics - Longer TTL, compute intensive
  portfolioAnalytics: { ttl: 300, invalidateOn: ['trade-executed', 'holdings-updated'] },
  portfolioPerformance: { ttl: 600, invalidateOn: ['trade-executed'] },

  // Trading data - Medium TTL
  orderBook: { ttl: 5, invalidateOn: ['order-updated'] },
  recentTrades: { ttl: 10, invalidateOn: ['trade-executed'] },

  // Lists with pagination - Longer TTL
  userTransactionsList: { ttl: 120, invalidateOn: ['transaction-created'] },
  userOrdersList: { ttl: 60, invalidateOn: ['order-created', 'order-updated'] },
  userWatchlist: { ttl: 300, invalidateOn: ['watchlist-updated'] },

  // Admin data - Moderate TTL
  adminUserList: { ttl: 300, invalidateOn: ['user-created', 'user-updated', 'user-suspended'] },
  adminStats: { ttl: 600, invalidateOn: ['transaction-created', 'order-created'] },
}

let redis: Redis | null = null
const invalidationQueue = new Set<string>()

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  try {
    redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError: (error) => {
        console.error('[redis] Connection error:', error.message)
        return true
      },
    })

    redis.on('connect', () => {
      console.log('[redis] ✅ Connected to Redis')
    })

    redis.on('error', (error) => {
      // Suppress error logs for optional Redis - it's not critical
      // console.error('[redis] ❌ Redis error:', error.message)
    })

    // Test connection
    await redis.ping()
    console.log('[redis] ✅ Redis initialized')
  } catch (error) {
    console.warn('[redis] ⚠️ Redis initialization failed:', (error as Error).message)
    console.warn('[redis] ⚠️ Falling back to memory-only caching')
    redis = null
  }
}

/**
 * Get value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null

  try {
    const value = await redis.get(key)
    if (!value) return null

    return JSON.parse(value) as T
  } catch (error) {
    console.error(`[cache] Error getting key ${key}:`, error)
    return null
  }
}

/**
 * Set value in cache with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  if (!redis) return

  try {
    const prefix = key.split(':')[0] ?? ''
    const strategy = CACHE_STRATEGIES[prefix]
    const cacheTtl = ttl || strategy?.ttl || 300

    await redis.setex(key, cacheTtl, JSON.stringify(value))
  } catch (error) {
    console.error(`[cache] Error setting key ${key}:`, error)
  }
}

/**
 * Delete cache key
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return

  try {
    await redis.del(key)
  } catch (error) {
    console.error(`[cache] Error deleting key ${key}:`, error)
  }
}

/**
 * Clear cache by pattern
 */
export async function clearCachePattern(pattern: string): Promise<void> {
  if (!redis) return

  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    console.error(`[cache] Error clearing pattern ${pattern}:`, error)
  }
}

/**
 * Invalidate cache by event
 */
export async function invalidateCacheByEvent(event: string): Promise<void> {
  // Find all cache keys that should be invalidated
  for (const [cacheKey, strategy] of Object.entries(CACHE_STRATEGIES)) {
    if (strategy.invalidateOn?.includes(event)) {
      await clearCachePattern(`${cacheKey}:*`)
    }
  }
}

/**
 * Get or compute value (cache-aside pattern)
 */
export async function getCached<T>(
  key: string,
  compute: () => Promise<T>
): Promise<T> {
  // Try to get from cache
  const cached = await getCache<T>(key)
  if (cached !== null) {
    return cached
  }

  // Compute value
  const value = await compute()

  // Store in cache
  await setCache(key, value)

  return value
}

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<Record<string, any>> {
  if (!redis) {
    return { status: 'offline', message: 'Redis not connected' }
  }

  try {
    const info = await redis.info('stats')
    const keys = await redis.dbsize()

    return {
      status: 'online',
      totalKeys: keys,
      info: info,
    }
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message,
    }
  }
}

/**
 * Clear all cache
 */
export async function flushCache(): Promise<void> {
  if (!redis) return

  try {
    await redis.flushdb()
    console.log('[cache] ✅ Cache cleared')
  } catch (error) {
    console.error('[cache] Error flushing cache:', error)
  }
}

/**
 * Set expiring key for rate limiting
 */
export async function setRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<number> {
  if (!redis) {
    // Fallback to memory (not recommended for rate limiting)
    return 1
  }

  try {
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, window)
    }
    return current
  } catch (error) {
    console.error('[cache] Error setting rate limit:', error)
    return 1
  }
}

/**
 * Check if rate limit exceeded
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<boolean> {
  const current = await setRateLimit(key, limit, window)
  return current <= limit
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
    console.log('[redis] Connection closed')
  }
}

/**
 * Cache middleware for Express
 */
export function cacheMiddleware(keyGenerator: (req: any) => string, ttl?: number) {
  return async (req: any, res: any, next: any) => {
    const key = keyGenerator(req)
    const cached = await getCache(key)

    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    res.setHeader('X-Cache', 'MISS')

    // Override json to cache response
    const originalJson = res.json.bind(res)
    res.json = (data: any) => {
      setCache(key, data, ttl)
      return originalJson(data)
    }

    next()
  }
}

export default {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  clearCachePattern,
  invalidateCacheByEvent,
  getCached,
  getCacheStats,
  flushCache,
  setRateLimit,
  checkRateLimit,
  closeRedis,
  cacheMiddleware,
  CACHE_STRATEGIES,
}
