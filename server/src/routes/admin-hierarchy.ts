import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import {
  isSuperAdmin,
  canCreateAdmins,
  createSubAdmin,
  getSubAdmins,
  assignUserToAdmin,
  getAdminUsers,
  getAdminParent
} from '../lib/adminHierarchy.js'

const router = Router()

// Apply auth and admin middleware to all routes
router.use(requireAuth)
router.use(requireAdmin)

// --- CREATE SUB-ADMIN (Super Admin only) ---

const createSubAdminSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(200),
})

router.post('/admins', async (req: AuthedRequest, res) => {
  const parsed = createSubAdminSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  // Verify caller is Super Admin
  const superA = await isSuperAdmin(req.userId!)
  if (!superA) {
    res.status(403).json({ error: 'Only Super Admin can create new admins' })
    return
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    res.status(409).json({ error: 'Email already exists' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    
    const newAdmin = await createSubAdmin(req.userId!, {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash
    })

    const admin = await prisma.user.findUnique({
      where: { id: newAdmin },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    })

    res.status(201).json({
      ok: true,
      admin,
      message: `Admin ${parsed.data.email} created successfully. They can fund users but cannot create other admins.`
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- LIST SUB-ADMINS (Super Admin only) ---

router.get('/admins', async (req: AuthedRequest, res) => {
  const superA = await isSuperAdmin(req.userId!)
  if (!superA) {
    res.status(403).json({ error: 'Only Super Admin can view sub-admins' })
    return
  }

  try {
    const admins = await getSubAdmins(req.userId!)
    res.json({ admins, count: admins.length })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- GET ADMIN DETAILS ---

router.get('/admins/:adminId', async (req: AuthedRequest, res) => {
  const adminId = req.params.adminId

  // Only Super Admin or the admin themselves can view details
  const superA = await isSuperAdmin(req.userId!)
  if (!superA && req.userId !== adminId) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  try {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    if (!admin) {
      res.status(404).json({ error: 'Admin not found' })
      return
    }

    const hierarchy = await prisma.adminHierarchy.findUnique({
      where: { adminId }
    })

    const parentId = hierarchy?.parentAdminId
    const parent = parentId ? await prisma.user.findUnique({
      where: { id: parentId },
      select: { id: true, email: true, name: true }
    }) : null

    // Get users and admins assigned to this admin (for funding)
    const assignments = await prisma.userAdminAssignment.findMany({
      where: { adminId },
      include: { user: { select: { id: true, email: true, name: true, role: true, createdAt: true } } }
    })

    res.json({
      admin,
      hierarchy: {
        canCreateAdmins: hierarchy?.canCreateAdmins,
        canManageUsers: hierarchy?.canManageUsers,
        canManageDeposits: hierarchy?.canManageDeposits,
        canManageTransactions: hierarchy?.canManageTransactions,
        parentAdmin: parent,
        isSuperAdmin: superA && adminId === req.userId
      },
      assignedUsersAndAdmins: assignments.map(a => a.user),
      assignedCount: assignments.length
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- ASSIGN USER OR ADMIN TO AN ADMIN (for funding) ---

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
    const superA = await isSuperAdmin(req.userId!)
    const targetAdmin = await prisma.adminHierarchy.findUnique({
      where: { adminId: parsed.data.adminId }
    })

    if (!superA && req.userId !== parsed.data.adminId) {
      res.status(403).json({ error: 'Only Super Admin or the admin can assign users' })
      return
    }

    if (!superA && targetAdmin?.parentAdminId !== req.userId) {
      res.status(403).json({ error: 'Can only assign users to your own sub-admins' })
      return
    }

    // Get target user's role to identify if it's an admin or user
    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { role: true, email: true }
    })

    if (!targetUser) {
      res.status(404).json({ error: 'User or admin not found' })
      return
    }

    await assignUserToAdmin(parsed.data.adminId, parsed.data.userId, req.userId!)

    const assignmentType = targetUser.role === 'admin' ? 'Admin' : 'User'
    res.json({ 
      ok: true, 
      message: `${assignmentType} assigned successfully for funding purposes` 
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- GET ADMIN'S ASSIGNED USERS AND ADMINS (for funding) ---

router.get('/admins/:adminId/users', async (req: AuthedRequest, res) => {
  const adminId = req.params.adminId

  try {
    const superA = await isSuperAdmin(req.userId!)
    if (!superA && req.userId !== adminId) {
      res.status(403).json({ error: 'Can only view your own assignments' })
      return
    }

    const assignments = await prisma.userAdminAssignment.findMany({
      where: { adminId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            suspended: true,
            kycStatus: true,
            createdAt: true
          }
        }
      }
    })

    res.json({
      usersAndAdmins: assignments.map(a => ({
        ...a.user,
        assignedAt: a.assignedAt,
        type: a.user.role === 'admin' ? 'admin' : 'user'
      })),
      count: assignments.length
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// --- REMOVE USER ASSIGNMENT ---

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

  try {
    const superA = await isSuperAdmin(req.userId!)
    if (!superA && req.userId !== parsed.data.adminId) {
      res.status(403).json({ error: 'Only Super Admin can remove assignments' })
      return
    }

    await prisma.userAdminAssignment.deleteMany({
      where: {
        userId: parsed.data.userId,
        adminId: parsed.data.adminId
      }
    })

    res.json({ ok: true, message: 'Assignment removed' })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

export default router
