import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { unlockSignupBonus, getSignupBonusStatus } from '../services/signupBonus.js'

/**
 * Dedicated signup-bonus endpoints expected by AdminSignupBonus.tsx
 * and adminApi.getSignupBonus / setSignupBonus.
 * Persists via appSetting keys shared with admin-settings defaults.
 */
const router = Router()

const KEY_ENABLED = 'signup_bonus_enabled'
const KEY_AMOUNT = 'signup_bonus_amount'
const KEY_NOTE = 'signup_bonus_note'

async function readBonus() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [KEY_ENABLED, KEY_AMOUNT, KEY_NOTE] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r]))
  const enabled = (map[KEY_ENABLED]?.value ?? 'false') === 'true'
  const amountRaw = Number(map[KEY_AMOUNT]?.value ?? '0')
  const amountUsd = Number.isFinite(amountRaw) ? amountRaw : 0
  const note = map[KEY_NOTE]?.value ?? ''
  const updatedAt =
    [map[KEY_ENABLED], map[KEY_AMOUNT], map[KEY_NOTE]]
      .filter(Boolean)
      .map((r) => r!.updatedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? undefined
  return { enabled, amountUsd, note, updatedAt }
}

router.get('/signup-bonus', requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const data = await readBonus()
    res.json(data)
  } catch (error) {
    console.error('[signup-bonus] load failed:', error)
    res.status(500).json({ error: 'Failed to load signup bonus settings' })
  }
})

const putSchema = z.object({
  enabled: z.boolean(),
  amountUsd: z.number().finite().min(0).max(1_000_000),
  note: z.string().max(2000).optional(),
})

router.put('/signup-bonus', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = putSchema.safeParse({
    enabled: req.body?.enabled,
    amountUsd: Number(req.body?.amountUsd),
    note: req.body?.note,
  })
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const adminId = req.userEmail ?? req.userId ?? 'admin'
  const { enabled, amountUsd, note } = parsed.data

  try {
    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: KEY_ENABLED },
        create: { key: KEY_ENABLED, value: enabled ? 'true' : 'false', updatedBy: String(adminId) },
        update: { value: enabled ? 'true' : 'false', updatedBy: String(adminId) },
      }),
      prisma.appSetting.upsert({
        where: { key: KEY_AMOUNT },
        create: { key: KEY_AMOUNT, value: String(amountUsd), updatedBy: String(adminId) },
        update: { value: String(amountUsd), updatedBy: String(adminId) },
      }),
      prisma.appSetting.upsert({
        where: { key: KEY_NOTE },
        create: { key: KEY_NOTE, value: note ?? '', updatedBy: String(adminId) },
        update: { value: note ?? '', updatedBy: String(adminId) },
      }),
    ])
    const data = await readBonus()
    res.json(data)
  } catch (error) {
    console.error('[signup-bonus] save failed:', error)
    res.status(500).json({ error: 'Failed to save signup bonus settings' })
  }
})

/** Per-user bonus status (credited / locked). */
router.get('/users/:userId/signup-bonus', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const status = await getSignupBonusStatus(String(req.params.userId))
    res.json(status)
  } catch (e) {
    console.error('[signup-bonus] status failed', e)
    res.status(500).json({ error: 'Failed to load bonus status' })
  }
})

/** Unlock locked signup bonus so it becomes available. */
router.post('/users/:userId/signup-bonus/unlock', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const adminId = String(req.userId ?? req.userEmail ?? 'admin')
    const result = await unlockSignupBonus(String(req.params.userId), adminId)
    if (!result.unlocked) {
      res.status(400).json({ error: result.reason || 'Unlock failed', ...result })
      return
    }
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error('[signup-bonus] unlock failed', e)
    res.status(500).json({ error: 'Failed to unlock signup bonus' })
  }
})

export default router
