import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { addressGenerator } from '../cryptoAddressGenerator.js'

const router = Router()

const SUPPORTED_CURRENCIES = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'matic', 'polygon', 'usdc', 'usdt', 'dai']

const SYMBOL_BY_CURRENCY: Record<string, string> = {
  btc: 'BTC',
  bitcoin: 'BTC',
  eth: 'ETH',
  ethereum: 'ETH',
  sol: 'SOL',
  solana: 'SOL',
  matic: 'MATIC',
  polygon: 'MATIC',
  usdc: 'USDC',
  usdt: 'USDT',
  dai: 'DAI',
}

type CryptoOverride = {
  currency: string
  network: string
  address: string
  memo?: string
  notes?: string
  assignedBy?: 'admin' | 'user'
  assignedAt?: string
}

type DepositAddressesBlob = {
  cryptos?: Record<string, CryptoOverride>
  wire?: unknown
  notes?: string
  updatedAt?: string
  updatedBy?: string
}

function parsePrefs(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function getDepositBlob(prefs: Record<string, unknown>): DepositAddressesBlob {
  const current = prefs.depositAddresses
  if (current && typeof current === 'object') return current as DepositAddressesBlob
  return { cryptos: {} }
}

/** Persist a generated address onto the user prefs.depositAddresses. Returns the full blob. */
async function mergeGeneratedAddress(
  userId: string,
  currency: string,
  network: string,
  address: string,
): Promise<DepositAddressesBlob> {
  const symbol = SYMBOL_BY_CURRENCY[currency.toLowerCase()] || currency.toUpperCase()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
  const prefs = parsePrefs(user?.prefs)
  const current = getDepositBlob(prefs)
  const cryptos = { ...(current.cryptos || {}) }

  const existing = cryptos[symbol]
  // Never overwrite an admin-assigned address from the user generate path.
  if (existing?.assignedBy === 'admin') {
    return current
  }
  // Keep an existing address if one is already assigned.
  if (!existing?.address?.trim()) {
    cryptos[symbol] = { currency: symbol, network, address, assignedBy: 'user' }
  }

  const blob: DepositAddressesBlob = {
    ...current,
    cryptos,
    updatedAt: new Date().toISOString(),
  }
  prefs.depositAddresses = blob
  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.stringify(prefs) } })
  return blob
}

/** Read deposit addresses already stored on the user (admin + generated). */
router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
    const prefs = parsePrefs(user?.prefs)
    const addresses = getDepositBlob(prefs)
    const hasAny = Boolean(addresses.cryptos && Object.keys(addresses.cryptos).length)
    res.json({ addresses: hasAny ? addresses : null })
  } catch (err) {
    console.error('[deposit-addresses] mine error:', err)
    res.status(500).json({ error: 'Failed to fetch addresses' })
  }
})

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

router.get('/generate', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const currency = ((req.query.currency as string) || '').trim().toLowerCase()
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    res.status(400).json({ error: 'Unsupported currency', supported: SUPPORTED_CURRENCIES })
    return
  }

  try {
    const symbol = SYMBOL_BY_CURRENCY[currency] || currency.toUpperCase()

    // Prefer an address already stored on the user (admin or previous generate).
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
    const prefs = parsePrefs(user?.prefs)
    const existing = getDepositBlob(prefs).cryptos?.[symbol]
    if (existing?.address?.trim()) {
      const qrCodeUrl = addressGenerator.generateQRCode(existing.address)
      res.json({
        address: existing.address,
        currency: currency,
        network: existing.network || 'Unknown',
        chainId: '',
        qrCodeUrl,
        cached: true,
        persisted: true,
        assignedBy: existing.assignedBy || 'user',
      })
      return
    }

    const generated = addressGenerator.generateAddress(userId, currency)
    const qrCodeUrl = addressGenerator.generateQRCode(generated.address)

    // Persist BEFORE responding so the address sticks to the user.
    const blob = await mergeGeneratedAddress(
      userId,
      generated.currency,
      generated.network,
      generated.address,
    )

    res.json({
      ...generated,
      qrCodeUrl,
      cached: false,
      persisted: true,
      assignedBy: 'user',
      addresses: blob,
    })
  } catch (err) {
    console.error('[deposit-addresses] generate error:', err)
    res.status(400).json({ error: (err as Error).message })
  }
})

const saveSchema = z.object({
  cryptos: z.record(z.object({
    currency: z.string().min(1).max(16),
    network: z.string().min(1).max(64),
    address: z.string().min(8).max(128),
    memo: z.string().max(128).optional(),
    notes: z.string().max(300).optional(),
  })),
})

router.put('/save', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const parsed = saveSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
  const prefs = parsePrefs(user?.prefs)
  const current = getDepositBlob(prefs)
  const cryptos = { ...(current.cryptos || {}) }
  for (const [symbol, row] of Object.entries(parsed.data.cryptos)) {
    const key = symbol.toUpperCase()
    const existing = cryptos[key]
    // Never overwrite admin-assigned or any existing address from the user save path.
    if (existing?.address) continue
    if (existing?.assignedBy === 'admin') continue
    cryptos[key] = {
      currency: row.currency.toUpperCase(),
      network: row.network,
      address: row.address,
      memo: row.memo,
      notes: row.notes,
      assignedBy: 'user',
    }
  }
  const blob: DepositAddressesBlob = {
    ...current,
    cryptos,
    updatedAt: new Date().toISOString(),
  }
  prefs.depositAddresses = blob
  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.stringify(prefs) } })
  res.json({ addresses: blob })
})

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
    if (isPrimary) {
      await prisma.walletLink.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

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

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params

  try {
    const walletLink = await prisma.walletLink.findUnique({ where: { id } })
    if (!walletLink) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }
    if (walletLink.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    await prisma.walletLink.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    console.error('[deposit-addresses] delete error:', err)
    res.status(500).json({ error: 'Failed to unlink wallet' })
  }
})

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
