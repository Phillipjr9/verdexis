import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { parseUserPrefs, readWithdrawalOverrides } from '../lib/withdrawalOverrides.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

const overrideSchema = z.object({
  feeRate: z.number().min(0).max(100).nullable().optional(),
  waiveFee: z.boolean().optional(),
  requireAdminApproval: z.boolean().optional(),
  forceHold: z.boolean().optional(),
  reason: z.string().max(500).optional(),
  notify: z.boolean().optional().default(true),
})

router.get('/users/:id/withdrawal-overrides', async (req: AuthedRequest, res) => {
  const userId = req.params.id ?? ''
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, prefs: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  const overrides = readWithdrawalOverrides(parseUserPrefs(user.prefs))
  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    ...overrides,
    forceHold: overrides.requireAdminApproval,
  })
})

router.post('/users/:id/withdrawal-overrides', async (req: AuthedRequest, res) => {
  const userId = req.params.id ?? ''
  const parsed = overrideSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, prefs: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const prefs = parseUserPrefs(user.prefs)
  const body = parsed.data
  if (body.feeRate === null) delete prefs.withdrawalFeeOverride
  else if (typeof body.feeRate === 'number') prefs.withdrawalFeeOverride = body.feeRate
  if (typeof body.waiveFee === 'boolean') prefs.withdrawalFeeWaived = body.waiveFee
  const hold = body.requireAdminApproval ?? body.forceHold
  if (typeof hold === 'boolean') {
    prefs.withdrawalRequireAdminApproval = hold
    prefs.withdrawalForceHold = hold
  }

  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.stringify(prefs) } })

  const overrides = readWithdrawalOverrides(prefs)

  if (body.notify !== false) {
    const parts: string[] = []
    if (body.waiveFee) parts.push('processing fee waived')
    if (body.waiveFee === false) parts.push('processing fee reinstated')
    if (hold) parts.push('withdrawals require admin approval')
    if (hold === false) parts.push('on-chain auto-release enabled')
    if (typeof body.feeRate === 'number') parts.push(`fee set to ${body.feeRate}%`)
    if (body.feeRate === null) parts.push('custom fee cleared')
    await prisma.notification.create({
      data: {
        userId,
        kind: 'system',
        title: 'Withdrawal settings updated',
        body: `An admin updated your withdrawal rules${parts.length ? ': ' + parts.join(', ') : ''}.${body.reason ? ' Reason: ' + body.reason : ''}`,
      },
    }).catch(() => {})
  }

  res.json({
    ok: true,
    ...overrides,
    forceHold: overrides.requireAdminApproval,
  })
})

export default router
