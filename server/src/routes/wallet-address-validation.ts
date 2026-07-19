import { Router } from 'express'
import { z } from 'zod'

const router = Router()

// Validate wallet address format
const validateAddressSchema = z.object({
  address: z.string().min(1, 'Address required'),
  currency: z.string().min(1, 'Currency required'),
  network: z.string().optional(),
})

router.post('/validate-address', (req, res) => {
  const parsed = validateAddressSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { address, currency } = parsed.data
  const trimmed = address.trim()

  // Bitcoin validation
  if (currency.toUpperCase() === 'BTC') {
    const isValid = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)
    res.json({
      valid: isValid,
      currency: 'BTC',
      type: trimmed.startsWith('bc1') ? 'SegWit' : trimmed.startsWith('3') ? 'P2SH' : 'P2PKH',
      ...(isValid ? { address: trimmed } : { error: 'Invalid Bitcoin address format' })
    })
    return
  }

  // Ethereum and EVM validation
  if (['ETH', 'USDT', 'USDC', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE', 'BSC'].includes(currency.toUpperCase())) {
    const isValid = /^0x[a-fA-F0-9]{40}$/.test(trimmed)
    res.json({
      valid: isValid,
      currency: currency.toUpperCase(),
      type: 'EVM Address',
      ...(isValid ? { address: trimmed } : { error: 'Invalid Ethereum address (must be 0x...)' })
    })
    return
  }

  // Solana validation
  if (currency.toUpperCase() === 'SOL') {
    const isValid = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(trimmed)
    res.json({
      valid: isValid,
      currency: 'SOL',
      type: 'Solana Address',
      ...(isValid ? { address: trimmed } : { error: 'Invalid Solana address format' })
    })
    return
  }

  // XRP validation
  if (currency.toUpperCase() === 'XRP') {
    const isValid = /^r[a-zA-Z0-9]{24,34}$/.test(trimmed)
    res.json({
      valid: isValid,
      currency: 'XRP',
      type: 'XRP Address',
      ...(isValid ? { address: trimmed } : { error: 'Invalid XRP address format' })
    })
    return
  }

  // Dogecoin validation
  if (currency.toUpperCase() === 'DOGE') {
    const isValid = /^D[a-zA-Z0-9]{33}$/.test(trimmed)
    res.json({
      valid: isValid,
      currency: 'DOGE',
      type: 'Dogecoin Address',
      ...(isValid ? { address: trimmed } : { error: 'Invalid Dogecoin address format' })
    })
    return
  }

  // Unknown currency - accept if non-empty
  res.json({
    valid: !!trimmed,
    currency: currency.toUpperCase(),
    type: 'Unknown',
    warning: `Address format validation not available for ${currency}. Verify manually.`,
    ...(trimmed ? { address: trimmed } : { error: 'Address cannot be empty' })
  })
})

// Compare two addresses to ensure user hasn't made a typo
router.post('/compare-addresses', (req, res) => {
  const schema = z.object({
    address1: z.string().min(1),
    address2: z.string().min(1),
    currency: z.string().min(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const { address1, address2, currency } = parsed.data
  const crypto = currency.toUpperCase()

  // Normalize for comparison
  const normalize = (addr: string) => {
    const trimmed = addr.trim()
    // Case-insensitive for most cryptos
    if (['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'XRP', 'DOGE'].includes(crypto)) {
      return trimmed.toLowerCase()
    }
    return trimmed
  }

  const norm1 = normalize(address1)
  const norm2 = normalize(address2)
  const match = norm1 === norm2

  // Find differences if they don't match
  let differences = []
  if (!match) {
    const maxLen = Math.max(norm1.length, norm2.length)
    for (let i = 0; i < maxLen; i++) {
      if ((norm1[i] || '') !== (norm2[i] || '')) {
        differences.push({
          position: i,
          char1: norm1[i] || 'END',
          char2: norm2[i] || 'END',
        })
      }
    }
  }

  res.json({
    match,
    ...(differences.length > 0 ? { differences: differences.slice(0, 5) } : {}),
    ...(differences.length > 5 ? { moreMatches: differences.length - 5 } : {}),
    security: match ? '✓ Addresses match' : '⚠ Addresses do not match'
  })
})

export default router
