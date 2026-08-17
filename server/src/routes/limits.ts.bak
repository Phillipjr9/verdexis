import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

const limitSchema = z.object({
  asset: z.string().optional(),
  dailyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  perTransactionLimit: z.number().positive().optional(),
})

// Get user's deposit limits
router.get('/deposit', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const asset = req.query.asset as string | undefined

    const limits = await prisma.depositLimit.findMany({
      where: {
        userId: req.userId!,
        ...(asset ? { asset } : {}),
      },
    })

    res.json({ limits })
  } catch (error) {
    console.error('Deposit limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

// Set deposit limits
router.post('/deposit', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = limitSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { asset, dailyLimit, monthlyLimit, perTransactionLimit } = parsed.data

    const limit = await prisma.depositLimit.upsert({
      where: { userId_asset: { userId: req.userId!, asset: asset ?? null } },
      create: {
        userId: req.userId!,
        asset: asset ?? undefined,
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
        dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      update: {
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
      },
    })

    res.json({ limit })
  } catch (error) {
    console.error('Set deposit limit error:', error)
    res.status(500).json({ error: 'Failed to set limit' })
  }
})

// Get user's withdrawal limits
router.get('/withdrawal', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const asset = req.query.asset as string | undefined

    const limits = await prisma.withdrawalLimit.findMany({
      where: {
        userId: req.userId!,
        ...(asset ? { asset } : {}),
      },
    })

    res.json({ limits })
  } catch (error) {
    console.error('Withdrawal limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

// Set withdrawal limits
router.post('/withdrawal', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = limitSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { asset, dailyLimit, monthlyLimit, perTransactionLimit } = parsed.data

    const limit = await prisma.withdrawalLimit.upsert({
      where: { userId_asset: { userId: req.userId!, asset: asset ?? null } },
      create: {
        userId: req.userId!,
        asset: asset ?? undefined,
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
        dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      update: {
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
      },
    })

    res.json({ limit })
  } catch (error) {
    console.error('Set withdrawal limit error:', error)
    res.status(500).json({ error: 'Failed to set limit' })
  }
})

// Admin: Get all user limits
router.get('/admin/users/:userId/limits', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const depositLimits = await prisma.depositLimit.findMany({
      where: { userId: req.params.userId },
    })

    const withdrawalLimits = await prisma.withdrawalLimit.findMany({
      where: { userId: req.params.userId },
    })

    res.json({ depositLimits, withdrawalLimits })
  } catch (error) {
    console.error('Admin limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

// Admin: Override user limits
router.put('/admin/users/:userId/deposit-limit', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const parsed = limitSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { asset, dailyLimit, monthlyLimit, perTransactionLimit } = parsed.data
    const userId = req.params.userId ?? ''
    const assetValue = asset ?? undefined

    const limit = await prisma.depositLimit.upsert({
      where: { userId_asset: { userId, asset: assetValue ?? null } },
      create: {
        userId,
        asset: assetValue,
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
        dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      update: {
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
      },
    })

    // Audit log
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        targetUserId: userId,
        action: 'update_deposit_limit',
        payload: JSON.stringify({ asset, dailyLimit, monthlyLimit, perTransactionLimit }),
      },
    })

    res.json({ limit })
  } catch (error) {
    console.error('Admin set deposit limit error:', error)
    res.status(500).json({ error: 'Failed to set limit' })
  }
})

// Admin: Override withdrawal limits
router.put('/admin/users/:userId/withdrawal-limit', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const parsed = limitSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { asset, dailyLimit, monthlyLimit, perTransactionLimit } = parsed.data
    const userId = req.params.userId ?? ''
    const assetValue = asset ?? undefined

    const limit = await prisma.withdrawalLimit.upsert({
      where: { userId_asset: { userId, asset: assetValue ?? null } },
      create: {
        userId,
        asset: assetValue,
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
        dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      update: {
        dailyLimit,
        monthlyLimit,
        perTransactionLimit,
      },
    })

    // Audit log
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        targetUserId: userId,
        action: 'update_withdrawal_limit',
        payload: JSON.stringify({ asset, dailyLimit, monthlyLimit, perTransactionLimit }),
      },
    })

    res.json({ limit })
  } catch (error) {
    console.error('Admin set withdrawal limit error:', error)
    res.status(500).json({ error: 'Failed to set limit' })
  }
})

// Admin: Reset usage counters
router.post('/admin/users/:userId/reset-usage', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const { type, asset } = z.object({
      type: z.enum(['deposit', 'withdrawal']),
      asset: z.string().optional(),
    }).parse(req.body)

    if (type === 'deposit') {
      await prisma.depositLimit.updateMany({
        where: {
          userId: req.params.userId,
          ...(asset ? { asset } : {}),
        },
        data: {
          dailyUsed: 0,
          monthlyUsed: 0,
          dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      })
    } else {
      await prisma.withdrawalLimit.updateMany({
        where: {
          userId: req.params.userId,
          ...(asset ? { asset } : {}),
        },
        data: {
          dailyUsed: 0,
          monthlyUsed: 0,
          dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      })
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Reset usage error:', error)
    res.status(500).json({ error: 'Failed to reset usage' })
  }
})

export default router
