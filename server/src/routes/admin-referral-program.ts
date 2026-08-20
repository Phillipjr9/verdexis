import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import {
  readReferralSettings,
  writeReferralSettings,
  activateReferralOnDeposit,
} from '../referrals.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

const referralSettingsSchema = z.object({
  enabled: z.boolean(),
  referrerBonusUsd: z.number().min(0).max(1_000_000),
  refereeBonusUsd: z.number().min(0).max(1_000_000),
  minDepositUsd: z.number().min(0).max(1_000_000),
  note: z.string().max(500).optional().or(z.literal('')),
})

/**
 * GET /api/admin/referral-settings
 * Admin can read current program config (enabled flag, bonuses, min deposit).
 */
router.get('/referral-settings', async (_req: AuthedRequest, res) => {
  const settings = await readReferralSettings()
  res.json(settings)
})

/**
 * PUT /api/admin/referral-settings
 * Admin can enable/disable the program anytime and adjust bonus amounts.
 * When disabled: new signups are not linked; deposit activation creates no bonuses.
 * Existing pending/active referrals are left as-is.
 */
router.put('/referral-settings', async (req: AuthedRequest, res) => {
  const parsed = referralSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const updated = await writeReferralSettings(
    {
      enabled: parsed.data.enabled === true,
      referrerBonusUsd: parsed.data.referrerBonusUsd,
      refereeBonusUsd: parsed.data.refereeBonusUsd,
      minDepositUsd: parsed.data.minDepositUsd,
      note: (parsed.data.note || '').trim(),
    },
    req.userId!,
  )
  try {
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        action: 'referral.settings.update',
        payload: JSON.stringify(updated).slice(0, 4000),
      },
    })
  } catch {
    /* best-effort */
  }
  res.json(updated)
})

/**
 * POST /api/admin/deposits/:tid/activate-referral
 * Explicit hook after deposit approval. Safe to call multiple times —
 * activation only applies to pending referrals and respects the enabled flag.
 */
router.post('/deposits/:tid/activate-referral', async (req: AuthedRequest, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.tid } })
  if (!tx || tx.kind !== 'deposit' || tx.status !== 'completed') {
    res.status(400).json({ error: 'Completed deposit transaction required' })
    return
  }
  const result = await activateReferralOnDeposit(tx.userId, Number(tx.amount))
  res.json(result)
})

export default router
