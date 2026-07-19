import { prisma } from '../db.js'
import { emailService } from './email.js'

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, string>
  actions?: Array<{ action: string; title: string }>
}

export interface NotificationPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  priceAlerts: boolean
  portfolioAlerts: boolean
  transactionAlerts: boolean
  marketNews: boolean
  weeklyDigest: boolean
  dailyDigest: boolean
}

/**
 * Push Notifications Service
 * Manages real-time notifications, email digests, and user preferences
 */
export class PushNotificationService {
  /**
   * Send push notification to user
   */
  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload,
    kind: string = 'general'
  ): Promise<void> {
    try {
      // Store notification in database
      await prisma.notification.create({
        data: {
          userId,
          kind,
          title: payload.title,
          body: payload.body,
          read: false
        }
      })

      // Get user preferences
      const prefs = await this.getUserPreferences(userId)

      // Send email if enabled
      if (prefs.emailNotifications && kind !== 'general') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true }
        })

        if (user) {
          await emailService.send({
            to: user.email,
            subject: payload.title,
            html: payload.body,
            text: payload.body,
            userId,
            kind,
            title: payload.title,
            createWebNotification: true,
          }).catch(err => {
            console.error('[push-notifications] Failed to send email:', err)
          })
        }
      }

      // In production, would send to:
      // - Firebase Cloud Messaging (FCM)
      // - Apple Push Notification service (APNs)
      // - Web Push API
      // - WebSocket for real-time delivery
    } catch (error) {
      console.error('[push-notifications] Failed to send notification:', error)
    }
  }

  /**
   * Send price alert notification
   */
  async sendPriceAlert(
    userId: string,
    symbol: string,
    currentPrice: number,
    targetPrice: number,
    direction: 'above' | 'below'
  ): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    if (!prefs.priceAlerts) return

    const directionText = direction === 'above' ? 'above' : 'below'
    await this.sendPushNotification(userId, {
      title: `${symbol} Alert`,
      body: `${symbol} is now ${directionText} $${targetPrice.toFixed(2)} (current: $${currentPrice.toFixed(2)})`,
      tag: `price-alert-${symbol}`,
      data: {
        type: 'price_alert',
        symbol,
        currentPrice: currentPrice.toString(),
        targetPrice: targetPrice.toString()
      }
    }, 'price_alert')
  }

  /**
   * Send portfolio alert
   */
  async sendPortfolioAlert(
    userId: string,
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'critical' = 'info'
  ): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    if (!prefs.portfolioAlerts) return

    await this.sendPushNotification(userId, {
      title,
      body: message,
      tag: `portfolio-alert-${Date.now()}`,
      data: {
        type: 'portfolio_alert',
        severity
      }
    }, 'portfolio_alert')
  }

  /**
   * Send transaction alert
   */
  async sendTransactionAlert(
    userId: string,
    type: 'deposit' | 'withdrawal' | 'trade',
    amount: number,
    currency: string,
    status: 'pending' | 'completed' | 'failed'
  ): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    if (!prefs.transactionAlerts) return

    const typeText = type.charAt(0).toUpperCase() + type.slice(1)
    const statusText = status === 'completed' ? 'completed' : status === 'pending' ? 'pending' : 'failed'

    await this.sendPushNotification(userId, {
      title: `${typeText} ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
      body: `${typeText} of ${amount.toFixed(2)} ${currency} has ${statusText}`,
      tag: `transaction-${type}-${Date.now()}`,
      data: {
        type: `transaction_${type}`,
        amount: amount.toString(),
        currency,
        status
      }
    }, 'transaction_alert')
  }

  /**
   * Send market news notification
   */
  async sendMarketNews(
    userId: string,
    headline: string,
    summary: string,
    source: string
  ): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    if (!prefs.marketNews) return

    await this.sendPushNotification(userId, {
      title: 'Market News',
      body: headline,
      tag: `market-news-${Date.now()}`,
      data: {
        type: 'market_news',
        source,
        summary
      }
    }, 'market_news')
  }

  /**
   * Send daily digest
   */
  async sendDailyDigest(userId: string): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    if (!prefs.dailyDigest) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    })

    if (!user) return

    // Get portfolio summary
    const portfolio = await prisma.investmentPortfolio.findUnique({
      where: { userId }
    })

    // Get today's transactions
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todaysTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: today }
      }
    })

    // Get price alerts triggered today
    const triggeredAlerts = await prisma.priceAlert.findMany({
      where: {
        userId,
        triggered: true,
        triggeredAt: { gte: today }
      }
    })

    const digestContent = `
      <h2>Daily Portfolio Digest</h2>
      <p>Portfolio Value: $${portfolio?.currentValue.toFixed(2) ?? '0.00'}</p>
      <p>Today's Gain/Loss: $${portfolio?.totalGainLoss.toFixed(2) ?? '0.00'}</p>
      <p>Transactions Today: ${todaysTransactions.length}</p>
      <p>Price Alerts Triggered: ${triggeredAlerts.length}</p>
    `

    await emailService.send({
      to: user.email,
      subject: 'Daily Portfolio Digest',
      html: digestContent,
      text: 'Your daily portfolio digest',
      userId,
      kind: 'daily_digest',
      title: 'Daily Portfolio Digest',
      createWebNotification: false,
    }).catch(err => {
      console.error('[push-notifications] Failed to send daily digest:', err)
    })
  }

  /**
   * Send weekly digest
   */
  async sendWeeklyDigest(userId: string): Promise<void> {
    const prefs = await this.getUserPreferences(userId)
    if (!prefs.weeklyDigest) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    })

    if (!user) return

    // Get portfolio summary
    const portfolio = await prisma.investmentPortfolio.findUnique({
      where: { userId }
    })

    // Get week's transactions
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: weekAgo }
      }
    })

    // Get top performers
    const holdings = await prisma.holding.findMany({
      where: { userId },
      orderBy: { amount: 'desc' },
      take: 5
    })

    const digestContent = `
      <h2>Weekly Portfolio Digest</h2>
      <p>Portfolio Value: $${portfolio?.currentValue.toFixed(2) ?? '0.00'}</p>
      <p>Weekly Gain/Loss: $${portfolio?.totalGainLoss.toFixed(2) ?? '0.00'}</p>
      <p>Weekly Return: ${portfolio?.totalGainLossPercent.toFixed(2) ?? '0.00'}%</p>
      <p>Transactions This Week: ${weekTransactions.length}</p>
      <h3>Top Holdings</h3>
      <ul>
        ${holdings.map(h => `<li>${h.symbol}: ${h.amount.toFixed(2)} units</li>`).join('')}
      </ul>
    `

    await emailService.send({
      to: user.email,
      subject: 'Weekly Portfolio Digest',
      html: digestContent,
      text: 'Your weekly portfolio digest',
      userId,
      kind: 'weekly_digest',
      title: 'Weekly Portfolio Digest',
      createWebNotification: false,
    }).catch(err => {
      console.error('[push-notifications] Failed to send weekly digest:', err)
    })
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })

    if (!user?.prefs) {
      return this.getDefaultPreferences()
    }

    try {
      const prefs = JSON.parse(user.prefs) as Partial<NotificationPreferences>
      return {
        emailNotifications: prefs.emailNotifications ?? true,
        pushNotifications: prefs.pushNotifications ?? true,
        priceAlerts: prefs.priceAlerts ?? true,
        portfolioAlerts: prefs.portfolioAlerts ?? true,
        transactionAlerts: prefs.transactionAlerts ?? true,
        marketNews: prefs.marketNews ?? false,
        weeklyDigest: prefs.weeklyDigest ?? true,
        dailyDigest: prefs.dailyDigest ?? false
      }
    } catch {
      return this.getDefaultPreferences()
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true }
    })

    let currentPrefs: Record<string, unknown> = {}
    if (user?.prefs) {
      try {
        currentPrefs = JSON.parse(user.prefs)
      } catch {
        currentPrefs = {}
      }
    }

    const updated = {
      ...currentPrefs,
      ...prefs
    }

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(updated) }
    })
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      emailNotifications: true,
      pushNotifications: true,
      priceAlerts: true,
      portfolioAlerts: true,
      transactionAlerts: true,
      marketNews: false,
      weeklyDigest: true,
      dailyDigest: false
    }
  }

  /**
   * Batch send notifications to multiple users
   */
  async broadcastNotification(
    userIds: string[],
    payload: PushNotificationPayload,
    kind: string = 'broadcast'
  ): Promise<void> {
    await Promise.all(
      userIds.map(userId => this.sendPushNotification(userId, payload, kind))
    )
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true }
    })
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    })
  }
}

export const pushNotificationService = new PushNotificationService()
