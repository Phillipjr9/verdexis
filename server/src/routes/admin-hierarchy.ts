// Multi-Admin Hierarchy Routes
// Add to server/src/routes/admin.ts

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

// ============================================================================
// ADMIN HIERARCHY MANAGEMENT
// ============================================================================

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

  // Check if current user is an admin
  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin || !currentAdmin.canCreateAdmins) {
    res.status(403).json({ error: 'You do not have permission to create admins' })
    return
  }

  try {
    // Create new admin user
    const tempPassword = Math.random().toString(36).slice(-12)
    const newAdmin = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: 'admin',
        passwordHash: await hashPassword(tempPassword), // Use your hashing function
      },
    })

    // Create admin hierarchy entry
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
        tempPassword, // Send to admin to give to new admin
      },
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Get admin hierarchy (current user's admins and subordinates)
router.get('/admins/hierarchy', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const adminInfo = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
    include: {
      admin: { select: { id: true, email: true, name: true } },
      parentAdmin: { select: { id: true, email: true, name: true } },
    },
  })

  const subAdmins = await prisma.adminHierarchy.findMany({
    where: { parentAdminId: req.userId! },
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

// ============================================================================
// USER MANAGEMENT (assign users to admins)
// ============================================================================

// Assign user to admin
router.post('/users/:userId/assign-admin', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { adminId } = z.object({ adminId: z.string() }).parse(req.body)

  // Check if current user can manage this
  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canManageUsers) {
    res.status(403).json({ error: 'No permission to manage users' })
    return
  }

  // Verify admin exists
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
  const adminId = req.params.adminId

  // Check if requester can view this
  const currentAdmin = await prisma.adminHierarchy.findUnique({
    where: { adminId: req.userId! },
  })
  if (!currentAdmin?.canManageUsers) {
    res.status(403).json({ error: 'No permission' })
    return
  }

  const users = await prisma.userAdminAssignment.findMany({
    where: { adminId },
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

// ============================================================================
// BANK ACCOUNT MANAGEMENT
// ============================================================================

// Admin adds bank account for user
router.post('/users/:userId/bank-accounts', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    bankName: z.string().min(1).max(100),
    accountNumber: z.string().min(1).max(50),
    routingNumber: z.string().max(20).optional(),
    accountHolder: z.string().min(1).max(100),
    accountType: z.enum(['checking', 'savings']).default('checking'),
    country: z.string().max(2).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  // Check permissions
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
        ...parsed.data,
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
  const userId = req.params.userId

  // Check if admin can view this user
  const assignment = await prisma.userAdminAssignment.findFirst({
    where: { userId, adminId: req.userId! },
  })
  if (!assignment) {
    res.status(403).json({ error: 'User not assigned to you' })
    return
  }

  const accounts = await prisma.adminBankAccount.findMany({
    where: { userId },
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
  }).partial()

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

// ============================================================================
// WALLET DETAIL MANAGEMENT
// ============================================================================

// Admin adds wallet details for user
router.post('/users/:userId/wallet-details', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    chainId: z.string().optional(),
    walletType: z.string().default('ethereum'),
    label: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
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
        ...parsed.data,
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
  const userId = req.params.userId

  const assignment = await prisma.userAdminAssignment.findFirst({
    where: { userId, adminId: req.userId! },
  })
  if (!assignment) {
    res.status(403).json({ error: 'User not assigned to you' })
    return
  }

  const details = await prisma.adminWalletDetail.findMany({
    where: { userId },
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
  }).partial()

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
