let Sentry: any
try {
  Sentry = await import('@sentry/node')
} catch (e) {
  // Sentry not installed - create no-op implementations
  Sentry = {
    init: () => {},
    Handlers: { requestHandler: () => (req: any, res: any, next: any) => next(), errorHandler: () => (error: any, req: any, res: any, next: any) => next(error) },
    Integrations: { Http: () => ({}) },
    startTransaction: () => ({ setData: () => {}, end: () => {} }),
    startSpan: () => ({ end: () => {} }),
    captureException: () => '',
    captureMessage: () => '',
    setUser: () => {},
    addBreadcrumb: () => {},
    getClient: () => ({}),
  }
}

import { Express, Request, Response, NextFunction } from 'express'

/**
 * Sentry Error Tracking & Monitoring Setup
 * Captures errors, performance metrics, and issues in production
 */

export function getSentryInitOptions(dsn = process.env.SENTRY_DSN || ''): Record<string, any> {
  return {
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Disable global/default integrations so Sentry does not auto-instrument
    // Prisma via a proxied client, which can trigger `_engineConfig` access on
    // partially initialized or wrapped client instances.
    defaultIntegrations: false,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  }
}

export function initSentryServer(app: Express): void {
  const dsn = process.env.SENTRY_DSN || ''

  if (dsn) {
    Sentry.init(getSentryInitOptions(dsn))

    // Sentry request handler must be first
    app.use(Sentry.Handlers.requestHandler())
    app.use(sentryPerformanceMiddleware)
    app.use(Sentry.Handlers.errorHandler())

    console.log('[sentry] ✅ Sentry initialized for error tracking')
  } else {
    console.warn('[sentry] ⚠️ SENTRY_DSN not configured - error tracking disabled')
  }
}

/**
 * Custom performance tracking middleware
 */
export function sentryPerformanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now()
  const transaction = Sentry.startTransaction({
    op: 'http.request',
    name: `${req.method} ${req.path}`,
  })

  res.on('finish', () => {
    const duration = Date.now() - startTime
    transaction.setData('response_time_ms', duration)
    transaction.setData('status_code', res.statusCode)
    transaction.setData('user_id', (req as any).userId || 'anonymous')

    if (duration > 1000) {
      Sentry.captureMessage(
        `Slow request: ${req.method} ${req.path} took ${duration}ms`,
        'warning'
      )
    }

    transaction.finish()
  })

  next()
}

/**
 * Capture custom errors with context
 */
export function captureError(
  error: Error,
  context: Record<string, any> = {}
): string {
  return Sentry.captureException(error, {
    tags: context.tags,
    contexts: { custom: context },
  })
}

/**
 * Capture messages for monitoring
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: Record<string, any> = {}
): string {
  return Sentry.captureMessage(message, {
    level,
    contexts: { custom: context },
  })
}

/**
 * Set user context
 */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email: email,
  })
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  Sentry.setUser(null)
}

/**
 * Add breadcrumbs for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: 'info' | 'warning' | 'error' = 'info',
  data: Record<string, any> = {}
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Middleware to capture API errors
 */
export function apiErrorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  Sentry.captureException(error, {
    tags: {
      http_method: req.method,
      http_path: req.path,
      http_status: res.statusCode,
    },
    contexts: {
      request: {
        method: req.method,
        url: req.url,
        query: req.query,
        headers: sanitizeHeaders(req.headers),
        ip: req.ip,
        user_agent: req.get('user-agent'),
      },
    },
  })

  next(error)
}

/**
 * Remove sensitive data from headers
 */
function sanitizeHeaders(headers: any): Record<string, string> {
  const sanitized = { ...headers }
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]'
    }
  })

  return sanitized
}

/**
 * Monitor specific operations
 */
export async function monitorOperation<T>(
  operationName: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const span = Sentry.startSpan({
    op: 'operation',
    name: operationName,
  })

  try {
    const result = fn()
    if (result instanceof Promise) {
      return await result
    }
    return result
  } finally {
    span?.end()
  }
}

/**
 * Track database queries
 */
export function trackDatabaseQuery(
  query: string,
  duration: number,
  error?: Error
): void {
  if (error) {
    Sentry.captureException(error, {
      tags: { db_query: 'failed' },
      contexts: { database: { query: query.substring(0, 200), duration_ms: duration } },
    })
  } else if (duration > 1000) {
    captureMessage(`Slow database query (${duration}ms): ${query.substring(0, 100)}`, 'warning')
  }
}

/**
 * Track authentication events
 */
export function trackAuthEvent(
  event: 'login' | 'logout' | 'signup' | 'password_reset' | '2fa_enabled',
  userId: string,
  success: boolean,
  details?: Record<string, any>
): void {
  addBreadcrumb(
    `Auth: ${event}`,
    'auth',
    success ? 'info' : 'warning',
    { userId, success, ...details }
  )
}

/**
 * Track financial transactions
 */
export function trackTransaction(
  type: 'deposit' | 'withdraw' | 'trade' | 'transfer',
  userId: string,
  amount: number,
  currency: string,
  status: 'success' | 'failed' | 'pending',
  details?: Record<string, any>
): void {
  addBreadcrumb(
    `Transaction: ${type}`,
    'transaction',
    status === 'failed' ? 'error' : 'info',
    { userId, amount, currency, status, ...details }
  )
}

/**
 * Health check
 */
export function sentryHealthCheck(): { status: 'ok' | 'error'; message: string } {
  const client = Sentry.getClient()
  if (!client) {
    return { status: 'error', message: 'Sentry client not initialized' }
  }
  return { status: 'ok', message: 'Sentry is monitoring errors' }
}

export default {
  initSentryServer,
  captureError,
  captureMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  apiErrorMiddleware,
  monitorOperation,
  trackDatabaseQuery,
  trackAuthEvent,
  trackTransaction,
  sentryHealthCheck,
}
