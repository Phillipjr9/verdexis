import crypto from 'node:crypto'
import { prisma } from '../db.js'
import { env } from '../env.js'

interface WebhookPayload {
  event: string
  timestamp: string
  userId?: string
  data: any
}

interface SecurityWebhookData {
  eventType: string
  severity: string
  userId: string
  description: string
  riskScore?: number
  ipAddress?: string
  location?: string
}

export class WebhookService {

  /**
   * Send security event webhook
   */
  async sendSecurityWebhook(data: SecurityWebhookData): Promise<boolean> {
    const payload: WebhookPayload = {
      event: 'security_event',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      data
    }

    return this.sendWebhook(payload, env.SECURITY_WEBHOOK_URL)
  }

  /**
   * Send fraud detection webhook
   */
  async sendFraudWebhook(
    userId: string, 
    transaction: any, 
    fraudResult: any
  ): Promise<boolean> {
    const payload: WebhookPayload = {
      event: 'fraud_detection',
      timestamp: new Date().toISOString(),
      userId,
      data: {
        transaction,
        fraudResult,
        severity: fraudResult.riskScore >= 80 ? 'critical' : 
                 fraudResult.riskScore >= 60 ? 'high' : 'medium'
      }
    }

    return this.sendWebhook(payload, env.SECURITY_WEBHOOK_URL)
  }

  /**
   * Send OTP failure webhook
   */
  async sendOTPFailureWebhook(
    userId: string,
    attempts: number,
    purpose: string
  ): Promise<boolean> {
    const payload: WebhookPayload = {
      event: 'otp_failure',
      timestamp: new Date().toISOString(),
      userId,
      data: {
        attempts,
        purpose,
        severity: attempts >= 5 ? 'high' : 'medium'
      }
    }

    return this.sendWebhook(payload, env.SECURITY_WEBHOOK_URL)
  }

  /**
   * Send login anomaly webhook
   */
  async sendLoginAnomalyWebhook(
    userId: string,
    anomalies: string[],
    context: any
  ): Promise<boolean> {
    const payload: WebhookPayload = {
      event: 'login_anomaly',
      timestamp: new Date().toISOString(),
      userId,
      data: {
        anomalies,
        context,
        severity: anomalies.includes('new_country') ? 'high' : 'medium'
      }
    }

    return this.sendWebhook(payload, env.SECURITY_WEBHOOK_URL)
  }

  /**
   * Send generic webhook
   */
  private async sendWebhook(payload: WebhookPayload, webhookUrl?: string): Promise<boolean> {
    if (!webhookUrl) {
      console.log('[webhook] No URL configured, payload:', JSON.stringify(payload, null, 2))
      return true // Success in dev mode
    }

    try {
      const signature = this.generateSignature(JSON.stringify(payload))
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'Verdexis-Webhook/1.0'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Log successful webhook
      await this.logWebhookDelivery(webhookUrl, payload.event, true)
      
      return true
    } catch (error) {
      console.error('[webhook] Delivery failed:', error)
      
      // Log failed webhook
      await this.logWebhookDelivery(
        webhookUrl, 
        payload.event, 
        false, 
        error instanceof Error ? error.message : String(error)
      )
      
      return false
    }
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: string): string {
    if (!env.WEBHOOK_SECRET) {
      return 'no-secret'
    }

    const hmac = crypto.createHmac('sha256', env.WEBHOOK_SECRET)
    hmac.update(payload)
    return `sha256=${hmac.digest('hex')}`
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!env.WEBHOOK_SECRET) {
      return true // Allow in dev mode
    }

    const expectedSignature = this.generateSignature(payload)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Log webhook delivery
   */
  private async logWebhookDelivery(
    url: string,
    event: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // In a full implementation, you'd store this in a webhooks table
      console.log(`[webhook] ${success ? 'SUCCESS' : 'FAILED'}: ${event} to ${url}${error ? ` - ${error}` : ''}`)
    } catch (logError) {
      console.error('[webhook] Failed to log delivery:', logError)
    }
  }

  /**
   * Get webhook delivery stats
   */
  async getWebhookStats(days = 7): Promise<{
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    successRate: string
    eventBreakdown: Record<string, number>
  }> {
    // In a full implementation, query from webhooks table
    return {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      successRate: '0%',
      eventBreakdown: {}
    }
  }
}

export const webhookService = new WebhookService()