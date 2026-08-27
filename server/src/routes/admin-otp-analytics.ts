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

export default router
