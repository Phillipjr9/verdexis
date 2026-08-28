/**
 * User-facing wallet endpoints that the SPA calls but were missing from wallet.ts.
 * Mounted at /api/wallet alongside the main wallet router.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { alertAdminsOfDeposit } from '../services/depositAlerts.js'

const router = Router()

const DEPOSIT_INSTRUCTIONS_KEY = 'deposit_instructions'

/** GET /api/wallet/me/deposit-addresses — per-user destinations assigned by admin */
router.get('/me/deposit-addresses', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { prefs: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    let prefs: Record<string, unknown> = {}
    try {
      if (user.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }
    res.json({ addresses: (prefs.depositAddresses as unknown) ?? null })
  } catch (e) {
    console.error('[wallet] me/deposit-addresses', e)
    res.status(500).json({ error: 'Failed to load deposit addresses' })
  }
})

/** GET /api/wallet/deposit-instructions — global wire/crypto destinations */
router.get('/deposit-instructions', requireAuth, async (_req: AuthedRequest, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: DEPOSIT_INSTRUCTIONS_KEY } })
    if (!row?.value) {
      res.json({ instructions: { wires: {}, cryptos: {}, web3: {} }, updatedAt: null })
      return
    }
    let instructions: unknown = { wires: {}, cryptos: {}, web3: {} }
    try {
      instructions = JSON.parse(row.value)
    } catch {
      /* keep empty */
    }
    res.json({ instructions, updatedAt: row.updatedAt?.toISOString?.() ?? null })
  } catch (e) {
    console.error('[wallet] deposit-instructions get', e)
    res.status(500).json({ error: 'Failed to load deposit instructions' })
  }
})

/** PUT /api/wallet/deposit-instructions — admin only */
router.put('/deposit-instructions', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { role: true },
    })
    if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
      res.status(403).json({ error: 'Admin only' })
      return
    }
    const body = req.body ?? {}
    const instructions = {
      wires: body.wires && typeof body.wires === 'object' ? body.wires : {},
      cryptos: body.cryptos && typeof body.cryptos === 'object' ? body.cryptos : {},
      web3: body.web3 && typeof body.web3 === 'object' ? body.web3 : {},
    }
    const value = JSON.stringify(instructions)
    const row = await prisma.appSetting.upsert({
      where: { key: DEPOSIT_INSTRUCTIONS_KEY },
      create: { key: DEPOSIT_INSTRUCTIONS_KEY, value, updatedBy: req.userId! },
      update: { value, updatedBy: req.userId! },
    })
    res.json({ instructions, updatedAt: row.updatedAt.toISOString() })
  } catch (e) {
    console.error('[wallet] deposit-instructions put', e)
    res.status(500).json({ error: 'Failed to save deposit instructions' })
  }
})

/** GET /api/wallet/pending-deposits */
router.get('/pending-deposits', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rows = await prisma.pendingDeposit.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({
      pendingDeposits: rows.map((r) => ({
        id: r.id,
        txHash: r.txHash,
        chainId: r.chainId,
        toAddress: r.toAddress,
        fromAddress: r.fromAddress,
        asset: r.asset,
        amount: r.amount,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('[wallet] pending-deposits list', e)
    res.status(500).json({ error: 'Failed to list pending deposits' })
  }
})

/** POST /api/wallet/pending-deposits */
router.post('/pending-deposits', requireAuth, idempotency(), async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const body = req.body ?? {}
    const toAddress = String(body.toAddress || '').trim()
    const asset = String(body.asset || '').trim().toUpperCase()
    const amount = Number(body.amount)
    if (!toAddress || !asset || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'toAddress, asset, and positive amount are required' })
      return
    }
    let txHash = String(body.txHash || '').trim()
    if (!txHash) {
      txHash = `pending:${userId}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`
    }
    const existing = await prisma.pendingDeposit.findUnique({ where: { txHash } }).catch(() => null)
    if (existing) {
      res.json({
        pendingDeposit: {
          id: existing.id,
          txHash: existing.txHash,
          status: existing.status,
          createdAt: existing.createdAt.toISOString(),
        },
        deduped: true,
      })
      return
    }
    const row = await prisma.pendingDeposit.create({
      data: {
        userId,
        txHash,
        chainId: String(body.chainId || 'unknown'),
        toAddress,
        fromAddress: String(body.fromAddress || 'user-wallet'),
        asset,
        amount,
        status: 'pending',
        note: body.note ? String(body.note) : null,
      },
    })

    // Notify user + admins (in-app + email with approve/reject links)
    try {
      await prisma.notification.create({
        data: {
          userId,
          kind: 'deposit',
          title: `Deposit pending approval: ${amount} ${asset}`,
          body: `Your deposit of ${amount} ${asset} is queued. Funds will be credited after admin confirmation.`,
        },
      })
      await alertAdminsOfDeposit(
        userId,
        amount,
        asset,
        row.id,
        `Pending deposit ${row.id}; transaction ${row.txHash}; destination ${toAddress}.`,
      )
    } catch (alertErr) {
      console.warn('[wallet] pending-deposits alert failed', alertErr)
    }

    res.status(201).json({
      pendingDeposit: {
        id: row.id,
        txHash: row.txHash,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('[wallet] pending-deposits create', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to record pending deposit' })
  }
})

export default router
