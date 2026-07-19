import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import {
  getUserNotificationPreferences,
  updateNotificationPreferences,
  markNotificationAsRead,
  deleteNotification,
} from '../notificationService.js'

const router = Router()

const preferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  transactionAlerts: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
})

// Get notification preferences
router.get('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const preferences = await getUserNotificationPreferences(req.userId!)
    res.json({ preferences })
  } catch (error) {
    console.error('Get preferences error:', error)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

// Update notification preferences
router.put('/preferences', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = preferencesSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const preferences = await updateNotificationPreferences(req.userId!, parsed.data)
    res.json({ preferences })
  } catch (error) {
    console.error('Update preferences error:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// Get notification history
router.get('/history', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const kind = req.query.kind as string | undefined

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.userId!,
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.userId!,
        read: false,
      },
    })

    res.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Get history error:', error)
    res.status(500).json({ error: 'Failed to fetch notification history' })
  }
})

// Get unread notifications
router.get('/unread', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.userId!,
        read: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    res.json({ notifications, count: notifications.length })
  } catch (error) {
    console.error('Get unread error:', error)
    res.status(500).json({ error: 'Failed to fetch unread notifications' })
  }
})

// Mark notification as read
router.put('/:id/read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' })
      return
    }

    await markNotificationAsRead(req.params.id || '')

    res.json({ ok: true })
  } catch (error) {
    console.error('Mark as read error:', error)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

// Mark all as read
router.put('/all/read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.userId!,
        read: false,
      },
      data: { read: true },
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Mark all as read error:', error)
    res.status(500).json({ error: 'Failed to mark all as read' })
  }
})

// Delete notification
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' })
      return
    }

    await deleteNotification(req.params.id || '')

    res.json({ ok: true })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({ error: 'Failed to delete notification' })
  }
})

// Delete all notifications
router.delete('/all', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.userId! },
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Delete all error:', error)
    res.status(500).json({ error: 'Failed to delete all notifications' })
  }
})

// Get notification statistics
router.get('/stats', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [total, unread, byKind] = await Promise.all([
      prisma.notification.count({ where: { userId: req.userId! } }),
      prisma.notification.count({ where: { userId: req.userId!, read: false } }),
      prisma.notification.groupBy({
        by: ['kind'],
        where: { userId: req.userId! },
        _count: true,
      }),
    ])

    const kindStats: Record<string, number> = {}
    byKind.forEach((item) => {
      kindStats[item.kind] = item._count
    })

    res.json({
      total,
      unread,
      byKind: kindStats,
    })
  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

export default router
