import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { pushNotificationService } from '../services/pushNotificationService.js'

const router = Router()

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const prefs = await pushNotificationService.getUserPreferences(req.userId!)
    res.json({ preferences: prefs })
  } catch (error) {
    console.error('[notifications] preferences error:', error)
    res.status(500).json({ error: 'Failed to get preferences' })
  }
})

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const prefs = req.body
    await pushNotificationService.updateUserPreferences(req.userId!, prefs)
    res.json({ ok: true })
  } catch (error) {
    console.error('[notifications] update preferences error:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

/**
 * POST /api/notifications/mark-read/:id
 * Mark notification as read
 */
router.post('/mark-read/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await pushNotificationService.markAsRead(req.params.id)
    res.json({ ok: true })
  } catch (error) {
    console.error('[notifications] mark-read error:', error)
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/mark-all-read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await pushNotificationService.markAllAsRead(req.userId!)
    res.json({ ok: true })
  } catch (error) {
    console.error('[notifications] mark-all-read error:', error)
    res.status(500).json({ error: 'Failed to mark all as read' })
  }
})

export default router
