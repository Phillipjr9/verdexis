import { Router } from 'express'

const router = Router()

// OAuth routes placeholder - not implemented yet
router.get('/status', (req, res) => {
  res.json({ configured: false })
})

export default router
