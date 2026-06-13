import { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'

export interface RequestContext {
  requestId: string
  userId?: string
  method: string
  path: string
  startTime: number
  userRole?: string
}

/**
 * Request context key for Express middleware
 */
const REQUEST_CONTEXT_KEY = '__requestContext'

declare global {
  namespace Express {
    interface Request {
      [REQUEST_CONTEXT_KEY]?: RequestContext
    }
  }
}

/**
 * Logger interface for structured logging
 */
export interface Logger {
  info(msg: string, context?: Record<string, unknown>): void
  warn(msg: string, context?: Record<string, unknown>): void
  error(msg: string, context?: Record<string, unknown>): void
  debug(msg: string, context?: Record<string, unknown>): void
}

/**
 * Simple structured logger using console
 */
class ConsoleLogger implements Logger {
  private formatLog(level: string, msg: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const ctx = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level}] ${msg}${ctx}`
  }

  info(msg: string, context?: Record<string, unknown>): void {
    console.log(this.formatLog('INFO', msg, context))
  }

  warn(msg: string, context?: Record<string, unknown>): void {
    console.warn(this.formatLog('WARN', msg, context))
  }

  error(msg: string, context?: Record<string, unknown>): void {
    console.error(this.formatLog('ERROR', msg, context))
  }

  debug(msg: string, context?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.debug(this.formatLog('DEBUG', msg, context))
    }
  }
}

export const logger = new ConsoleLogger()

/**
 * Extract request context for logging
 */
export function getRequestContext(req: Request): RequestContext | undefined {
  return (req as Request & Record<string, unknown>)[REQUEST_CONTEXT_KEY] as RequestContext | undefined
}

/**
 * Set request context
 */
export function setRequestContext(req: Request, context: RequestContext): void {
  (req as Request & Record<string, unknown>)[REQUEST_CONTEXT_KEY] = context
}

/**
 * Middleware to inject request ID and timing context
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID()
  const startTime = Date.now()

  const context: RequestContext = {
    requestId,
    method: req.method,
    path: req.path,
    startTime,
  }

  setRequestContext(req, context)

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const ctx = getRequestContext(req)
    logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: ctx?.userId,
      userRole: ctx?.userRole,
    })
  })

  // Set response header for tracing
  res.setHeader('X-Request-ID', requestId)
  next()
}

/**
 * Log API call with full context
 */
export function logApiCall(
  req: Request,
  event: string,
  data?: Record<string, unknown>,
): void {
  const ctx = getRequestContext(req)
  logger.info(event, {
    requestId: ctx?.requestId,
    method: ctx?.method,
    path: ctx?.path,
    userId: ctx?.userId,
    userRole: ctx?.userRole,
    ...data,
  })
}

/**
 * Log error with full context
 */
export function logError(
  req: Request,
  errorMsg: string,
  data?: Record<string, unknown>,
): void {
  const ctx = getRequestContext(req)
  logger.error(errorMsg, {
    requestId: ctx?.requestId,
    method: ctx?.method,
    path: ctx?.path,
    userId: ctx?.userId,
    userRole: ctx?.userRole,
    ...data,
  })
}
