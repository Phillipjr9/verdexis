import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'

/**
 * VERDEXIS Input Validation Schemas
 * Centralized Zod schemas for all API endpoints
 */

// ============= AUTH SCHEMAS =============
export const authSchemas = {
  signup: z.object({
    email: z.string().email('Invalid email format').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain uppercase').regex(/[0-9]/, 'Password must contain number'),
    name: z.string().min(1, 'Name required').max(100),
  }),

  login: z.object({
    email: z.string().email('Invalid email').toLowerCase(),
    password: z.string().min(1, 'Password required'),
  }),

  passwordReset: z.object({
    token: z.string().min(1, 'Token required'),
    password: z.string().min(8, 'Password must be 8+ characters'),
  }),

  forgotPassword: z.object({
    email: z.string().email('Invalid email').toLowerCase(),
  }),

  twoFactorSetup: z.object({
    enable: z.boolean(),
  }),

  twoFactorVerify: z.object({
    token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
  }),
}

// ============= KYC SCHEMAS =============
export const kycSchemas = {
  submit: z.object({
    firstName: z.string().min(1, 'First name required').max(100),
    lastName: z.string().min(1, 'Last name required').max(100),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    country: z.string().length(2, 'Country code must be 2 letters'),
    ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$|^\d{9}$/, 'Invalid SSN format'),
    addressStreet: z.string().min(5, 'Street address too short').max(200),
    addressCity: z.string().min(1, 'City required').max(100),
    addressZip: z.string().min(3, 'ZIP too short').max(20),
    idDocType: z.enum(['passport', 'dl', 'id'], { errorMap: () => ({ message: 'Invalid ID type' }) }),
    _csrf: z.string().min(1, 'CSRF token required'),
  }),

  documentUpload: z.object({
    documentType: z.enum(['identity', 'address', 'selfie']),
  }),
}

// ============= PROFILE SCHEMAS =============
export const profileSchemas = {
  update: z.object({
    name: z.string().min(1).max(100).optional(),
    avatar: z.string().url('Invalid URL').optional(),
    preferences: z.record(z.any()).optional(),
  }),
}

// ============= WALLET SCHEMAS =============
export const walletSchemas = {
  transaction: z.object({
    kind: z.enum(['deposit', 'withdraw', 'transfer']),
    currency: z.string().toUpperCase().length(3, 'Invalid currency code'),
    amount: z.number().positive('Amount must be positive').finite(),
    recipientId: z.string().optional(),
    address: z.string().optional(),
  }).refine(
    (data) => {
      if (data.kind === 'transfer' && !data.recipientId) {
        return false
      }
      return true
    },
    { message: 'recipientId required for transfers', path: ['recipientId'] }
  ),

  deposit: z.object({
    currency: z.string().toUpperCase(),
    amount: z.number().positive().finite(),
    method: z.enum(['bank_transfer', 'crypto']),
    address: z.string().optional(),
  }),

  withdraw: z.object({
    currency: z.string().toUpperCase(),
    amount: z.number().positive().finite(),
    address: z.string().optional(),
    feeLevel: z.enum(['slow', 'normal', 'fast']).optional(),
  }),

  transfer: z.object({
    recipientId: z.string().cuid('Invalid recipient ID'),
    currency: z.string().toUpperCase(),
    amount: z.number().positive().finite(),
  }),
}

// ============= TRADING SCHEMAS =============
export const tradingSchemas = {
  placeOrder: z.object({
    symbol: z.string().min(1).max(20).toUpperCase(),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit', 'stop', 'stop_limit']),
    quantity: z.number().positive('Quantity must be positive').finite(),
    price: z.number().positive().finite().optional(),
    stopPrice: z.number().positive().finite().optional(),
    timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
  }).refine(
    (data) => {
      if ((data.type === 'limit' || data.type === 'stop_limit') && !data.price) {
        return false
      }
      if ((data.type === 'stop' || data.type === 'stop_limit') && !data.stopPrice) {
        return false
      }
      return true
    },
    { message: 'Price required for limit orders, stopPrice required for stop orders' }
  ),

  cancelOrder: z.object({
    orderId: z.string().cuid(),
  }),

  updateOrder: z.object({
    orderId: z.string().cuid(),
    price: z.number().positive().finite().optional(),
    quantity: z.number().positive().finite().optional(),
  }),
}

// ============= ALERT SCHEMAS =============
export const alertSchemas = {
  create: z.object({
    symbol: z.string().min(1).toUpperCase(),
    type: z.enum(['price', 'change', 'technical']),
    target: z.number().positive('Target must be positive').finite(),
    direction: z.enum(['above', 'below', 'crosses']),
    notifyEmail: z.boolean().default(true),
    notifyPush: z.boolean().default(true),
  }),

  update: z.object({
    alertId: z.string().cuid(),
    target: z.number().positive().finite().optional(),
    direction: z.enum(['above', 'below', 'crosses']).optional(),
  }),
}

// ============= WATCHLIST SCHEMAS =============
export const watchlistSchemas = {
  add: z.object({
    symbol: z.string().min(1).max(20).toUpperCase(),
  }),

  remove: z.object({
    symbol: z.string().min(1).max(20).toUpperCase(),
  }),
}

// ============= HOLDINGS SCHEMAS =============
export const holdingsSchemas = {
  upsert: z.object({
    symbol: z.string().min(1).max(20).toUpperCase(),
    amount: z.number().nonnegative('Amount cannot be negative'),
    avgPrice: z.number().positive().finite().optional(),
  }),
}

// ============= PASSKEYS SCHEMAS =============
export const passkeysSchemas = {
  registerOptions: z.object({
    deviceName: z.string().max(50).optional(),
  }),

  registerVerify: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
    }),
    type: z.literal('public-key'),
  }),

  authOptions: z.object({
    email: z.string().email(),
  }),

  authVerify: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
    }),
    type: z.literal('public-key'),
  }),
}

// ============= ADMIN SCHEMAS =============
export const adminSchemas = {
  approveKyc: z.object({
    userId: z.string().cuid(),
    kycStatus: z.enum(['approved', 'rejected']),
    notes: z.string().max(500).optional(),
  }),

  updateUserLimits: z.object({
    userId: z.string().cuid(),
    dailyWithdrawLimit: z.number().positive().optional(),
    monthlyWithdrawLimit: z.number().positive().optional(),
    dailyTransferLimit: z.number().positive().optional(),
    monthlyTransferLimit: z.number().positive().optional(),
  }),

  suspendUser: z.object({
    userId: z.string().cuid(),
    reason: z.string().min(1).max(500),
    duration: z.number().positive('Duration in hours').optional(),
  }),
}

// ============= FILE UPLOAD SCHEMAS =============
export const fileSchemas = {
  document: z.object({
    documentType: z.enum(['identity', 'address', 'selfie']),
    fileName: z.string().max(255),
    fileSize: z.number().max(8 * 1024 * 1024, 'File too large (max 8MB)'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  }),
}

// ============= PAGINATION SCHEMAS =============
export const paginationSchemas = {
  query: z.object({
    page: z.coerce.number().int().positive('Page must be positive').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'Limit max 100').default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
}

// ============= VALIDATION MIDDLEWARE =============

/**
 * Validate request body against schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body)
      req.body = parsed
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
        res.status(400).json({
          error: 'Validation failed',
          details: issues,
        })
        return
      }
      res.status(400).json({ error: 'Invalid request' })
    }
  }
}

/**
 * Validate request params against schema
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params)
      req.params = parsed as any
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map(i => i.message).join(', ')
        res.status(400).json({ error: 'Invalid parameters', details: message })
        return
      }
      res.status(400).json({ error: 'Invalid request' })
    }
  }
}

/**
 * Validate request query against schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query)
      req.query = parsed as any
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map(i => i.message).join(', ')
        res.status(400).json({ error: 'Invalid query parameters', details: message })
        return
      }
      res.status(400).json({ error: 'Invalid request' })
    }
  }
}

export default {
  authSchemas,
  kycSchemas,
  profileSchemas,
  walletSchemas,
  tradingSchemas,
  alertSchemas,
  watchlistSchemas,
  holdingsSchemas,
  passkeysSchemas,
  adminSchemas,
  fileSchemas,
  paginationSchemas,
  validateBody,
  validateParams,
  validateQuery,
}
