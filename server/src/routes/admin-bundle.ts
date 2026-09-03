import { Router } from 'express'
import staff from './admin-staff-fixes.js'
import admin from './admin.js'

const router = Router()
// Staff handlers first so /stats, /deposits/pending, /seed-treasury, /users/:id/role win
router.use(staff)
router.use(admin)
export default router
