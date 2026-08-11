import express from 'express'

export function registerComplianceRoutes(app: express.Router): void {
  app.post('/api/compliance/tx', express.json(), async (req, res) => {
    try {
      const { txId, userId, from, to, amount, currency, metadata } = req.body
      if (!txId || !from || !to || !amount || !currency) {
        res.status(400).json({ error: 'missing required fields' })
        return
      }

      const { enqueueComplianceCheck } = await import('./producer.js')
      await enqueueComplianceCheck({ txId, userId, from, to, amount, currency, metadata })

      res.status(202).json({ status: 'queued', txId })
    } catch (err) {
      console.error('[compliance] enqueue failed:', err)
      res.status(500).json({ error: 'enqueue failed' })
    }
  })
}
