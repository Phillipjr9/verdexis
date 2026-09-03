import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireFullAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

router.post('/users/:id/role', requireAuth, requireFullAdmin, async (req: AuthedRequest, res) => {
  const role = String((req.body as { role?: string })?.role || '').toLowerCase()
  if (role !== 'subadmin' && role !== 'user') {
    res.status(400).json({ error: 'Role must be subadmin or user' })
    return
  }
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, role: true, deletedAt: true },
  })
  if (!target || target.deletedAt) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (target.id === req.userId) {
    res.status(400).json({ error: 'Cannot change your own role here' })
    return
  }
  if (target.role === 'admin') {
    res.status(403).json({ error: 'Cannot change a full admin from this action' })
    return
  }
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  })
  res.json({ user })
})

export default router
