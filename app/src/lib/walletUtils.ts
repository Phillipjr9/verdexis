/**
 * Wallet address copy utilities
 * Provides multiple ways to copy addresses to reduce mistakes
 */

export interface WalletCopyFormat {
  plain: string
  withDetails: string
  csvFormat: string
  jsonFormat: string
}

export function generateWalletFormats(
  address: string,
  currency: string,
  network: string,
  chainId?: string
): WalletCopyFormat {
  const plain = address

  const withDetails = `
VERDEXIS WALLET ADDRESS
Currency: ${currency}
Network: ${network}
${chainId ? `Chain ID: ${chainId}` : ''}
Address: ${address}

⚠️ CRITICAL: Only send ${currency} on the ${network} network
Sending other assets may result in permanent loss of funds
`.trim()

  const csvFormat = `currency,network,address,chainId
${currency},${network},${address},${chainId || 'N/A'}`.trim()

  const jsonFormat = JSON.stringify(
    {
      currency,
      network,
      address,
      chainId: chainId || null,
      timestamp: new Date().toISOString(),
      warning: `Only send ${currency} on ${network}`
    },
    null,
    2
  )

  return {
    plain,
    withDetails,
    csvFormat,
    jsonFormat
  }
}

/**
 * Validate wallet address format based on currency
 */
export type DetectedWalletType = 'ethereum' | 'solana' | 'bitcoin' | 'unknown'

export function detectWalletAddressType(address: string): DetectedWalletType {
  const trimmed = address?.trim() ?? ''
  if (!trimmed) return 'unknown'

  const normalized = trimmed.replace(/^(bitcoin|ethereum|solana):/i, '')

  if (/^0x[a-fA-F0-9]{40}$/.test(normalized)) return 'ethereum'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(normalized)) return 'bitcoin'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalized)) return 'solana'

  return 'unknown'
}

export function getWalletChainHint(type: DetectedWalletType): string | null {
  switch (type) {
    case 'ethereum':
      return 'ethereum'
    case 'solana':
      return 'solana'
    case 'bitcoin':
      return 'bitcoin'
    default:
      return null
  }
}

export function validateWalletAddress(address: string, currency: string): {
  valid: boolean
  error?: string
} {
  const trimmed = address.trim()

  // Bitcoin addresses
  if (currency.toUpperCase() === 'BTC') {
    if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) {
      return { valid: false, error: 'Invalid Bitcoin address format' }
    }
    return { valid: true }
  }

  // Ethereum and EVM addresses
  if (['ETH', 'USDT', 'USDC', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE', 'BSC'].includes(currency.toUpperCase())) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return { valid: false, error: 'Invalid Ethereum address format (must be 0x...)' }
    }
    return { valid: true }
  }

  // Solana addresses
  if (currency.toUpperCase() === 'SOL') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(trimmed)) {
      return { valid: false, error: 'Invalid Solana address format' }
    }
    return { valid: true }
  }

  // XRP addresses
  if (currency.toUpperCase() === 'XRP') {
    if (!/^r[a-zA-Z0-9]{24,34}$/.test(trimmed)) {
      return { valid: false, error: 'Invalid XRP address format' }
    }
    return { valid: true }
  }

  // Dogecoin addresses
  if (currency.toUpperCase() === 'DOGE') {
    if (!/^D[a-zA-Z0-9]{33}$/.test(trimmed)) {
      return { valid: false, error: 'Invalid Dogecoin address format' }
    }
    return { valid: true }
  }

  // Default: just check it's not empty
  if (!trimmed) {
    return { valid: false, error: 'Address cannot be empty' }
  }

  return { valid: true }
}

/**
 * Sanitize address to prevent user error
 */
export function sanitizeWalletAddress(address: string): string {
  return address
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/^(bitcoin:|ethereum:|solana:|dogecoin:)/i, '')
}

/**
 * Get address preview for UI display
 */
export function getAddressPreview(address: string, maxChars: number = 20): string {
  if (address.length <= maxChars) return address
  const start = Math.ceil(maxChars / 2)
  const end = address.length - Math.floor(maxChars / 2)
  return `${address.slice(0, start)}...${address.slice(end)}`
}

/**
 * Check if two addresses are the same (accounting for case differences)
 */
export function addressesMatch(addr1: string, addr2: string, currency: string): boolean {
  const crypto = currency.toUpperCase()
  
  // Case-insensitive for most assets
  if (['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'XRP', 'DOGE'].includes(crypto)) {
    return addr1.toLowerCase() === addr2.toLowerCase()
  }
  
  // Case-sensitive for others
  return addr1 === addr2
}

/**
 * Generate a scannable QR code payload for the wallet address
 */
export function generateQrPayload(address: string, currency: string, network: string, amount?: number): string {
  const crypto = currency.toUpperCase()
  
  // BIP21 format for Bitcoin
  if (crypto === 'BTC') {
    if (amount && amount > 0) {
      return `bitcoin:${address}?amount=${amount}`
    }
    return `bitcoin:${address}`
  }

  // EIP681 format for Ethereum
  if (['ETH', 'USDT', 'USDC'].includes(crypto)) {
    if (amount && amount > 0) {
      return `ethereum:${address}?value=${amount}`
    }
    return `ethereum:${address}`
  }

  // Solana format
  if (crypto === 'SOL') {
    if (amount && amount > 0) {
      return `solana:${address}?amount=${amount}`
    }
    return `solana:${address}`
  }

  // Generic fallback
  return address
}

/**
 * Create a formatted wallet backup string
 */
export function createWalletBackupString(
  address: string,
  currency: string,
  network: string,
  customLabel?: string
): string {
  const label = customLabel || `${currency} Wallet`
  const timestamp = new Date().toISOString()
  
  return `
========================================
WALLET BACKUP - ${label}
========================================
Generated: ${timestamp}
Currency: ${currency}
Network: ${network}
Address: ${address}

WARNING: Keep this information secure.
Only send ${currency} on the ${network} network.

Do not share this address with anyone
unless they need to send you funds.
========================================
`.trim()
}
