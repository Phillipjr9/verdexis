/**
 * Admin console endpoints used by the React admin UI:
 * reviews moderation, broadcast, audit list, user create/bulk.
 */
import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router: Router = Router()

async function writeAudit(actorId: string, action: string, targetUserId?: string | null, payload?: unknown) {
  try {
    await prisma.adminAudit.create({
      data: {
        actorId,
        action,
        targetUserId: targetUserId || null,
        payload: payload != null ? JSON.stringify(payload) : null,
      },
    })
  } catch (e) {
    console.error('[admin-console audit]', e)
  }
}

router.get('/reviews/pending', requireAuth, requireAdmin, async (_req, res) => {
  const reviews = await prisma.review.findMany({
    where: { approved: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.json({ reviews })
})

router.post('/reviews/:id/approve', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const review = await prisma.review.update({
    where: { id: req.params.id },
    data: { approved: true },
  }).catch(() => null)
  if (!review) {
    res.status(404).json({ error: 'Review not found' })
    return
  }
  await writeAudit(req.userId!, 'review.approve', review.userId, { reviewId: review.id })
  res.json({ ok: true, review })
})

router.post('/reviews/:id/reject', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const existing = await prisma.review.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Review not found' })
    return
  }
  await prisma.review.delete({ where: { id: existing.id } })
  await writeAudit(req.userId!, 'review.reject', existing.userId, { reviewId: existing.id })
  res.json({ ok: true })
})

router.post('/broadcast', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    kind: z.enum(['system', 'alert', 'trade', 'deposit']).default('system'),
    title: z.string().trim().min(1).max(140),
    body: z.string().trim().max(1000).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const users = await prisma.user.findMany({
    where: { suspended: false },
    select: { id: true },
  })
  if (users.length === 0) {
    res.json({ count: 0 })
    return
  }
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      body: parsed.data.body || '',
    })),
  })
  await writeAudit(req.userId!, 'broadcast', null, {
    kind: parsed.data.kind,
    title: parsed.data.title,
    count: users.length,
  })
  res.json({ count: users.length })
})

router.get('/audit', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 2000)
  const action = (req.query.action as string) || undefined
  const actorId = (req.query.actorId as string) || undefined
  const targetUserId = (req.query.targetUserId as string) || undefined
  const since = req.query.since ? new Date(String(req.query.since)) : undefined
  const until = req.query.until ? new Date(String(req.query.until)) : undefined

  const where: Record<string, unknown> = {}
  if (action) where.action = { contains: action }
  if (actorId) where.actorId = actorId
  if (targetUserId) where.targetUserId = targetUserId
  if (since || until) {
    where.createdAt = {
      ...(since ? { gte: since } : {}),
      ...(until ? { lte: until } : {}),
    }
  }

  const audit = await prisma.adminAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: { select: { id: true, email: true, name: true } },
      target: { select: { id: true, email: true, name: true } },
    },
  })
  res.json({ audit })
})

router.post('/users', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().trim().min(1),
    password: z.string().min(8),
    username: z.string().trim().min(3).max(40).optional(),
    role: z.enum(['user', 'admin']).default('user'),
    initialUsdBalance: z.number().positive().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const email = parsed.data.email.trim().toLowerCase()
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
      username: parsed.data.username || null,
    },
  })
  if (parsed.data.initialUsdBalance) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: 'deposit',
        currency: 'USD',
        amount: parsed.data.initialUsdBalance,
        status: 'completed',
        reference: 'Admin opening balance',
      },
    }).catch(() => {})
  }
  await writeAudit(req.userId!, 'user.create', user.id, { email: user.email, role: user.role })
  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, investmentId: (user as any).investmentId } })
})

router.post('/users/bulk', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    ids: z.array(z.string()).min(1),
    action: z.enum(['hold', 'release', 'suspend', 'unsuspend', 'delete', 'revoke']),
    reason: z.string().optional(),
    holdType: z.enum(['all', 'withdraw', 'transfer']).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const ids = parsed.data.ids.filter((id) => id !== req.userId)
  let count = 0
  for (const id of ids) {
    try {
      if (parsed.data.action === 'suspend') {
        await prisma.user.update({ where: { id }, data: { suspended: true } })
        count++
      } else if (parsed.data.action === 'unsuspend') {
        await prisma.user.update({ where: { id }, data: { suspended: false } })
        count++
      } else if (parsed.data.action === 'hold') {
        await prisma.user.update({
          where: { id },
          data: {
            holdActive: true,
            holdType: parsed.data.holdType || 'all',
            holdReason: parsed.data.reason || 'admin_bulk',
          },
        })
        count++
      } else if (parsed.data.action === 'release') {
        await prisma.user.update({
          where: { id },
          data: { holdActive: false, holdType: null, holdReason: null },
        })
        count++
      } else if (parsed.data.action === 'delete') {
        await prisma.user.delete({ where: { id } })
        count++
      } else if (parsed.data.action === 'revoke') {
        await prisma.session.deleteMany({ where: { userId: id } }).catch(() => {})
        count++
      }
    } catch (e) {
      console.error('[bulk]', id, e)
    }
  }
  await writeAudit(req.userId!, `users.bulk.${parsed.data.action}`, null, { ids, count })
  res.json({ count })
})

export default router
