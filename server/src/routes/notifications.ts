import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router: Router = Router()

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const unread = notifications.filter((n) => !n.read).length
  res.json({ notifications, unread })
})

router.post('/read', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
  res.json({ ok: true })
})

router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!notification) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json({ notification })
})

router.put('/:id/read', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!notification) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  })
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!n || n.userId !== userId) { res.status(404).json({ error: 'Not found' }); return }
    await prisma.notification.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

export default router
