import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

/**
 * GET /api/admin/otp/analytics
 * Used by AdminSettings "OTP / 2FA Analytics" panel.
 */
router.get('/otp/analytics', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [totalUsers, otpEnabledCount, twoFactorCount] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }).catch(() => 0),
      prisma.user.count({ where: { deletedAt: null, twoFactor: true } }).catch(() => 0),
      prisma.user.count({ where: { deletedAt: null, twoFactor: true } }).catch(() => 0),
    ])

    let totalOTPs = 0
    let failedOTPs = 0
    try {
      const otpModel = (prisma as any).otpEvent || (prisma as any).otpCode || (prisma as any).loginOtp
      if (otpModel?.count) {
        totalOTPs = await otpModel.count({ where: { createdAt: { gte: since } } }).catch(() => 0)
        failedOTPs = await otpModel
          .count({
            where: {
              createdAt: { gte: since },
              OR: [{ success: false }, { verified: false }, { status: 'failed' }],
            },
          })
          .catch(() => 0)
      }
    } catch {
      /* optional table */
    }

    const adoptionRate =
      totalUsers > 0 ? `${Math.round((otpEnabledCount / totalUsers) * 1000) / 10}%` : '0%'
    const successRate =
      totalOTPs > 0
        ? `${Math.round(((totalOTPs - failedOTPs) / totalOTPs) * 1000) / 10}%`
        : '100%'

    res.json({
      totalUsers,
      otpEnabledCount,
      adoptionRate,
      requirements: {
        login: 1,
        transactions: 0,
        withdrawals: 1,
        twoFactor: twoFactorCount,
      },
      activity24h: {
        totalOTPs,
        failedOTPs,
        successRate,
      },
    })
  } catch (e) {
    console.error('[admin] otp analytics', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load OTP analytics' })
  }
})

// --- Compat aliases (admin UI paths that used to 404) -------------------

router.get('/wallets', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const links = await prisma.walletLink.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        verification: true,
      },
      orderBy: { linkedAt: 'desc' },
      take: 200,
    })
    res.json({
      wallets: links.map((l) => ({
        id: l.id,
        userId: l.userId,
        userEmail: l.user?.email,
        walletAddress: l.address,
        chainId: l.chainId,
        verifiedAt: l.verification?.verifiedAt ?? null,
        createdAt: l.linkedAt,
        isPrimary: l.isPrimary,
      })),
    })
  } catch (e) {
    console.error('[admin] wallets', e)
    res.status(500).json({ error: 'Failed to load wallets' })
  }
})

router.get('/transaction-export', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const exports = await prisma.transactionExport.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({ exports })
  } catch (e) {
    console.error('[admin] transaction-export', e)
    res.status(500).json({ error: 'Failed to load exports' })
  }
})

router.get('/security/events', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(String(req.query.days || '7'), 10) || 7
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const events = await prisma.securityEvent.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    res.json({
      events: events.map((event) => ({
        ...event,
        metadata: event.metadata ? JSON.parse(event.metadata as string) : null,
      })),
    })
  } catch (e) {
    console.error('[admin] security/events', e)
    res.json({ events: [] })
  }
})

export default router
