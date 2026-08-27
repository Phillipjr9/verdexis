/**
 * Compatibility aliases for admin UI paths that historically pointed at
 * non-existent or differently-mounted endpoints. Keeps the admin console
 * working without 404s.
 */
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

/** GET /api/admin/wallets — wallet links / verifications for review */
router.get('/wallets', async (_req: AuthedRequest, res) => {
  try {
    const links = await prisma.walletLink.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        verification: true,
      },
      orderBy: { linkedAt: 'desc' },
      take: 200,
    })
    res.json({
      wallets: links.map((l) => ({
        id: l.id,
        userId: l.userId,
        userEmail: l.user?.email,
        walletAddress: l.address,
        chainId: l.chainId,
        verifiedAt: l.verification?.verifiedAt ?? null,
        createdAt: l.linkedAt,
        isPrimary: l.isPrimary,
      })),
    })
  } catch (e) {
    console.error('[admin-compat] wallets', e)
    res.status(500).json({ error: 'Failed to load wallets' })
  }
})

/** GET /api/admin/transaction-export — export history */
router.get('/transaction-export', async (_req: AuthedRequest, res) => {
  try {
    const exports = await prisma.transactionExport.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({ exports })
  } catch (e) {
    console.error('[admin-compat] transaction-export', e)
    res.status(500).json({ error: 'Failed to load exports' })
  }
})

/** GET /api/admin/security/events — security event feed */
router.get('/security/events', async (req: AuthedRequest, res) => {
  try {
    const days = parseInt(String(req.query.days || '7'), 10) || 7
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const events = await prisma.securityEvent.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    res.json({
      events: events.map((event) => ({
        ...event,
        metadata: event.metadata ? JSON.parse(event.metadata as string) : null,
      })),
    })
  } catch (e) {
    console.error('[admin-compat] security/events', e)
    res.json({ events: [] })
  }
})

export default router
