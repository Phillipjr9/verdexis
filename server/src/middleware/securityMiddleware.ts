// server/src/middleware/securityMiddleware.ts
// Enhanced Security Middleware for Verdexis Platform

import { Request, Response, NextFunction } from 'express'
import { type AuthedRequest } from '../auth.js'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import xss from 'xss-clean'
import hpp from 'hpp'

/**
 * HELMET SECURITY HEADERS
 * Protects against common vulnerabilities
 */
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
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
})

/**
 * RATE LIMITING
 * Prevents brute force and DoS attacks
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
  skip: (req) => req.path === '/api/health',
})

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
})

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

export const sensitiveOpsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * DATA SANITIZATION
 * Prevents NoSQL injection and XSS
 */
export const sanitizationMiddleware = [
  mongoSanitize(), // Prevents NoSQL injection
  xss(), // Prevents XSS attacks
  hpp(), // Prevents HTTP Parameter Pollution
]

/**
 * CUSTOM SECURITY MIDDLEWARE
 */

/**
 * Prevent MIME type sniffing
 */
export const preventMimeSniffing = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
}

/**
 * Prevent clickjacking
 */
export const preventClickjacking = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
}

/**
 * Enforce HTTPS
 */
export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`)
  }
  next()
}

/**
 * Validate request size
 */
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const contentLength = parseInt(req.header('content-length') || '0', 10)
  
  if (contentLength > maxSize) {
    return res.status(413).json({ error: 'Payload too large' })
  }
  next()
}

/**
 * Validate content type — skip multipart/form-data (file uploads)
 */
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

/**
 * Detect suspicious patterns — path traversal and script injection only.
 * Avoid blocking legitimate chars like & % { } which appear in normal API payloads.
 */
export const detectSuspiciousPatterns = (req: Request, res: Response, next: NextFunction) => {
  const dangerousPatterns = [
    /(\.\.\/|\.\.\\/)/g,                          // Path traversal
    /<script[\s>]/gi,                              // Script injection
    /(javascript|vbscript):/gi,                    // Protocol injection
  ]

  const isSuspicious = (str: string) => dangerousPatterns.some(p => { p.lastIndex = 0; return p.test(str) })

  if (isSuspicious(req.url)) {
    console.warn(`[SECURITY] Suspicious URL pattern: ${req.ip} ${req.url}`)
    return res.status(400).json({ error: 'Invalid request' })
  }

  next()
}

/**
 * Track suspicious activity — uses module-level maps so state persists
 * across requests instead of being reset on every call.
 */
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
          console.warn(`[SECURITY] Repeated failed logins from IP: ${ip} (${attempts} attempts)`)
        }
      } else if (res.statusCode === 200) {
        _failedAttempts.delete(ip)
      }
    })
  }

  next()
}

/**
 * Validate API key
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('x-api-key')
  
  if (!apiKey) {
    return next()
  }

  // Validate API key format
  if (!/^[a-zA-Z0-9]{32,}$/.test(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key format' })
  }

  next()
}

/**
 * Sanitize response headers
 */
export const sanitizeResponseHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Remove sensitive headers
  res.removeHeader('Server')
  res.removeHeader('X-Powered-By')
  res.removeHeader('X-AspNet-Version')
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  
  next()
}

/**
 * Log security events
 */
export const logSecurityEvents = (req: Request, res: Response, next: NextFunction) => {
  const securityEvents: { path: string | RegExp; method: string; event: string }[] = [
    { path: '/api/auth/login', method: 'POST', event: 'LOGIN_ATTEMPT' },
    { path: '/api/auth/logout', method: 'POST', event: 'LOGOUT' },
    { path: /^\/api\/admin\//, method: 'POST', event: 'ADMIN_ACTION' },
    { path: /^\/api\/wallet\//, method: 'POST', event: 'WALLET_ACTION' },
  ]

  securityEvents.forEach(({ path, method, event }) => {
    const pathMatch = typeof path === 'string' ? req.path === path : path.test(req.path)
    if (pathMatch && req.method === method) {
      console.log(`[SECURITY] ${event} - IP: ${req.ip}, User: ${(req as AuthedRequest).userId || 'anonymous'}`)
    }
  })

  next()
}

/**
 * Combine all security middleware
 */
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
  ...sanitizationMiddleware,
]

export default securityMiddleware
