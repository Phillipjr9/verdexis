import { Router } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import {
  mapBalances,
  clampTransactionLimit,
  normalizeEmail,
  evaluateTransferGate,
  buildTransferKeyBase,
  parseWithdrawalFeeRate,
  transferBodySchema,
} from './walletHelpers.js'

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
      balances: mapBalances(balances),
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
    const take = clampTransactionLimit(req.query.limit)
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
    const email = normalizeEmail(req.query.email)
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

router.post('/transfer', requireAuth, idempotency(), async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const parsed = transferBodySchema.safeParse(req.body)
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

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { holdActive: true, holdType: true, email: true, name: true, suspended: true },
    })

    const bal = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId, currency } },
    })
    const available = bal ? Number(bal.available) : null

    const gate = evaluateTransferGate({
      senderId: userId,
      sender,
      recipient,
      amount,
      available,
    })
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.error })
      return
    }

    const recipientId = recipient!.id
    const clientKey = getIdempotencyKey(req)
    const keyBase = buildTransferKeyBase({
      clientKey,
      senderId: userId,
      recipientId,
      currency,
      amount,
      uuid: crypto.randomUUID(),
    })

    const outRef = `Transfer to ${recipient!.email}${parsed.data.note ? ' — ' + parsed.data.note : ''}`
    const inRef = `Transfer from ${sender!.email}${parsed.data.note ? ' — ' + parsed.data.note : ''}`

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
        userId: recipientId,
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
      recipient: { email: recipient!.email, name: recipient!.name },
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
    res.json({ ratePct: parseWithdrawalFeeRate(row?.value) })
  } catch {
    res.json({ ratePct: 0 })
  }
})

export default router
