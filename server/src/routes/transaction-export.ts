import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

const exportSchema = z.object({
  format: z.enum(['csv', 'pdf', 'json']).default('csv'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

function generateCSV(transactions: any[]): string {
  const headers = ['Date', 'Type', 'Currency', 'Amount', 'Status', 'Reference']
  const rows = transactions.map((t) => [
    new Date(t.createdAt).toISOString(),
    t.kind,
    t.currency,
    t.amount,
    t.status,
    t.reference || '',
  ])

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
  return csv
}

function generateJSON(transactions: any[]): string {
  return JSON.stringify(
    transactions.map((t) => ({
      date: t.createdAt,
      type: t.kind,
      currency: t.currency,
      amount: t.amount,
      status: t.status,
      reference: t.reference,
    })),
    null,
    2
  )
}

router.post('/export', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = exportSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { format, startDate, endDate } = parsed.data

    // Create export record
    const exportRecord = await prisma.transactionExport.create({
      data: {
        userId: req.userId!,
        format,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId!,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    let content = ''
    let filename = `transactions_${new Date().toISOString().split('T')[0]}`

    if (format === 'csv') {
      content = generateCSV(transactions)
      filename += '.csv'
    } else if (format === 'json') {
      content = generateJSON(transactions)
      filename += '.json'
    } else if (format === 'pdf') {
      // In production, use a library like pdfkit or puppeteer
      content = generateJSON(transactions)
      filename += '.pdf'
    }

    // In production, upload to S3 or similar
    // For now, return the content directly
    const fileUrl = `data:text/${format === 'json' ? 'plain' : format};base64,${Buffer.from(content).toString('base64')}`

    // Update export record
    const updated = await prisma.transactionExport.update({
      where: { id: exportRecord.id },
      data: {
        status: 'completed',
        fileUrl,
      },
    })

    res.json({
      export: updated,
      filename,
      downloadUrl: fileUrl,
    })
  } catch (error) {
    console.error('Export error:', error)
    res.status(500).json({ error: 'Failed to generate export' })
  }
})

router.get('/exports', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const exports = await prisma.transactionExport.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json({ exports })
  } catch (error) {
    console.error('Exports list error:', error)
    res.status(500).json({ error: 'Failed to fetch exports' })
  }
})

router.get('/exports/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const exportRecord = await prisma.transactionExport.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!exportRecord) {
      res.status(404).json({ error: 'Export not found' })
      return
    }

    if (exportRecord.expiresAt < new Date()) {
      res.status(410).json({ error: 'Export has expired' })
      return
    }

    // Increment download count
    await prisma.transactionExport.update({
      where: { id: req.params.id },
      data: { downloadCount: exportRecord.downloadCount + 1 },
    })

    res.json({ export: exportRecord })
  } catch (error) {
    console.error('Export fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch export' })
  }
})

router.delete('/exports/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const exportRecord = await prisma.transactionExport.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!exportRecord) {
      res.status(404).json({ error: 'Export not found' })
      return
    }

    await prisma.transactionExport.delete({
      where: { id: req.params.id },
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Export delete error:', error)
    res.status(500).json({ error: 'Failed to delete export' })
  }
})

// Tax reporting endpoint
router.get('/tax-report', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId!,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    })

    const trades = await prisma.trade.findMany({
      where: {
        userId: req.userId!,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    })

    const summary = {
      year,
      totalBuys: 0,
      totalSells: 0,
      totalGainLoss: 0,
      byAsset: {} as Record<string, any>,
    }

    trades.forEach((t) => {
      if (t.side === 'buy') {
        summary.totalBuys += t.total
      } else {
        summary.totalSells += t.total
      }

      if (!summary.byAsset[t.symbol]) {
        summary.byAsset[t.symbol] = {
          buys: 0,
          sells: 0,
          gainLoss: 0,
        }
      }

      if (t.side === 'buy') {
        summary.byAsset[t.symbol].buys += t.total
      } else {
        summary.byAsset[t.symbol].sells += t.total
      }
    })

    res.json({
      taxReport: summary,
      transactions,
      trades,
    })
  } catch (error) {
    console.error('Tax report error:', error)
    res.status(500).json({ error: 'Failed to generate tax report' })
  }
})

export default router
