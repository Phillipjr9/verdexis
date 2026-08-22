import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { recordLedgerTransaction } from '../services/ledger.js'

const router = Router()

function getIdempotencyKey(req: AuthedRequest): string | undefined {
  const raw = req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key']
  if (!raw) return undefined
  return Array.isArray(raw) ? raw[0] : String(raw)
}

/** GET /api/wallet — balances + recent transactions for the signed-in user */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const [balances, transactions] = await Promise.all([
      prisma.walletBalance.findMany({
        where: { userId },
        orderBy: { currency: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])
    res.json({
      balances: balances.map((b) => ({
        currency: b.currency,
        symbol: b.currency === 'USD' ? '$' : b.currency,
        balance: Number(b.balance),
        available: Number(b.available),
        locked: Number(b.balance) - Number(b.available),
      })),
      transactions,
    })
  } catch (e) {
    console.error('[wallet] get', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load wallet' })
  }
})

router.get('/transactions', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    })
    res.json({ transactions })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.get('/lookup-recipient', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email) {
      res.status(400).json({ error: 'email required' })
      return
    }
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { email: true, name: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Lookup failed' })
  }
})

const transferSchema = z.object({
  recipientEmail: z.string().email(),
  currency: z.string().min(1).max(10),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
})

router.post('/transfer', requireAuth, idempotency(), async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const parsed = transferSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const currency = parsed.data.currency.toUpperCase()
    const amount = parsed.data.amount
    const recipient = await prisma.user.findFirst({
      where: { email: { equals: parsed.data.recipientEmail.trim(), mode: 'insensitive' } },
      select: { id: true, email: true, name: true, suspended: true, holdActive: true },
    })
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' })
      return
    }
    if (recipient.id === userId) {
      res.status(400).json({ error: 'Cannot transfer to yourself' })
      return
    }
    if (recipient.suspended) {
      res.status(400).json({ error: 'Recipient account is suspended' })
      return
    }

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { holdActive: true, holdType: true, email: true, name: true, suspended: true },
    })
    if (!sender || sender.suspended) {
      res.status(403).json({ error: 'Account not allowed to transfer' })
      return
    }
    if (sender.holdActive && (sender.holdType === 'all' || sender.holdType === 'transfer')) {
      res.status(403).json({ error: 'Transfers are on hold for this account' })
      return
    }

    const bal = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId, currency } },
    })
    if (!bal || Number(bal.available) < amount) {
      res.status(400).json({ error: 'Insufficient available balance' })
      return
    }

    const clientKey = getIdempotencyKey(req)
    const keyBase = clientKey
      ? `user_transfer:${clientKey}`
      : `user_transfer:${userId}:${recipient.id}:${currency}:${amount}:${crypto.randomUUID()}`

    const outRef = `Transfer to ${recipient.email}${parsed.data.note ? ' — ' + parsed.data.note : ''}`
    const inRef = `Transfer from ${sender.email}${parsed.data.note ? ' — ' + parsed.data.note : ''}`

    await prisma.$transaction(async (tx) => {
      await recordLedgerTransaction({
        tx,
        userId,
        asset: currency,
        amount,
        entryType: 'credit',
        kind: 'transfer',
        eventType: 'user_transfer',
        sourceType: 'wallet_transfer',
        sourceId: keyBase,
        externalRef: keyBase,
        idempotencyKey: `${keyBase}:out`,
        description: outRef,
        reference: outRef,
        createdBy: userId,
        subType: 'transfer',
        recordTransaction: true,
      })
      await recordLedgerTransaction({
        tx,
        userId: recipient.id,
        asset: currency,
        amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'user_transfer',
        sourceType: 'wallet_transfer',
        sourceId: `${keyBase}:in`,
        externalRef: `${keyBase}:in`,
        idempotencyKey: `${keyBase}:in`,
        description: inRef,
        reference: inRef,
        createdBy: userId,
        subType: 'transfer',
        recordTransaction: true,
      })
    })

    res.status(201).json({
      recipient: { email: recipient.email, name: recipient.name },
      amount,
      currency,
    })
  } catch (e) {
    console.error('[wallet] transfer', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Transfer failed' })
  }
})

router.get('/saved-wallet', requireAuth, async (_req, res) => {
  res.json({ wallet: null })
})

router.get('/link', requireAuth, async (_req, res) => {
  res.json({ wallet: null })
})

router.get('/links', requireAuth, async (_req, res) => {
  res.json({ links: [] })
})

router.get('/pending-deposits', requireAuth, async (_req, res) => {
  res.json({ pendingDeposits: [] })
})

router.get('/deposit-instructions', requireAuth, async (_req, res) => {
  res.json({ instructions: null, updatedAt: null })
})

router.get('/me/deposit-addresses', requireAuth, async (_req, res) => {
  res.json({ addresses: null })
})

router.get('/withdrawal-fee-config', requireAuth, async (_req, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: 'withdrawal_fee' } })
    if (!row?.value) {
      res.json({ ratePct: 0 })
      return
    }
    const parsed = JSON.parse(row.value)
    res.json({ ratePct: Number(parsed.ratePct) || 0 })
  } catch {
    res.json({ ratePct: 0 })
  }
})

export default router
