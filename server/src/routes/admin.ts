/**
 * Admin routes — content restored at build time from scripts/admin_ts_b64.
 * Real implementation is written by scripts/restore-admin-ts.mjs before tsc.
 */
import { Router } from 'express'
import { requireAuth, requireAdmin } from '../auth.js'

const router = Router()
router.use(requireAuth)
router.use(requireAdmin)

router.get('/_admin_stub_health', (_req, res) => {
  res.status(503).json({
    error: 'admin.ts not restored — run: node server/scripts/restore-admin-ts.mjs',
  })
})

export default router
