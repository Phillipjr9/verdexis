import crypto from 'node:crypto'
import { prisma } from '../db.js'

export type WebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.verified'
  | 'transaction.created'
  | 'transaction.completed'
  | 'transaction.failed'
  | 'deposit.received'
  | 'withdrawal.initiated'
  | 'withdrawal.completed'
  | 'trade.created'
  | 'trade.completed'
  | 'alert.triggered'
  | 'kyc.approved'
  | 'kyc.rejected'
  | 'account.suspended'
  | 'account.unsuspended'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
  userId?: string
}

export class WebhookService {
  /**
   * Create webhook endpoint for user
   */
  static async createWebhook(
    userId: string,
    url: string,
    events: WebhookEvent[],
    active: boolean = true,
  ): Promise<{ id: string; secret: string }> {
    const secret = crypto.randomBytes(32).toString('hex')
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex')

    const webhook = await prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secretHash,
        active,
      },
    })

    return { id: webhook.id, secret }
  }

  /**
   * Get user's webhooks
   */
  static async getWebhooks(userId: string) {
    return prisma.webhook.findMany({
      where: { userId },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        lastTriggeredAt: true,
        failureCount: true,
      },
    })
  }

  /**
   * Update webhook
   */
  static async updateWebhook(
    userId: string,
    webhookId: string,
    data: { url?: string; events?: WebhookEvent[]; active?: boolean },
  ) {
    return prisma.webhook.updateMany({
      where: { id: webhookId, userId },
      data,
    })
  }

  /**
   * Delete webhook
   */
  static async deleteWebhook(userId: string, webhookId: string): Promise<boolean> {
    const result = await prisma.webhook.deleteMany({
      where: { id: webhookId, userId },
    })

    return result.count > 0
  }

  /**
   * Trigger webhook event
   */
  static async triggerEvent(event: WebhookEvent, data: Record<string, unknown>, userId?: string): Promise<void> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        active: true,
        events: { has: event },
        ...(userId ? { userId } : {}),
      },
    })

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      userId,
    }

    for (const webhook of webhooks) {
      this.sendWebhook(webhook, payload).catch(err => {
        console.error(`[webhook] Failed to send ${event} to ${webhook.url}:`, err)
      })
    }
  }

  /**
   * Send webhook with signature
   */
  private static async sendWebhook(webhook: { id: string; url: string; secretHash: string }, payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload)
    const timestamp = Date.now().toString()
    const signature = crypto
      .createHmac('sha256', webhook.secretHash)
      .update(`${timestamp}.${body}`)
      .digest('hex')

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-ID': webhook.id,
        },
        body,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Update last triggered time
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: 0,
        },
      })
    } catch (error) {
      // Increment failure count
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          failureCount: { increment: 1 },
          active: false,
        },
      })

      throw error
    }
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(body: string, signature: string, timestamp: string, secret: string): boolean {
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex')
    const expectedSignature = crypto
      .createHmac('sha256', secretHash)
      .update(`${timestamp}.${body}`)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }
}

export const webhookService = new WebhookService()
