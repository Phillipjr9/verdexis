import { Router } from 'express'
import staff from './admin-staff-fixes.js'
import invites from './admin-invites.js'
import admin from './admin.js'

const router = Router()
// Staff + invites first so they take precedence over the main admin router
router.use(staff)
router.use(invites)
router.use(admin)
export default router
