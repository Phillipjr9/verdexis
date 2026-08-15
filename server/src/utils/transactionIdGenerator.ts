/**
 * Transaction ID Generator
 * Generates user-friendly transaction IDs like TXN-20260815-001234567890
 * Format: TXN-YYYYMMDD-RANDOMHASH
 * This allows users to easily search and trace their transactions
 */

export function generateTransactionId(): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD
  
  // Generate a random hex string (12 chars) - derived from timestamp + random
  const random = Math.random().toString(36).substring(2, 8) + 
                 Math.random().toString(36).substring(2, 8)
  
  return `TXN-${date}-${random.toUpperCase()}`
}

/**
 * Validate a transaction ID format
 */
export function isValidTransactionId(id: string): boolean {
  return /^TXN-\d{8}-[A-Z0-9]{12}$/.test(id)
}

/**
 * Extract date from transaction ID
 */
export function getDateFromTransactionId(id: string): Date | null {
  const match = id.match(/^TXN-(\d{4})(\d{2})(\d{2})/)
  if (!match) return null
  
  try {
    return new Date(`${match[1]}-${match[2]}-${match[3]}`)
  } catch {
    return null
  }
}
