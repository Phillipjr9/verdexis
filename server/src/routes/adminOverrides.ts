import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

const overrideSchema = z.object({
  feeRate: z.number().min(0).max(100).nullable().optional(),
  waiveFee: z.boolean().optional(),
  requireAdminApproval: z.boolean().optional(),
  reason: z.string().max(500).optional(),
  notify: z.boolean().optional().default(true),
})

function parsePrefs(raw: string | null): Record<string, unknown> {
  try { return raw ? JSON.parse(raw) as Record<string, unknown> : {} } catch { return {} }
}

router.get('/users/:id/withdrawal-overrides', async (req: AuthedRequest, res) => {
  const userId = req.params.id ?? ''
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, prefs: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  const prefs = parsePrefs(user.prefs)
  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    feeRate: typeof prefs.withdrawalFeeOverride === 'number' ? prefs.withdrawalFeeOverride : null,
    waiveFee: prefs.withdrawalFeeWaived === true,
    requireAdminApproval: prefs.withdrawalRequireAdminApproval === true,
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

  const prefs = parsePrefs(user.prefs)
  const body = parsed.data
  if (body.feeRate === null) delete prefs.withdrawalFeeOverride
  else if (typeof body.feeRate === 'number') prefs.withdrawalFeeOverride = body.feeRate
  if (typeof body.waiveFee === 'boolean') prefs.withdrawalFeeWaived = body.waiveFee
  if (typeof body.requireAdminApproval === 'boolean') prefs.withdrawalRequireAdminApproval = body.requireAdminApproval

  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.stringify(prefs) } })

  if (body.notify !== false) {
    const parts: string[] = []
    if (body.waiveFee) parts.push('processing fee waived')
    if (body.requireAdminApproval) parts.push('withdrawals require admin approval')
    if (body.requireAdminApproval === false) parts.push('on-chain auto-release enabled')
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
    feeRate: typeof prefs.withdrawalFeeOverride === 'number' ? prefs.withdrawalFeeOverride : null,
    waiveFee: prefs.withdrawalFeeWaived === true,
    requireAdminApproval: prefs.withdrawalRequireAdminApproval === true,
  })
})

export default router
