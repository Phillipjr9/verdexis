// Multi-Admin Hierarchy Routes
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

// Create a new sub-admin under current admin
router.post('/admins/create', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    canCreateAdmins: z.boolean().default(false),
    canManageUsers: z.boolean().default(true),
    canManageDeposits: z.boolean().default(true),
    canManageTransactions: z.boolean().default(true),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  // Check if current user is an admin with permission
  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canCreateAdmins) {
    res.status(403).json({ error: 'No permission to create admins' })
    return
  }

  try {
    const tempPassword = Math.random().toString(36).slice(-12)
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const newAdmin = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: 'admin',
        passwordHash,
      },
    })

    await prisma.adminHierarchy.create({
      data: {
        adminId: newAdmin.id,
        parentAdminId: req.userId!,
        canCreateAdmins: parsed.data.canCreateAdmins,
        canManageUsers: parsed.data.canManageUsers,
        canManageDeposits: parsed.data.canManageDeposits,
        canManageTransactions: parsed.data.canManageTransactions,
        createdBy: req.userId!,
      },
    })

    res.status(201).json({
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        tempPassword,
      },
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Get admin hierarchy
router.get('/admins/hierarchy', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const adminInfo = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
    include: {
      admin: { select: { id: true, email: true, name: true } },
    },
  })

  if (!adminInfo) {
    res.status(404).json({ error: 'Admin not found' })
    return
  }

  const subAdmins = await prisma.adminHierarchy.findMany({
    where: { parentAdminId: adminInfo.id },
    include: {
      admin: { select: { id: true, email: true, name: true } },
    },
  })

  const managedUsers = await prisma.userAdminAssignment.findMany({
    where: { adminId: req.userId! },
    include: {
      user: {
        select: { id: true, email: true, name: true, suspended: true, createdAt: true },
      },
    },
  })

  res.json({
    adminInfo,
    subAdmins,
    managedUsers: managedUsers.map((ua) => ({ ...ua.user, assignedAt: ua.assignedAt })),
  })
})

// Assign user to admin
router.post('/users/:userId/assign-admin', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { adminId } = z.object({ adminId: z.string() }).parse(req.body)

  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canManageUsers) {
    res.status(403).json({ error: 'No permission to manage users' })
    return
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true },
  })
  if (!admin || admin.role !== 'admin') {
    res.status(404).json({ error: 'Admin not found' })
    return
  }

  try {
    await prisma.userAdminAssignment.upsert({
      where: { userId_adminId: { userId: req.params.userId, adminId } },
      create: {
        userId: req.params.userId,
        adminId,
        assignedBy: req.userId!,
      },
      update: { assignedBy: req.userId!, assignedAt: new Date() },
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Get users managed by admin
router.get('/admins/:adminId/users', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canManageUsers) {
    res.status(403).json({ error: 'No permission' })
    return
  }

  const users = await prisma.userAdminAssignment.findMany({
    where: { adminId: req.params.adminId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          kycStatus: true,
          suspended: true,
          createdAt: true,
        },
      },
    },
  })

  res.json({
    users: users.map((ua) => ({
      ...ua.user,
      assignedAt: ua.assignedAt,
    })),
  })
})

// Add bank account for user
router.post('/users/:userId/bank-accounts', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    bankName: z.string().min(1).max(100),
    accountNumber: z.string().min(1).max(50),
    routingNumber: z.string().max(20).optional().nullable(),
    accountHolder: z.string().min(1).max(100),
    accountType: z.enum(['checking', 'savings']).default('checking'),
    country: z.string().max(2).optional().nullable(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canManageUsers) {
    res.status(403).json({ error: 'No permission' })
    return
  }

  try {
    const account = await prisma.adminBankAccount.create({
      data: {
        bankName: parsed.data.bankName,
        accountNumber: parsed.data.accountNumber,
        accountHolder: parsed.data.accountHolder,
        accountType: parsed.data.accountType,
        routingNumber: parsed.data.routingNumber || undefined,
        country: parsed.data.country || undefined,
        userId: req.params.userId,
        adminId: req.userId!,
      },
    })

    res.status(201).json({ account })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Get user's bank accounts
router.get('/users/:userId/bank-accounts', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const assignment = await prisma.userAdminAssignment.findFirst({
    where: { userId: req.params.userId, adminId: req.userId! },
  })
  if (!assignment) {
    res.status(403).json({ error: 'User not assigned to you' })
    return
  }

  const accounts = await prisma.adminBankAccount.findMany({
    where: { userId: req.params.userId },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      accountType: true,
      country: true,
      verifiedAt: true,
      createdAt: true,
    },
  })

  res.json({ accounts })
})

// Update bank account
router.patch('/bank-accounts/:accountId', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    bankName: z.string().max(100).optional(),
    accountHolder: z.string().max(100).optional(),
    country: z.string().max(2).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  try {
    const account = await prisma.adminBankAccount.update({
      where: { id: req.params.accountId },
      data: parsed.data,
    })

    res.json({ account })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Delete bank account
router.delete('/bank-accounts/:accountId', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  await prisma.adminBankAccount.delete({ where: { id: req.params.accountId } })
  res.json({ ok: true })
})

// Add wallet details for user
router.post('/users/:userId/wallet-details', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    walletAddress: z.string().min(1),
    chainId: z.string().optional().nullable(),
    walletType: z.string().default('ethereum'),
    label: z.string().max(100).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canManageUsers) {
    res.status(403).json({ error: 'No permission' })
    return
  }

  try {
    const detail = await prisma.adminWalletDetail.create({
      data: {
        walletAddress: parsed.data.walletAddress,
        chainId: parsed.data.chainId || undefined,
        walletType: parsed.data.walletType,
        label: parsed.data.label || undefined,
        notes: parsed.data.notes || undefined,
        userId: req.params.userId,
        adminId: req.userId!,
      },
    })

    res.status(201).json({ detail })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Get user's wallet details
router.get('/users/:userId/wallet-details', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const assignment = await prisma.userAdminAssignment.findFirst({
    where: { userId: req.params.userId, adminId: req.userId! },
  })
  if (!assignment) {
    res.status(403).json({ error: 'User not assigned to you' })
    return
  }

  const details = await prisma.adminWalletDetail.findMany({
    where: { userId: req.params.userId },
    select: {
      id: true,
      walletAddress: true,
      chainId: true,
      walletType: true,
      label: true,
      notes: true,
      verifiedAt: true,
      createdAt: true,
    },
  })

  res.json({ details })
})

// Update wallet detail
router.patch('/wallet-details/:detailId', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    label: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  try {
    const detail = await prisma.adminWalletDetail.update({
      where: { id: req.params.detailId },
      data: parsed.data,
    })

    res.json({ detail })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Delete wallet detail
router.delete('/wallet-details/:detailId', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  await prisma.adminWalletDetail.delete({ where: { id: req.params.detailId } })
  res.json({ ok: true })
})

export default router
