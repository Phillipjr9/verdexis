import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { isSuperAdmin } from '../lib/adminHierarchy.js'
import { idempotency } from '../idempotency.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { rbacPayload } from '../rbac.js'

/**
 * Staff-scope + role fixes mounted BEFORE the main admin router so these
 * handlers win for the same paths (stats, deposits queue, seed, role).
 */
const router = Router()

const ADMIN_TREASURY_USD = 1_000_000_000_000

async function assignedUserIds(adminId: string): Promise<string[]> {
  const rows = await prisma.userAdminAssignment.findMany({
    where: { adminId },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

async function audit(actorId: string, action: string, targetUserId: string | null, payload?: unknown) {
  try {
    await prisma.adminAudit.create({
      data: {
        actorId,
        action,
        targetUserId: targetUserId ?? undefined,
        payload: payload != null ? JSON.stringify(payload).slice(0, 4000) : undefined,
      },
    })
  } catch (e) {
    console.warn('[admin-staff] audit failed', e)
  }
}

// --- RBAC ---------------------------------------------------------------
router.get('/rbac', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const superAdmin = await isSuperAdmin(req.userId!)
  res.json({
    ...rbacPayload(req.userRole),
    isSuperAdmin: superAdmin,
    role: req.userRole,
  })
})

// --- Scoped stats (overrides global /stats for sub-admins) --------------
router.get('/stats', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const superAdmin = await isSuperAdmin(req.userId!)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  if (superAdmin) {
    const [users, admins, suspended, holdings, trades, alerts, deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits, lastBroadcast] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: { in: ['admin', 'subadmin'] } } }),
        prisma.user.count({ where: { suspended: true } }),
        prisma.holding.count(),
        prisma.trade.count(),
        prisma.priceAlert.count({ where: { active: true } }),
        prisma.transaction.count({ where: { kind: 'deposit', createdAt: { gte: since } } }),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.user.count({ where: { holdActive: true } }),
        prisma.user.count({ where: { kycStatus: 'pending' } }),
        prisma.transaction.count({ where: { kind: 'withdraw', createdAt: { gte: since } } }),
        prisma.transaction.count({ where: { kind: 'deposit', status: 'pending' } }),
        prisma.adminAudit.findFirst({
          where: { action: 'notification.broadcast' },
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { email: true } } },
        }),
      ])
    const recentSignups = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, email: true, name: true, createdAt: true, role: true, suspended: true },
    })
    res.json({
      stats: {
        users, admins, suspended, holdings, trades, alerts,
        deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits,
      },
      lastBroadcast: lastBroadcast
        ? { at: lastBroadcast.createdAt, by: lastBroadcast.actor?.email ?? null, payload: lastBroadcast.payload }
        : null,
      recentSignups,
      scope: 'platform',
    })
    return
  }

  const ids = await assignedUserIds(req.userId!)
  if (ids.length === 0) {
    res.json({
      stats: {
        users: 0, admins: 0, suspended: 0, holdings: 0, trades: 0, alerts: 0,
        deposits24h: 0, signups24h: 0, holds: 0, kycPending: 0, withdraws24h: 0, pendingDeposits: 0,
      },
      recentSignups: [],
      lastBroadcast: null,
      scope: 'assigned',
    })
    return
  }

  const idFilter = { id: { in: ids } }
  const userIdFilter = { userId: { in: ids } }
  const [users, suspended, holdings, trades, alerts, deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits] =
    await Promise.all([
      prisma.user.count({ where: idFilter }),
      prisma.user.count({ where: { ...idFilter, suspended: true } }),
      prisma.holding.count({ where: userIdFilter }),
      prisma.trade.count({ where: userIdFilter }),
      prisma.priceAlert.count({ where: { ...userIdFilter, active: true } }),
      prisma.transaction.count({ where: { ...userIdFilter, kind: 'deposit', createdAt: { gte: since } } }),
      prisma.user.count({ where: { ...idFilter, createdAt: { gte: since } } }),
      prisma.user.count({ where: { ...idFilter, holdActive: true } }),
      prisma.user.count({ where: { ...idFilter, kycStatus: 'pending' } }),
      prisma.transaction.count({ where: { ...userIdFilter, kind: 'withdraw', createdAt: { gte: since } } }),
      prisma.transaction.count({ where: { ...userIdFilter, kind: 'deposit', status: 'pending' } }),
    ])
  const recentSignups = await prisma.user.findMany({
    where: idFilter,
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, email: true, name: true, createdAt: true, role: true, suspended: true },
  })
  res.json({
    stats: {
      users, admins: 0, suspended, holdings, trades, alerts,
      deposits24h, signups24h, holds, kycPending, withdraws24h, pendingDeposits,
    },
    recentSignups,
    lastBroadcast: null,
    scope: 'assigned',
  })
})

// --- Scoped pending funding requests ------------------------------------
router.get('/deposits/pending', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const superAdmin = await isSuperAdmin(req.userId!)
  const where: Record<string, unknown> = { kind: 'deposit', status: 'pending' }
  if (!superAdmin) {
    const ids = await assignedUserIds(req.userId!)
    if (ids.length === 0) {
      res.json({ deposits: [] })
      return
    }
    where.userId = { in: ids }
  }
  const items = await prisma.transaction.findMany({
    where: where as never,
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true, kycStatus: true, suspended: true } } },
  })
  res.json({ deposits: items })
})

router.get('/pending-deposits', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const superAdmin = await isSuperAdmin(req.userId!)
  const where: Record<string, unknown> = { status: 'pending' }
  if (!superAdmin) {
    const ids = await assignedUserIds(req.userId!)
    if (ids.length === 0) {
      res.json({ deposits: [] })
      return
    }
    where.userId = { in: ids }
  }
  try {
    const items = await prisma.pendingDeposit.findMany({
      where: where as never,
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: { id: true, email: true, name: true } } },
    })
    res.json({ deposits: items })
  } catch (e) {
    console.warn('[admin-staff] pending-deposits', e)
    res.json({ deposits: [] })
  }
})

// --- Role switch: user ↔ subadmin (was missing — UI called dead endpoint) ---
const roleSchema = z.object({
  role: z.enum(['user', 'subadmin', 'admin']),
})

router.post('/users/:id/role', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const targetId = req.params.id ?? ''
  const parsed = roleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role. Use user, subadmin, or admin.' })
    return
  }

  const superAdmin = await isSuperAdmin(req.userId!)
  if (!superAdmin) {
    res.status(403).json({ error: 'Only the super-admin can change staff roles' })
    return
  }

  if (targetId === req.userId) {
    res.status(400).json({ error: 'Cannot change your own role here' })
    return
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true, name: true },
  })
  if (!target) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  let nextRole = parsed.data.role
  // Never create a second full admin via this endpoint — force subadmin
  if (nextRole === 'admin') nextRole = 'subadmin'

  const superEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@verdexisgroup.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (superEmails.includes(target.email.toLowerCase()) && nextRole !== 'admin') {
    res.status(400).json({ error: 'Cannot demote the canonical super-admin account' })
    return
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role: nextRole },
    select: { id: true, email: true, name: true, role: true },
  })

  await audit(req.userId!, 'user.role', targetId, { from: target.role, to: nextRole })

  res.json({
    ok: true,
    user: updated,
    message: nextRole === 'subadmin' ? 'User is now a sub-admin' : 'User role set to user',
  })
})

// --- Seed treasury: super-admin only ------------------------------------
router.post('/seed-treasury', requireAuth, requireAdmin, idempotency(), async (req: AuthedRequest, res) => {
  const adminId = req.userId ?? ''
  if (!(await isSuperAdmin(adminId))) {
    res.status(403).json({ error: 'Only the super-admin can seed the platform treasury' })
    return
  }

  const existing = await prisma.walletBalance.findFirst({ where: { userId: adminId, currency: 'USD' } })
  if (existing && existing.balance >= ADMIN_TREASURY_USD) {
    res.json({
      ok: true,
      message: 'Treasury already seeded',
      balance: existing.balance,
      currentBalance: existing.balance,
      alreadySeeded: true,
    })
    return
  }

  const CHUNK_SIZE = 10_000_000_000
  const chunks = Math.ceil(ADMIN_TREASURY_USD / CHUNK_SIZE)
  const ledgerResult = await prisma.$transaction(async (tx) => {
    let lastResult: Awaited<ReturnType<typeof recordLedgerTransaction>> | null = null
    for (let i = 0; i < chunks; i++) {
      const remaining = ADMIN_TREASURY_USD - i * CHUNK_SIZE
      const amountThis = Math.min(CHUNK_SIZE, remaining)
      lastResult = await recordLedgerTransaction({
        tx,
        userId: adminId,
        asset: 'USD',
        amount: amountThis,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'treasury_seed',
        sourceType: 'admin_treasury_seed',
        sourceId: `admin_treasury_seed:${adminId}:${i}`,
        externalRef: `admin_treasury_seed:${adminId}:${i}`,
        idempotencyKey: `admin_treasury_seed:${adminId}:${i}`,
        description: `Admin treasury seed (chunk ${i + 1}/${chunks})`,
        reference: 'Admin treasury seed',
        subType: 'treasury_seed',
        recordTransaction: i === chunks - 1,
        createdBy: adminId,
      })
    }
    return lastResult
  })

  await audit(adminId, 'wallet.treasury.seed', adminId, { amount: ADMIN_TREASURY_USD })
  const balance = ledgerResult?.walletBalance?.balance ?? existing?.balance ?? ADMIN_TREASURY_USD
  res.json({
    ok: true,
    message: 'Admin treasury seeded successfully',
    balance,
    available: ledgerResult?.walletBalance?.available ?? balance,
  })
})

export default router
