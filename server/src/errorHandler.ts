import { Response } from 'express'

/**
 * Standardized error response format used across all API endpoints.
 * Ensures consistency in error messages, status codes, and response structure.
 */
export interface ErrorResponse {
  error: string
  details?: unknown
  timestamp: string
  path?: string
}

/**
 * Creates a standardized error response with consistent formatting
 */
export function createErrorResponse(
  error: string,
  details?: unknown,
  path?: string,
): ErrorResponse {
  const response: ErrorResponse = {
    error,
    timestamp: new Date().toISOString(),
  }

  if (details !== undefined) {
    response.details = details
  }

  if (path) {
    response.path = path
  }

  return response
}

/**
 * Sends a standardized error response
 */
export function sendError(
  res: Response,
  statusCode: number,
  error: string,
  details?: unknown,
  path?: string,
): void {
  res.status(statusCode).json(createErrorResponse(error, details, path))
}

/**
 * Validation limits to ensure consistency across all endpoints
 */
export const VALIDATION_LIMITS = {
  SYMBOL_LENGTH: 20,
  SYMBOL_MIN: 1,
  ASSET_NAME_LENGTH: 120,
  NOTE_LENGTH: 200,
  CURRENCY_LENGTH: 20,
  MIN_AMOUNT: 0.00000001,
  MAX_AMOUNT: 999999999,
  EMAIL_MAX_LENGTH: 200,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 200,
  PHONE_MIN: 7,
  PHONE_MAX: 32,
  NAME_MIN: 1,
  NAME_MAX: 80,
  REFERENCE_MAX: 200,
  QUERY_MAX: 2000,
  CONTEXT_MAX: 4000,
  PERSONA_MAX: 40,
} as const

/**
 * Validates symbol format for trades and holdings
 */
export function isValidSymbol(symbol: string): boolean {
  if (!symbol || symbol.length < VALIDATION_LIMITS.SYMBOL_MIN || symbol.length > VALIDATION_LIMITS.SYMBOL_LENGTH) {
    return false
  }
  return /^[A-Z0-9\-\.]{1,20}$/i.test(symbol)
}

/**
 * Validates numeric amount with bounds
 */
export function isValidAmount(amount: unknown): amount is number {
  if (typeof amount !== 'number') return false
  return amount >= VALIDATION_LIMITS.MIN_AMOUNT && amount <= VALIDATION_LIMITS.MAX_AMOUNT && isFinite(amount)
}

/**
 * Validates positive currency string
 */
export function isValidCurrency(currency: string): boolean {
  if (typeof currency !== 'string') return false
  if (currency.length < 1 || currency.length > VALIDATION_LIMITS.CURRENCY_LENGTH) return false
  return /^[A-Z0-9]{1,20}$/i.test(currency)
}
