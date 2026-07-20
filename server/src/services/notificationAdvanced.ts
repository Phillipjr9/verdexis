import { prisma } from '../db.js'

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface NotificationPreference {
  userId: string
  channel: NotificationChannel
  enabled: boolean
  quietHours?: { start: string; end: string }
  frequency?: 'immediate' | 'daily' | 'weekly'
}

export interface NotificationTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
  channels: NotificationChannel[]
}

export class NotificationService {
  /**
   * Send notification
   */
  static async sendNotification(
    userId: string,
    title: string,
    body: string,
    channels: NotificationChannel[] = ['in_app'],
    priority: NotificationPriority = 'normal',
    data?: Record<string, unknown>,
  ): Promise<{ id: string; channels: NotificationChannel[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, prefs: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Get user preferences
    const preferences = await this.getUserPreferences(userId)

    // Filter channels based on preferences
    const enabledChannels = channels.filter(channel => {
      const pref = preferences.find(p => p.channel === channel)
      return pref?.enabled !== false
    })

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        kind: 'system',
        title,
        body,
      },
    })

    // Send via enabled channels
    for (const channel of enabledChannels) {
      this.sendViaChannel(userId, channel, title, body, priority).catch(err => {
        console.error(`[notification] Failed to send via ${channel}:`, err)
      })
    }

    return { id: notification.id, channels: enabledChannels }
  }

  /**
   * Send via specific channel
   */
  private static async sendViaChannel(
    userId: string,
    channel: NotificationChannel,
    title: string,
    body: string,
    priority: NotificationPriority,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, prefs: true },
    })

    if (!user) return

    let prefs: Record<string, unknown> = {}
    try {
      if (user.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    switch (channel) {
      case 'email':
        await this.sendEmail(user.email, title, body, priority)
        break
      case 'sms':
        const phone = (prefs as { phone?: string }).phone
        if (phone) {
          await this.sendSMS(phone, title, body, priority)
        }
        break
      case 'push':
        await this.sendPushNotification(userId, title, body, priority)
        break
      case 'in_app':
        // Already created in sendNotification
        break
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmail(email: string, title: string, body: string, priority: NotificationPriority): Promise<void> {
    // Placeholder - integrate with email service
    console.log(`[notification] Email to ${email}: ${title}`)
  }

  /**
   * Send SMS notification
   */
  private static async sendSMS(phone: string, title: string, body: string, priority: NotificationPriority): Promise<void> {
    // Placeholder - integrate with SMS service (Twilio, etc.)
    console.log(`[notification] SMS to ${phone}: ${title}`)
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    priority: NotificationPriority,
  ): Promise<void> {
    // Placeholder - integrate with push service (Firebase, etc.)
    console.log(`[notification] Push to ${userId}: ${title}`)
  }

  /**
   * Get user notification preferences
   */
  static async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    if (!user?.prefs) {
      return this.getDefaultPreferences(userId)
    }

    let prefs: Record<string, unknown> = {}
    try {
      prefs = JSON.parse(user.prefs)
    } catch {
      return this.getDefaultPreferences(userId)
    }

    const notificationPrefs = (prefs as { notificationPreferences?: NotificationPreference[] }).notificationPreferences

    if (!notificationPrefs) {
      return this.getDefaultPreferences(userId)
    }

    return notificationPrefs
  }

  /**
   * Get default preferences
   */
  private static getDefaultPreferences(userId: string): NotificationPreference[] {
    return [
      { userId, channel: 'in_app', enabled: true },
      { userId, channel: 'email', enabled: true, frequency: 'immediate' },
      { userId, channel: 'sms', enabled: false },
      { userId, channel: 'push', enabled: true },
    ]
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(userId: string, preferences: Partial<NotificationPreference>[]): Promise<NotificationPreference[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    })

    let prefs: Record<string, unknown> = {}
    try {
      if (user?.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }

    const currentPrefs = await this.getUserPreferences(userId)
    const updated = currentPrefs.map(pref => {
      const update = preferences.find(p => p.channel === pref.channel)
      return update ? { ...pref, ...update } : pref
    })

    prefs.notificationPreferences = updated

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    return updated
  }

  /**
   * Get notification history
   */
  static async getNotificationHistory(userId: string, limit: number = 50): Promise<any[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })

    return result.count
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    await prisma.notification.delete({
      where: { id: notificationId },
    })
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    })
  }

  /**
   * Send digest email
   */
  static async sendDigestEmail(userId: string): Promise<void> {
    const notifications = await prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    if (notifications.length === 0) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    if (!user) return

    // Placeholder - integrate with email service
    console.log(`[notification] Digest email to ${user.email} with ${notifications.length} notifications`)
  }
}

export const notificationService = new NotificationService()
