/**
 * TEMPORARY minimal admin router to unblock Vercel build after PLACEHOLDER overwrite.
 * Full admin.ts must be restored from commit 62945911 or local admin_patched.ts.
 */
import { Router } from 'express'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import { creditReferralBonus, activateReferralOnDeposit } from '../referrals.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

router.get('/stats', async (_req, res) => {
  try {
    const [users, pendingDeposits] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count({ where: { kind: 'deposit', status: 'pending' } }),
    ])
    res.json({
      stats: { users, pendingDeposits },
      note: 'Minimal admin router active — restore full admin.ts from git history',
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'error' })
  }
})

// Keep referral bonus credit endpoint used by AdminReferrals UI
router.post('/referral-bonuses/:bonusId/credit', async (req: AuthedRequest, res) => {
  try {
    const result = await creditReferralBonus(req.params.bonusId, req.body?.paymentMethod || 'trading_credit')
    res.json({ success: true, result })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to credit bonus' })
  }
})

// Explicit referral activation (also available via admin-referral-program)
router.post('/deposits/:tid/activate-referral', async (req: AuthedRequest, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.tid } })
  if (!tx || tx.kind !== 'deposit' || tx.status !== 'completed') {
    res.status(400).json({ error: 'Completed deposit transaction required' })
    return
  }
  const result = await activateReferralOnDeposit(tx.userId, Number(tx.amount))
  res.json(result)
})

router.get('/signup-bonus', async (_req, res) => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'signup_bonus' } })
  if (!row?.value) {
    res.json({ enabled: false, amountUsd: 0, note: '' })
    return
  }
  try {
    res.json(JSON.parse(row.value))
  } catch {
    res.json({ enabled: false, amountUsd: 0, note: '' })
  }
})

export default router
