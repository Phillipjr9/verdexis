import { Router } from 'express'
import staff from './admin-staff-fixes.js'
import invites from './admin-invites.js'
import hierarchy from './admin-hierarchy.js'
import overrides from './adminOverrides.js'
import subadmins from './adminSubadmins.js'
import signupBonus from './admin-signup-bonus.js'
import otpAnalytics from './admin-otp-analytics.js'
import settingsVerification from './admin-settings-verification.js'
import adminFeatures from './admin-features.js'
import admin from './admin.js'

const router = Router()

// Specific admin extension routers first so their dedicated endpoints take precedence
router.use(staff)
router.use(invites)
router.use(hierarchy)
router.use(overrides)
router.use(subadmins)
router.use(signupBonus)
router.use(otpAnalytics)
router.use(settingsVerification)
router.use(adminFeatures)
router.use(admin)

export default router
