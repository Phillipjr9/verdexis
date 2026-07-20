import { Request, Response, NextFunction } from 'express'
import { type AuthedRequest } from '../auth.js'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
})

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
  skip: (req) => req.path === '/api/health',
})

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
})

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

export const sensitiveOpsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

export const sanitizationMiddleware: never[] = []

export const preventMimeSniffing = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
}

export const preventClickjacking = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
}

export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, 'https://' + req.header('host') + req.url)
  }
  next()
}

export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  const maxSize = 10 * 1024 * 1024
  const contentLength = parseInt(req.header('content-length') || '0', 10)
  if (contentLength > maxSize) {
    return res.status(413).json({ error: 'Payload too large' })
  }
  next()
}

export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.header('content-type') || ''
    const isJson = contentType.includes('application/json')
    const isMultipart = contentType.includes('multipart/form-data')
    const isFormEncoded = contentType.includes('application/x-www-form-urlencoded')
    if (!isJson && !isMultipart && !isFormEncoded) {
      return res.status(415).json({ error: 'Unsupported Media Type' })
    }
  }
  next()
}

export const detectSuspiciousPatterns = (req: Request, res: Response, next: NextFunction) => {
  const pathTraversal = new RegExp('(\\.\\./|\\.\\.\\\\/)')
  const scriptTag = new RegExp('<script[\\s>]', 'i')
  const protoInject = new RegExp('(javascript|vbscript):', 'i')

  const url = req.url
  if (pathTraversal.test(url) || scriptTag.test(url) || protoInject.test(url)) {
    console.warn('[SECURITY] Suspicious URL pattern: ' + req.ip + ' ' + url)
    return res.status(400).json({ error: 'Invalid request' })
  }
  next()
}

const _failedAttempts = new Map<string, number>()
const _suspiciousIPs = new Set<string>()

export const trackSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown'
  if (req.path === '/api/auth/login' && req.method === 'POST') {
    res.on('finish', () => {
      if (res.statusCode === 401) {
        const attempts = (_failedAttempts.get(ip) || 0) + 1
        _failedAttempts.set(ip, attempts)
        if (attempts >= 5) {
          _suspiciousIPs.add(ip)
          console.warn('[SECURITY] Repeated failed logins from IP: ' + ip + ' (' + attempts + ' attempts)')
        }
      } else if (res.statusCode === 200) {
        _failedAttempts.delete(ip)
      }
    })
  }
  next()
}

export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('x-api-key')
  if (!apiKey) return next()
  if (!/^[a-zA-Z0-9]{32,}$/.test(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key format' })
  }
  next()
}

export const sanitizeResponseHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader('Server')
  res.removeHeader('X-Powered-By')
  res.removeHeader('X-AspNet-Version')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  next()
}

export const logSecurityEvents = (req: Request, res: Response, next: NextFunction) => {
  const adminRe = new RegExp('^/api/admin/')
  const walletRe = new RegExp('^/api/wallet/')
  const events = [
    { path: '/api/auth/login', method: 'POST', event: 'LOGIN_ATTEMPT' },
    { path: '/api/auth/logout', method: 'POST', event: 'LOGOUT' },
    { path: adminRe, method: 'POST', event: 'ADMIN_ACTION' },
    { path: walletRe, method: 'POST', event: 'WALLET_ACTION' },
  ]
  events.forEach(({ path, method, event }) => {
    const match = typeof path === 'string' ? req.path === path : (path as RegExp).test(req.path)
    if (match && req.method === method) {
      console.log('[SECURITY] ' + event + ' - IP: ' + req.ip + ', User: ' + ((req as AuthedRequest).userId || 'anonymous'))
    }
  })
  next()
}

export const securityMiddleware = [
  helmetConfig,
  globalRateLimiter,
  enforceHttps,
  validateRequestSize,
  validateContentType,
  detectSuspiciousPatterns,
  trackSuspiciousActivity,
  validateApiKey,
  sanitizeResponseHeaders,
  logSecurityEvents,
]

export default securityMiddleware
