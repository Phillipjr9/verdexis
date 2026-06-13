import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { addressGenerator } from '../cryptoAddressGenerator.js'

const router = Router()

// Supported currencies for deposit addresses
const SUPPORTED_CURRENCIES = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'matic', 'polygon', 'usdc', 'usdt', 'dai']

// Cache to avoid regenerating same address repeatedly
const addressCache = new Map<string, { address: string; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// GET /api/deposit-addresses
// List user's existing deposit addresses
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const walletLinks = await prisma.walletLink.findMany({
      where: { userId },
      select: {
        id: true,
        address: true,
        chainId: true,
        provider: true,
        label: true,
        isPrimary: true,
        linkedAt: true,
      },
    })

    res.json({ addresses: walletLinks })
  } catch (err) {
    console.error('[deposit-addresses] list error:', err)
    res.status(500).json({ error: 'Failed to fetch addresses' })
  }
})

// GET /api/deposit-addresses/generate?currency=btc
// Generate a new deposit address for the given currency
router.get('/generate', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const currency = ((req.query.currency as string) || '').trim().toLowerCase()
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    res.status(400).json({
      error: 'Unsupported currency',
      supported: SUPPORTED_CURRENCIES,
    })
    return
  }

  try {
    // Check cache first
    const cacheKey = `${userId}-${currency}`
    const cached = addressCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const generated = addressGenerator.generateAddress(userId, currency)
      const qrCodeUrl = addressGenerator.generateQRCode(generated.address)
      res.json({
        ...generated,
        qrCodeUrl,
        cached: true,
      })
      return
    }

    const generated = addressGenerator.generateAddress(userId, currency)
    const qrCodeUrl = addressGenerator.generateQRCode(generated.address)

    // Update cache
    addressCache.set(cacheKey, {
      address: generated.address,
      timestamp: Date.now(),
    })

    res.json({
      ...generated,
      qrCodeUrl,
      cached: false,
    })
  } catch (err) {
    console.error('[deposit-addresses] generate error:', err)
    res.status(400).json({ error: (err as Error).message })
  }
})

// POST /api/deposit-addresses/link
// Link an external wallet address (e.g., MetaMask)
const linkWalletSchema = z.object({
  address: z.string().min(26).max(100),
  chainId: z.string().optional(),
  provider: z.string().optional(),
  label: z.string().max(100).optional(),
  isPrimary: z.boolean().optional(),
})

router.post('/link', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const parsed = linkWalletSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { address, chainId, provider, label, isPrimary } = parsed.data

  try {
    // If marking as primary, unmark any existing primary
    if (isPrimary) {
      await prisma.walletLink.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    // Create or update wallet link
    const walletLink = await prisma.walletLink.upsert({
      where: { userId_address: { userId, address: address.toLowerCase() } },
      create: {
        userId,
        address: address.toLowerCase(),
        chainId,
        provider,
        label,
        isPrimary: isPrimary ?? false,
      },
      update: {
        label,
        isPrimary: isPrimary ?? undefined,
      },
    })

    res.json({
      id: walletLink.id,
      address: walletLink.address,
      chainId: walletLink.chainId,
      provider: walletLink.provider,
      label: walletLink.label,
      isPrimary: walletLink.isPrimary,
      linkedAt: walletLink.linkedAt,
    })
  } catch (err) {
    console.error('[deposit-addresses] link error:', err)
    res.status(500).json({ error: 'Failed to link wallet' })
  }
})

// DELETE /api/deposit-addresses/:id
// Unlink a wallet address
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params

  try {
    const walletLink = await prisma.walletLink.findUnique({
      where: { id },
    })

    if (!walletLink) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    if (walletLink.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    await prisma.walletLink.delete({
      where: { id },
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('[deposit-addresses] delete error:', err)
    res.status(500).json({ error: 'Failed to unlink wallet' })
  }
})

// GET /api/deposit-addresses/supported
// List supported currencies
router.get('/supported', (_req, res) => {
  res.json({
    currencies: [
      { symbol: 'btc', name: 'Bitcoin', network: 'Bitcoin Mainnet' },
      { symbol: 'eth', name: 'Ethereum', network: 'Ethereum Mainnet', chainId: '0x1' },
      { symbol: 'sol', name: 'Solana', network: 'Solana Mainnet', chainId: '101' },
      { symbol: 'matic', name: 'Polygon', network: 'Polygon Mainnet', chainId: '0x89' },
      { symbol: 'usdc', name: 'USD Coin', network: 'Ethereum Mainnet', chainId: '0x1' },
      { symbol: 'usdt', name: 'Tether', network: 'Ethereum Mainnet', chainId: '0x1' },
      { symbol: 'dai', name: 'Dai', network: 'Ethereum Mainnet', chainId: '0x1' },
    ],
  })
})

export default router
