import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { depositMonitor } from '../depositMonitor.js'

const router = Router()

const depositSchema = z.object({
  amount: z.number().positive().min(0.001),
  currency: z.string().min(1).max(10),
  toAddress: z.string().min(26).max(100), // Wallet address to send to
})

// POST /api/deposits/initiate
// Initiate a deposit by recording user's intention to send crypto
// Web3 monitor will auto-detect on-chain transaction and credit user
router.post('/initiate', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const parsed = depositSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { amount, currency, toAddress } = parsed.data

  try {
    // Record pending deposit
    const pendingDeposit = await prisma.pendingDeposit.create({
      data: {
        userId,
        txHash: '', // Will be filled by Web3 monitor
        chainId: 'self-hosted',
        toAddress,
        fromAddress: 'user-wallet',
        asset: currency,
        amount,
        status: 'pending',
        note: 'Web3 monitor will auto-detect on-chain deposit',
      },
    })

    // Register address for on-chain monitoring
    // Monitor will detect transaction and auto-credit user wallet
    depositMonitor.registerDeposit(pendingDeposit.id, toAddress, userId, currency)

    res.json({
      deposit_id: pendingDeposit.id,
      provider: 'self-hosted',
      deposit_address: toAddress,
      amount,
      currency,
      instructions: `Send ${amount} ${currency} to: ${toAddress}`,
      auto_credit: true,
      auto_credit_note: 'Your balance will be updated automatically once we detect the on-chain transaction',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hour expiry
    })
  } catch (err) {
    console.error('[deposits] initiate error:', err)
    res.status(500).json({ error: 'Failed to initiate deposit' })
  }
})

// GET /api/deposits/:depositId
// Check deposit status (including auto-detected on-chain deposits)
router.get('/:depositId', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { depositId } = req.params

  try {
    const deposit = await prisma.pendingDeposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit) {
      res.status(404).json({ error: 'Deposit not found' })
      return
    }

    if (deposit.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    res.json({
      id: deposit.id,
      status: deposit.status,
      amount: deposit.amount,
      currency: deposit.asset,
      address: deposit.toAddress,
      tx_hash: deposit.txHash,
      auto_credited: deposit.status === 'completed' && !deposit.txHash.startsWith('0x'),
      created_at: deposit.createdAt,
      updated_at: deposit.updatedAt,
    })
  } catch (err) {
    console.error('[deposits] get error:', err)
    res.status(500).json({ error: 'Failed to fetch deposit' })
  }
})

// POST /api/deposits/:depositId/confirm (Optional - for manual confirmation)
// Admin can manually confirm if auto-detection fails
const confirmSchema = z.object({
  txHash: z.string().min(1),
  confirmations: z.number().int().positive().optional(),
})

router.post('/:depositId/confirm', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Only admins can manually confirm deposits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }

  const { depositId } = req.params
  const parsed = confirmSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { txHash, confirmations } = parsed.data

  try {
    const deposit = await prisma.pendingDeposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit) {
      res.status(404).json({ error: 'Deposit not found' })
      return
    }

    if (deposit.status === 'completed') {
      res.status(400).json({ error: 'Deposit already completed' })
      return
    }

    // Credit user's wallet
    const walletBalance = await prisma.walletBalance.findUnique({
      where: {
        userId_currency: {
          userId: deposit.userId,
          currency: deposit.asset,
        },
      },
    })

    const newBalance = (walletBalance?.balance || 0) + deposit.amount
    const newAvailable = (walletBalance?.available || 0) + deposit.amount

    await prisma.walletBalance.upsert({
      where: {
        userId_currency: {
          userId: deposit.userId,
          currency: deposit.asset,
        },
      },
      create: {
        userId: deposit.userId,
        currency: deposit.asset,
        symbol: deposit.asset,
        balance: newBalance,
        available: newAvailable,
      },
      update: {
        balance: newBalance,
        available: newAvailable,
      },
    })

    // Mark deposit as completed
    await prisma.pendingDeposit.update({
      where: { id: depositId },
      data: {
        status: 'completed',
        txHash,
        updatedAt: new Date(),
      },
    })

    res.json({
      id: depositId,
      status: 'completed',
      txHash,
      confirmations: confirmations || 1,
      manually_confirmed: true,
    })
  } catch (err) {
    console.error('[deposits] confirm error:', err)
    res.status(500).json({ error: 'Failed to confirm deposit' })
  }
})

// GET /api/deposits/monitoring/status
// Check Web3 monitor status
router.get('/monitoring/status', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    // Get user's pending deposits
    const pendingDeposits = await prisma.pendingDeposit.findMany({
      where: { userId, status: 'pending' },
      select: {
        id: true,
        asset: true,
        amount: true,
        toAddress: true,
        createdAt: true,
      },
    })

    res.json({
      monitoring_active: true,
      check_interval_ms: 30000,
      pending_deposits: pendingDeposits.length,
      deposits: pendingDeposits,
      note: 'Web3 monitor scans blockchain every 30 seconds for incoming deposits',
    })
  } catch (err) {
    console.error('[deposits] monitoring status error:', err)
    res.status(500).json({ error: 'Failed to fetch monitoring status' })
  }
})

export default router
