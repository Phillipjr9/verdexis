import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { parseUserPrefs, readWithdrawalOverrides, applyWithdrawalFee } from '../lib/withdrawalOverrides.js'

const router = Router()

function calculateUserTier(balance: number, level: number): string {
  if (level >= 5 && balance >= 50000) return 'PLATINUM'
  if (level >= 4 && balance >= 25000) return 'GOLD'
  if (level >= 3 && balance >= 10000) return 'SILVER'
  if (level >= 2 && balance >= 5000) return 'BRONZE'
  if (level >= 1 && balance >= 1000) return 'VERIFIED'
  return 'UNVERIFIED'
}

function getProcessingFeeRate(tier: string, method: string): number {
  if (method === 'check') return 0
  const feeMap: Record<string, number> = {
    PLATINUM: 0.5,
    GOLD: 1.0,
    SILVER: 1.5,
    BRONZE: 2.0,
    VERIFIED: 2.5,
    UNVERIFIED: 3.0,
  }
  return Math.min(feeMap[tier] ?? 3.0, 15)
}

router.get('/withdrawals/estimate', requireAuth, async (req: AuthedRequest, res) => {
  const amount = Number(req.query.amount)
  const method = String(req.query.method || 'crypto')
  if (!Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: 'amount is required' })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { kycTier: true, walletBalances: true, prefs: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  const totalBalance = (user.walletBalances ?? []).reduce((sum, wb) => sum + wb.balance, 0)
  const level = user.kycTier === 'UNVERIFIED' ? 0 : parseInt(String(user.kycTier).split('_')[1] ?? '1', 10)
  const tier = calculateUserTier(totalBalance, Number.isFinite(level) ? level : 0)
  const overrides = readWithdrawalOverrides(parseUserPrefs(user.prefs))
  const applied = applyWithdrawalFee(amount, method, getProcessingFeeRate(tier, method), overrides)
  res.json({
    amount,
    method,
    tier,
    ratePct: applied.ratePct,
    source: applied.source,
    processingFee: applied.processingFee,
    totalDebit: amount + applied.processingFee,
    youReceive: amount,
    waiveFee: overrides.waiveFee,
    requireAdminApproval: overrides.requireAdminApproval,
  })
})

export default router
