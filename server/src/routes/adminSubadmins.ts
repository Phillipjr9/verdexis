import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { sendEmailNotification } from '../notificationService.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { rbacPayload } from '../rbac.js'
import { isSuperAdmin } from '../lib/adminHierarchy.js'

const router = Router()
const STORE_KEY = 'fee_proofs_v1'
const TREASURY_USD = 10_000_000

router.get('/rbac', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  res.json({ ...rbacPayload(req.userRole), isSuperAdmin: await isSuperAdmin(req.userId!) })
})

router.get('/stats/scoped', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const superAdmin = await isSuperAdmin(req.userId!)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  if (superAdmin) {
    const [users, admins, suspended, holdings, trades, deposits24h, signups24h] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { in: ['admin', 'subadmin'] } } }),
      prisma.user.count({ where: { suspended: true } }),
      prisma.holding.count(),
      prisma.trade.count(),
      prisma.transaction.count({ where: { kind: 'deposit', createdAt: { gte: since } } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
    ])
    res.json({
      stats: {
        users, admins, suspended, holdings, trades, alerts: 0,
        deposits24h, signups24h, holds: 0, kycPending: 0, withdraws24h: 0, pendingDeposits: 0,
      },
      scope: 'platform',
    })
    return
  }
  const assignments = await prisma.userAdminAssignment.findMany({
    where: { adminId: req.userId! },
    select: { userId: true },
  })
  const ids = assignments.map((a) => a.userId)
  const users = ids.length
  const [suspended, signups24h] = ids.length
    ? await Promise.all([
      prisma.user.count({ where: { id: { in: ids }, suspended: true } }),
      prisma.user.count({ where: { id: { in: ids }, createdAt: { gte: since } } }),
    ])
    : [0, 0]
  res.json({
    stats: {
      users, admins: 0, suspended, holdings: 0, trades: 0, alerts: 0,
      deposits24h: 0, signups24h, holds: 0, kycPending: 0, withdraws24h: 0, pendingDeposits: 0,
    },
    scope: 'assigned',
  })
})

router.get('/fee-proofs', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } })
    let list: Array<{ status?: string }> = []
    if (row?.value) {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed)) list = parsed
    }
    const status = String(req.query.status || '').toLowerCase()
    const proofs = !status || status === 'all' ? list : list.filter((p) => p.status === status)
    res.json({ proofs })
  } catch (e) {
    console.error('[admin] fee-proofs list', e)
    res.status(500).json({ error: 'Failed to list fee proofs' })
  }
})

router.post('/treasury/seed', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  if (!(await isSuperAdmin(req.userId!))) {
    res.status(403).json({ error: 'Full admin only' })
    return
  }
  const adminId = req.userId!
  try {
    const existing = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId: adminId, currency: 'USD' } },
    })
    const current = Number(existing?.balance ?? 0)
    if (current >= TREASURY_USD) {
      res.json({
        ok: true,
        message: 'Treasury already seeded',
        balance: current,
        available: Number(existing?.available ?? current),
        currency: 'USD',
      })
      return
    }
    const add = TREASURY_USD - current
    const result = await prisma.$transaction(async (tx) => {
      return recordLedgerTransaction({
        tx,
        userId: adminId,
        asset: 'USD',
        amount: add,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'treasury_seed',
        sourceType: 'admin_treasury_seed',
        sourceId: `admin_treasury_seed_v2:${adminId}`,
        externalRef: `admin_treasury_seed_v2:${adminId}`,
        idempotencyKey: `admin_treasury_seed_v2:${adminId}`,
        description: 'Admin treasury seed',
        reference: 'Admin treasury seed',
        subType: 'treasury_seed',
        recordTransaction: true,
        createdBy: adminId,
      })
    })
    res.json({
      ok: true,
      message: 'Admin treasury seeded',
      balance: Number(result.walletBalance.balance),
      available: Number(result.walletBalance.available),
      currency: 'USD',
    })
  } catch (e) {
    console.error('[admin] treasury seed', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to seed treasury' })
  }
})

router.post('/users/:id/role', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  if (!(await isSuperAdmin(req.userId!))) {
    res.status(403).json({ error: 'Full admin only' })
    return
  }
  const role = String((req.body as { role?: string })?.role || '').toLowerCase()
  if (role !== 'subadmin' && role !== 'user') {
    res.status(400).json({ error: 'Role must be subadmin or user' })
    return
  }
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true, role: true, deletedAt: true },
  })
  if (!target || target.deletedAt) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (target.id === req.userId) {
    res.status(400).json({ error: 'Cannot change your own role here' })
    return
  }
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  })

  const promoted = role === 'subadmin'
  const subject = promoted
    ? 'You have been promoted to Verdexis sub-admin'
    : 'Your Verdexis sub-admin access was removed'
  const greeting = user.name ? `Hi ${user.name},` : 'Hello,'
  const body = promoted
    ? `${greeting}\n\nYour Verdexis account (${user.email}) is now a sub-admin.\n\nLog out and sign back in so the new role takes effect.\n\nVerdexis`
    : `${greeting}\n\nSub-admin access has been removed from ${user.email}.\n\nVerdexis`

  if (user.email) {
    void sendEmailNotification(user.email, subject, body, undefined, {
      userId: user.id,
      kind: 'system',
      title: subject,
      body,
    }).catch((e) => console.warn('[admin] subadmin email failed', e))
  }
  await prisma.notification.create({
    data: {
      userId: user.id,
      kind: 'system',
      title: subject,
      body: promoted
        ? 'You are now a sub-admin. Log out and sign back in, then open the admin console.'
        : 'Your sub-admin access was removed.',
    },
  }).catch(() => {})

  res.json({ user, rbac: rbacPayload(user.role) })
})

export default router
