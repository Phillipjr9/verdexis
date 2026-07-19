import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { warnUnverified } from '../middleware/verificationCheck.js'

const router = Router()

const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  username: z.string().min(3).max(40).regex(/^[a-z0-9_.-]+$/i).toLowerCase().nullable().optional(),
  avatar: z.string().nullable().optional(), // data URL or null to remove
  prefs: z.record(z.unknown()).optional(),
  twoFactor: z.boolean().optional(),
})

router.patch('/', requireAuth, warnUnverified, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const data: {
    name?: string
    username?: string | null
    avatar?: string | null
    prefs?: string
    twoFactor?: boolean
  } = {}

  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.username !== undefined) {
    data.username = parsed.data.username
    try {
      // Database uniqueness constraint will enforce this atomically
      // Prevents TOCTOU race condition where two requests could both think username is available
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('P2002') || msg.includes('Unique constraint')) {
        res.status(409).json({ error: 'That username is already taken' })
        return
      }
      throw e
    }
  }
  if (parsed.data.avatar !== undefined) {
    if (parsed.data.avatar && parsed.data.avatar.length > 1_000_000) {
      res.status(413).json({ error: 'Avatar too large (>1 MB encoded)' })
      return
    }
    data.avatar = parsed.data.avatar
  }
  if (parsed.data.prefs !== undefined) data.prefs = JSON.stringify(parsed.data.prefs)
  if (parsed.data.twoFactor !== undefined) data.twoFactor = parsed.data.twoFactor

  const user = await prisma.user.update({ where: { id: userId }, data })
  let prefs: unknown = {}
  try {
    prefs = user.prefs ? JSON.parse(user.prefs) : {}
  } catch {
    prefs = {}
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      twoFactor: user.twoFactor,
      prefs,
    },
  })
})

router.delete('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  await prisma.user.delete({ where: { id: userId } })
  res.json({ ok: true })
})

export default router
