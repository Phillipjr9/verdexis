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

const KYC_TIER_LIMITS: Record<string, { dailyWithdrawLimit: number; monthlyWithdrawLimit: number; dailyTransferLimit: number; monthlyTransferLimit: number; maxTradeSize: number }> = {
  UNVERIFIED: { dailyWithdrawLimit: 100, monthlyWithdrawLimit: 500, dailyTransferLimit: 500, monthlyTransferLimit: 2000, maxTradeSize: 1000 },
  TIER_1: { dailyWithdrawLimit: 5000, monthlyWithdrawLimit: 50000, dailyTransferLimit: 10000, monthlyTransferLimit: 100000, maxTradeSize: 50000 },
  TIER_2: { dailyWithdrawLimit: 50000, monthlyWithdrawLimit: 500000, dailyTransferLimit: 100000, monthlyTransferLimit: 1000000, maxTradeSize: 500000 },
  TIER_3: { dailyWithdrawLimit: 250000, monthlyWithdrawLimit: 5000000, dailyTransferLimit: 500000, monthlyTransferLimit: 10000000, maxTradeSize: 5000000 },
}

function resolveTier(kycStatus?: string | null, kycTier?: string | null) {
  if (kycTier && KYC_TIER_LIMITS[kycTier]) return kycTier
  if (kycStatus === 'approved') return 'TIER_2'
  if (kycStatus === 'pending') return 'TIER_1'
  return 'UNVERIFIED'
}

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { kycStatus: true, kycTier: true, dailyWithdrawLimit: true, monthlyWithdrawLimit: true, dailyTransferLimit: true, monthlyTransferLimit: true, prefs: true },
    })
    const tierName = resolveTier(user?.kycStatus, user?.kycTier)
    const defaults = KYC_TIER_LIMITS[tierName]
    const [depositLimits, withdrawalLimits] = await Promise.all([
      prisma.depositLimit.findMany({ where: { userId: req.userId! } }).catch(() => []),
      prisma.withdrawalLimit.findMany({ where: { userId: req.userId! } }).catch(() => []),
    ])
    res.json({
      tier: {
        tier: tierName,
        kycStatus: user?.kycStatus || 'none',
        dailyWithdrawLimit: user?.dailyWithdrawLimit ?? defaults.dailyWithdrawLimit,
        monthlyWithdrawLimit: user?.monthlyWithdrawLimit ?? defaults.monthlyWithdrawLimit,
        dailyTransferLimit: user?.dailyTransferLimit ?? defaults.dailyTransferLimit,
        monthlyTransferLimit: user?.monthlyTransferLimit ?? defaults.monthlyTransferLimit,
        maxTradeSize: defaults.maxTradeSize,
      },
      depositLimits,
      withdrawalLimits,
    })
  } catch (error) {
    console.error('Limits summary error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

router.post('/admin/users/:userId/request-kyc', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const userId = req.params.userId ?? ''
    const requested = req.body?.requestVerification !== false
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
    if (!existing) { res.status(404).json({ error: 'User not found' }); return }
    const prefs = (existing.prefs && typeof existing.prefs === 'object') ? { ...(existing.prefs as object) } as Record<string, unknown> : {}
    prefs.kycRequested = requested
    const user = await prisma.user.update({ where: { id: userId }, data: { prefs: prefs as any } })
    res.json({ ok: true, kycRequested: requested, userId: user.id })
  } catch (error) {
    console.error('request-kyc error:', error)
    res.status(500).json({ error: 'Failed to request verification' })
  }
})

router.get('/deposit', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const asset = req.query.asset as string | undefined
    const limits = await prisma.depositLimit.findMany({ where: { userId: req.userId!, ...(asset ? { asset } : {}) } })
    res.json({ limits })
  } catch (error) {
    console.error('Deposit limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

router.post('/deposit', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = limitSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
    const { asset, dailyLimit, monthlyLimit, perTransactionLimit } = parsed.data
    const limit = await prisma.depositLimit.upsert({
      where: { userId_asset: { userId: req.userId!, asset: asset ?? null } },
      create: { userId: req.userId!, dailyLimit, monthlyLimit, perTransactionLimit },
      update: { dailyLimit, monthlyLimit, perTransactionLimit },
    })
    res.json({ limit })
  } catch (error) {
    console.error('Set deposit limit error:', error)
    res.status(500).json({ error: 'Failed to set limit' })
  }
})

async function listWithdrawal(req: AuthedRequest, res: any) {
  try {
    const asset = req.query.asset as string | undefined
    const limits = await prisma.withdrawalLimit.findMany({ where: { userId: req.userId!, ...(asset ? { asset } : {}) } })
    res.json({ limits })
  } catch (error) {
    console.error('Withdrawal limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
}
router.get('/withdrawal', requireAuth, listWithdrawal)
router.get('/withdraw', requireAuth, listWithdrawal)

router.post('/withdrawal', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = limitSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return }
    const { asset, dailyLimit, monthlyLimit, perTransactionLimit } = parsed.data
    const limit = await prisma.withdrawalLimit.upsert({
      where: { userId_asset: { userId: req.userId!, asset: asset ?? null } },
      create: { userId: req.userId!, dailyLimit, monthlyLimit, perTransactionLimit },
      update: { dailyLimit, monthlyLimit, perTransactionLimit },
    })
    res.json({ limit })
  } catch (error) {
    console.error('Set withdrawal limit error:', error)
    res.status(500).json({ error: 'Failed to set limit' })
  }
})

router.get('/admin/users/:userId/limits', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const depositLimits = await prisma.depositLimit.findMany({ where: { userId: req.params.userId } })
    const withdrawalLimits = await prisma.withdrawalLimit.findMany({ where: { userId: req.params.userId } })
    res.json({ depositLimits, withdrawalLimits })
  } catch (error) {
    console.error('Admin limits error:', error)
    res.status(500).json({ error: 'Failed to fetch limits' })
  }
})

export default router
