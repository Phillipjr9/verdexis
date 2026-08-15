import { Express, Request, Response, NextFunction } from 'express'
import helmet from 'helmet'

/**
 * Enhanced Security Headers Configuration
 * Implements OWASP security best practices
 */

export function setupSecurityHeaders(app: Express) {
  // ============= HELMET CONFIGURATION =============
  // Helmet helps secure Express apps by setting various HTTP headers

  // Content Security Policy - Prevent XSS, clickjacking, data injection
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        childSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
      },
      reportOnly: false,
    })
  )

  // Prevent MIME sniffing
  app.use(helmet.noSniff())

  // Disable X-Frame-Options (clickjacking protection)
  app.use(helmet.frameguard({ action: 'deny' }))

  // Referrer Policy - Control referrer information
  app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }))

  // Permissions Policy - Control browser features
  app.use(
    helmet.permittedCrossDomainPolicies({
      permittedPolicies: 'none',
    })
  )

  // ============= CUSTOM SECURITY HEADERS =============

  // Strict-Transport-Security (HSTS) - Force HTTPS
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
    }
    next()
  })

  // ============= ADDITIONAL HEADERS =============
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent caching of sensitive data
    if (req.url.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }

    // DNS prefetch control
    res.setHeader('X-DNS-Prefetch-Control', 'off')

    // Prevent browsers from opening downloads
    res.setHeader('X-Download-Options', 'noopen')

    // Permissions-Policy - Control which browser features can be used
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()'
    )

    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By')

    next()
  })

  console.log('[security] ✅ Enhanced security headers configured')
}

/**
 * Validate HTTPS in production
 */
import { header as getHeader } from '../utils/headers.js'

export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production') {
    if (getHeader(req, 'x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${getHeader(req, 'host')}${req.url}`)
    }
  }
  next()
}

/**
 * Validate same-site requests
 */
export function validateSamesite(req: Request, res: Response, next: NextFunction) {
  const origin = getHeader(req, 'origin')
  const host = getHeader(req, 'host')

  if (origin && !origin.includes(host || '')) {
    // Log potential CSRF attempt
    console.warn(`[security] Potential CSRF: origin=${origin}, host=${host}`)
    // Optionally reject or allow based on policy
  }

  next()
}

/**
 * Add security headers to all responses
 */
export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Server identification header (minimal info)
  res.setHeader('Server', 'VERDEXIS/1.0')

  // Content Security Policy report endpoint
  res.setHeader('Content-Security-Policy-Report-Only', 'report-uri /api/security/csp-report')

  next()
}

/**
 * CSP violation reporting endpoint
 * Should be added to app.ts:
 * app.post('/api/security/csp-report', cspReportHandler)
 */
export async function handleCspReport(req: Request, res: Response) {
  const violation = req.body || {}

  console.warn('[security] CSP Violation:', {
    blockedUri: violation['blocked-uri'],
    violatedDirective: violation['violated-directive'],
    originalPolicy: violation['original-policy'],
    documentUri: violation['document-uri'],
    sourceFile: violation['source-file'],
    lineNumber: violation['line-number'],
    columnNumber: violation['column-number'],
  })

  // Send to monitoring service (Sentry, DataDog, etc.)
  // await captureCSPViolation(violation)

  res.status(204).send()
}

/**
 * Security headers configuration object for reference
 */
export const SECURITY_CONFIG = {
  // OWASP HSTS Configuration
  hsts: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },

  // CSP directives explanation
  csp: {
    'default-src': "Only same origin by default",
    'script-src': "Only same origin scripts + wasm",
    'style-src': "Only same origin + inline (required for dynamic themes)",
    'img-src': "Same origin + data URLs + https",
    'connect-src': "API calls + WebSocket",
    'frame-src': "Disallow framing entirely",
    'object-src': "Disallow plugins",
    'form-action': "Only submit to same origin",
    'frame-ancestors': "Disallow being framed",
  },

  // Which headers to enforce
  headers: {
    'Strict-Transport-Security': 'Force HTTPS in production',
    'Content-Security-Policy': 'Prevent XSS and data injection',
    'X-Content-Type-Options': 'Prevent MIME sniffing',
    'X-Frame-Options': 'Prevent clickjacking',
    'X-XSS-Protection': 'Legacy XSS protection',
    'Referrer-Policy': 'Control referrer disclosure',
    'Permissions-Policy': 'Control browser features',
    'Cache-Control': 'Prevent caching sensitive data',
  },
}

export default {
  setupSecurityHeaders,
  enforceHttps,
  validateSamesite,
  securityHeadersMiddleware,
  handleCspReport,
  SECURITY_CONFIG,
}
