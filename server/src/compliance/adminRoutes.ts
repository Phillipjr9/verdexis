import express from 'express'

function checkAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.header('x-admin-secret')
  const NODE_ENV = process.env.NODE_ENV
  const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET

  if (NODE_ENV === 'production') {
    if (!ADMIN_API_SECRET || secret !== ADMIN_API_SECRET) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    return next()
  }

  // Non-production: allow if secret matches ADMIN_API_SECRET or if ADMIN_API_SECRET not set
  if (NODE_ENV !== 'production' && ADMIN_API_SECRET && secret && secret === ADMIN_API_SECRET) {
    return next()
  }
  if (NODE_ENV !== 'production' && !ADMIN_API_SECRET) return next()
  next()
}

export function registerComplianceAdminRoutes(app: express.Router): void {
  app.get('/api/admin/compliance/findings', checkAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '20'), 10)))
      const sort = String(req.query.sort || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
      const suspectFilter = req.query.suspect ? String(req.query.suspect).toLowerCase() : undefined

      const { prisma } = await import('../db.js')

      const where: any = {}
      if (suspectFilter !== undefined) {
        where.suspect = suspectFilter === 'true' || suspectFilter === '1'
      }

      const total = await prisma.complianceFinding.count({ where })

      const rows = await prisma.complianceFinding.findMany({
        where,
        orderBy: { createdAt: sort },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })

      res.json({ page, pageSize, total, findings: rows })
    } catch (err) {
      console.error('[admin/compliance] list failed:', err)
      res.status(500).json({ error: 'list failed' })
    }
  })

  app.get('/api/admin/compliance/findings/:txId', checkAdmin, async (req, res) => {
    const { txId } = req.params
    const { prisma } = await import('../db.js')
    const finding = await prisma.complianceFinding.findUnique({ where: { txId } })
    if (!finding) {
      res.status(404).json({ error: 'not found' })
      return
    }
    res.json(finding)
  })

  app.post('/api/admin/compliance/findings/:txId/action', checkAdmin, express.json(), async (req, res) => {
    const { txId } = req.params
    const { action, note } = req.body
    const { prisma } = await import('../db.js')
    const finding = await prisma.complianceFinding.findUnique({ where: { txId } })
    if (!finding) {
      res.status(404).json({ error: 'not found' })
      return
    }

    if (action === 'mark_reviewed') {
      await prisma.complianceFinding.update({
        where: { txId },
        data: {
          reviewed: true,
          reviewedAt: new Date(),
          reviewNote: note || null,
        },
      })
      res.json({ status: 'ok', action: 'marked_reviewed' })
      return
    }

    if (action === 'suspend_user') {
      if (!finding.userId) {
        res.status(400).json({ error: 'no userId in finding' })
        return
      }
      await prisma.user.update({ where: { id: finding.userId }, data: { suspended: true, suspendedReason: note || 'suspended by compliance' } })
      await prisma.complianceFinding.update({
        where: { txId },
        data: {
          actioned: 'suspend_user',
          actionedAt: new Date(),
          actionNote: note || null,
        },
      })
      res.json({ status: 'ok', action: 'suspended_user' })
      return
    }

    res.status(400).json({ error: 'unknown action' })
  })
}
