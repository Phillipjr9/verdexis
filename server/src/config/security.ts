// server/src/config/security.ts
// Comprehensive Security Configuration

import crypto from 'crypto'

/**
 * ENCRYPTION CONFIGURATION
 */
export const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
  saltLength: 32,
  tagLength: 16,
  
  // Generate encryption key from password
  deriveKey: (password: string, salt: Buffer): Buffer => {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  },
  
  // Encrypt sensitive data
  encrypt: (data: string, masterKey: string): string => {
    const salt = crypto.randomBytes(32)
    const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  },
  
  // Decrypt sensitive data
  decrypt: (encryptedData: string, masterKey: string): string => {
    const [saltHex, ivHex, authTagHex, encrypted] = encryptedData.split(':')
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  },
}

/**
 * PASSWORD POLICY
 */
export const passwordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  expiryDays: 90,
  historyCount: 5,
  
  validate: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (password.length < passwordPolicy.minLength) {
      errors.push(`Password must be at least ${passwordPolicy.minLength} characters`)
    }
    if (password.length > passwordPolicy.maxLength) {
      errors.push(`Password must not exceed ${passwordPolicy.maxLength} characters`)
    }
    if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    if (passwordPolicy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    if (passwordPolicy.requireSpecialChars && !new RegExp(`[${passwordPolicy.specialChars}]`).test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  },
}

/**
 * SESSION CONFIGURATION
 */
export const sessionConfig = {
  maxSessions: 5,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  absoluteTimeout: 24 * 60 * 60 * 1000, // 24 hours
  requireReauthForSensitiveOps: true,
  trackDeviceFingerprint: true,
  trackIPAddress: true,
  
  sensitiveOperations: [
    '/api/wallet/withdraw',
    '/api/wallet/transfer',
    '/api/admin/*',
    '/api/kyc/submit',
    '/api/security/change-password',
  ],
}

/**
 * RATE LIMITING CONFIGURATION
 */
export const rateLimitConfig = {
  global: {
    windowMs: 60 * 1000,
    limit: 1000,
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    limit: 5,
  },
  api: {
    windowMs: 60 * 1000,
    limit: 100,
  },
  admin: {
    windowMs: 60 * 1000,
    limit: 50,
  },
  sensitive: {
    windowMs: 60 * 1000,
    limit: 10,
  },
}

/**
 * INPUT VALIDATION RULES
 */
export const validationRules = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  url: /^https?:\/\/.+/,
  ipAddress: /^(\d{1,3}\.){3}\d{1,3}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s\-_.]+$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  creditCard: /^\d{13,19}$/,
  
  sanitize: (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/[&]/g, '&amp;') // Escape ampersand
      .replace(/['"]/g, '') // Remove quotes
      .trim()
  },
}

/**
 * CORS CONFIGURATION
 */
export const corsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
}

/**
 * SECURITY HEADERS
 */
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
}

/**
 * ENCRYPTION FIELDS
 * Fields that should be encrypted at rest
 */
export const encryptedFields = {
  ssn: true,
  bankAccount: true,
  walletPrivateKey: true,
  apiKeys: true,
  personalData: true,
  phoneNumber: true,
  address: true,
}

/**
 * AUDIT LOGGING EVENTS
 */
export const auditEvents = {
  LOGIN_SUCCESS: 'User logged in successfully',
  LOGIN_FAILURE: 'Failed login attempt',
  LOGOUT: 'User logged out',
  PASSWORD_CHANGE: 'Password changed',
  PASSWORD_RESET: 'Password reset',
  EMAIL_VERIFIED: 'Email verified',
  PHONE_VERIFIED: 'Phone verified',
  TWO_FACTOR_ENABLED: '2FA enabled',
  TWO_FACTOR_DISABLED: '2FA disabled',
  PERMISSION_DENIED: 'Unauthorized access attempt',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity detected',
  DATA_ACCESS: 'Sensitive data accessed',
  CONFIGURATION_CHANGE: 'System configuration changed',
  SECURITY_ALERT: 'Security alert triggered',
  ADMIN_ACTION: 'Admin action performed',
  WALLET_ACTION: 'Wallet action performed',
  TRANSACTION: 'Transaction executed',
  KYC_SUBMISSION: 'KYC submitted',
  KYC_APPROVED: 'KYC approved',
  KYC_REJECTED: 'KYC rejected',
}

/**
 * ANOMALY DETECTION THRESHOLDS
 */
export const anomalyDetection = {
  failedLoginThreshold: 5,
  failedLoginWindow: 15 * 60 * 1000, // 15 minutes
  unusualLocationLogin: true,
  unusualTimeLogin: true,
  rapidAPICallsThreshold: 100, // per minute
  largeDataTransferThreshold: 100 * 1024 * 1024, // 100MB
  suspiciousPatterns: true,
  lockoutDuration: 30 * 60 * 1000, // 30 minutes
}

/**
 * SECURITY SCANNING SCHEDULE
 */
export const securityScanning = {
  dependencyScanning: 'weekly',
  staticCodeAnalysis: 'daily',
  dynamicAnalysis: 'weekly',
  penetrationTesting: 'quarterly',
  securityAudit: 'annually',
}

/**
 * COMPLIANCE REQUIREMENTS
 */
export const compliance = {
  OWASP: {
    topTen: true,
    apiSecurity: true,
    mobileTopTen: true,
  },
  PCI_DSS: {
    cardDataEncryption: true,
    accessControl: true,
    monitoring: true,
  },
  GDPR: {
    dataProtection: true,
    userConsent: true,
    rightToBeForget: true,
    dataPortability: true,
  },
  SOC2: {
    security: true,
    availability: true,
    processingIntegrity: true,
    confidentiality: true,
    privacy: true,
  },
}

/**
 * INCIDENT RESPONSE CONFIGURATION
 */
export const incidentResponse = {
  detection: {
    monitoring: 'real-time',
    alerting: 'immediate',
    escalation: 'automatic',
  },
  response: {
    containment: 60 * 60 * 1000, // 1 hour
    investigation: 24 * 60 * 60 * 1000, // 24 hours
    remediation: 48 * 60 * 60 * 1000, // 48 hours
    notification: 72 * 60 * 60 * 1000, // 72 hours
  },
  recovery: {
    backupRestoration: true,
    disasterRecovery: true,
    businessContinuity: true,
  },
}

export default {
  encryptionConfig,
  passwordPolicy,
  sessionConfig,
  rateLimitConfig,
  validationRules,
  corsConfig,
  securityHeaders,
  encryptedFields,
  auditEvents,
  anomalyDetection,
  securityScanning,
  compliance,
  incidentResponse,
}
