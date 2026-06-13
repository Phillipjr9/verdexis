import admin from 'firebase-admin'
import { env } from './env.js'
import { prisma } from './db.js'

interface PushNotification {
  title: string
  body: string
  data?: Record<string, string>
}

export class PushNotificationService {
  private initialized = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
      console.warn('[push-notifications] Firebase config missing, notifications disabled')
      return
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
        }),
      })
      this.initialized = true
      console.log('[push-notifications] Firebase initialized')
    } catch (err) {
      console.error('[push-notifications] initialization failed:', err)
    }
  }

  async registerDevice(userId: string, fcmToken: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    if (!this.initialized) return

    try {
      await prisma.appSetting.upsert({
        where: { key: `fcm-token:${userId}:${platform}` },
        create: {
          key: `fcm-token:${userId}:${platform}`,
          value: fcmToken,
        },
        update: {
          value: fcmToken,
        },
      })
      console.log(`[push-notifications] registered ${platform} device for user ${userId}`)
    } catch (err) {
      console.error('[push-notifications] register device failed:', err)
    }
  }

  async sendToUser(userId: string, notification: PushNotification): Promise<void> {
    if (!this.initialized) return

    try {
      // Get all registered devices for user
      const fcmTokens = await prisma.appSetting.findMany({
        where: {
          key: {
            startsWith: `fcm-token:${userId}:`,
          },
        },
      })

      if (fcmTokens.length === 0) {
        console.warn(`[push-notifications] no devices registered for user ${userId}`)
        return
      }

      const tokens = fcmTokens.map((t) => t.value)

      // Send multicast message (up to 500 tokens at a time)
      const response = await admin.messaging().sendMulticast({
        notification,
        data: notification.data,
        tokens,
        android: {
          priority: 'high',
        },
        webpush: {
          urgency: 'high',
        },
      })

      console.log(`[push-notifications] sent to ${response.successCount}/${tokens.length} devices`)

      // Remove failed tokens
      const failedTokens = response.responses
        .map((resp, idx) => (resp.success ? null : tokens[idx]))
        .filter((token) => token !== null) as string[]

      for (const token of failedTokens) {
        await prisma.appSetting.deleteMany({
          where: { value: token, key: { startsWith: 'fcm-token:' } },
        })
      }
    } catch (err) {
      console.error('[push-notifications] send failed:', err)
    }
  }

  async sendPriceAlert(userId: string, symbol: string, price: number, target: number, direction: 'above' | 'below'): Promise<void> {
    await this.sendToUser(userId, {
      title: `${symbol.toUpperCase()} Price Alert 🚨`,
      body: `${symbol} has moved ${direction} your target of $${target.toFixed(2)}. Current: $${price.toFixed(2)}`,
      data: {
        type: 'price_alert',
        symbol,
        price: price.toString(),
        target: target.toString(),
      },
    })
  }

  async sendOrderFilled(userId: string, symbol: string, side: 'buy' | 'sell', amount: number, price: number): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Order Filled ✅',
      body: `Your ${side} order for ${amount} ${symbol.toUpperCase()} at $${price.toFixed(2)} has been filled`,
      data: {
        type: 'order_filled',
        symbol,
        side,
        amount: amount.toString(),
        price: price.toString(),
      },
    })
  }

  async sendPortfolioMilestone(userId: string, value: number, milestone: number): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Portfolio Milestone 🎉',
      body: `Congratulations! Your portfolio has reached $${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      data: {
        type: 'milestone',
        value: value.toString(),
        milestone: milestone.toString(),
      },
    })
  }

  async sendAIInsight(userId: string, title: string, body: string): Promise<void> {
    await this.sendToUser(userId, {
      title: `💡 ${title}`,
      body,
      data: {
        type: 'ai_insight',
      },
    })
  }

  async sendDepositConfirmation(userId: string, amount: number, currency: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Deposit Confirmed 💰',
      body: `Your deposit of ${amount} ${currency.toUpperCase()} has been confirmed and added to your wallet`,
      data: {
        type: 'deposit_confirmed',
        amount: amount.toString(),
        currency,
      },
    })
  }
}

export const pushNotifications = new PushNotificationService()
