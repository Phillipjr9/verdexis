import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import {
  isSuperAdmin,
  assignUserToAdmin,
} from '../lib/adminHierarchy.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

router.post('/admins', async (_req: AuthedRequest, res) => {
  res.status(403).json({ error: 'This platform has a single admin. Additional admins cannot be created.' })
})

router.get('/admins', async (_req: AuthedRequest, res) => {
  res.json({ admins: [], count: 0 })
})

router.get('/admins/:adminId', async (req: AuthedRequest, res) => {
  const adminId = req.params.adminId
  const superA = await isSuperAdmin(req.userId!)
  if (!superA && req.userId !== adminId) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  try {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' })
      return
    }
    res.json({
      admin,
      hierarchy: {
        canCreateAdmins: false,
        canManageUsers: true,
        canManageDeposits: true,
        canManageTransactions: true,
        parentAdmin: null,
        isSuperAdmin: superA && adminId === req.userId,
      },
      assignedUsersAndAdmins: [],
      assignedCount: 0,
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

const assignUserSchema = z.object({
  userId: z.string().min(1),
  adminId: z.string().min(1),
})

router.post('/assign-user', async (req: AuthedRequest, res) => {
  const parsed = assignUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    await assignUserToAdmin(parsed.data.adminId, parsed.data.userId, req.userId!)
    res.json({ ok: true, message: 'User assigned' })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

router.get('/admins/:adminId/users', async (req: AuthedRequest, res) => {
  const adminId = req.params.adminId
  const superA = await isSuperAdmin(req.userId!)
  if (!superA && req.userId !== adminId) {
    res.status(403).json({ error: 'Can only view your own assignments' })
    return
  }
  res.json({ usersAndAdmins: [], count: 0 })
})

router.post('/remove-assignment', async (req: AuthedRequest, res) => {
  const schema = z.object({
    userId: z.string().min(1),
    adminId: z.string().min(1),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  await prisma.userAdminAssignment.deleteMany({
    where: { userId: parsed.data.userId, adminId: parsed.data.adminId },
  })
  res.json({ ok: true, message: 'Assignment removed' })
})

export default router
