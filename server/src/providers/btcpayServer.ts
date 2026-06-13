import https from 'node:https'
import crypto from 'node:crypto'
import { env } from '../env.js'
import { prisma } from '../db.js'

interface BTCPayInvoice {
  id: string
  orderId: string
  invoiceTime: number
  expirationTime: number
  currentTime: number
  status: 'new' | 'paid' | 'confirmed' | 'complete' | 'expired' | 'invalid'
  price: number
  currency: string
  cryptoInfo: Array<{
    cryptoCode: string
    payment_address: string
    rate: number
    exRates: Record<string, number>
  }>
  amountPaid: number
  displayAmountPaid: string
  exceptionStatus: string | null
  targetConfirmations: number
  transactions?: Record<string, Array<{ type: string; amount: number; confirmations: number }>>
  metadata?: Record<string, unknown>
  addresses?: Record<string, string>
  url: string
  resourcePath: string
}

interface BTCPayWebhookEvent {
  deliveryId: string
  webhookId: string
  originalDeliveryId: string
  isRedelivery: boolean
  type: string
  timestamp: number
  data: {
    id: string
    invoiceId: string
    status: string
    orderId: string
    amountPaid: number
    dustThreshold?: number
  }
}

class BTCPayProvider {
  private serverUrl: string
  private apiKey: string
  private storeId: string

  constructor(serverUrl: string, apiKey: string, storeId: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.storeId = storeId
  }

  private async makeRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.serverUrl}/api/v1${path}`)
      const bodyStr = body ? JSON.stringify(body) : ''

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${this.apiKey}`,
        },
      }

      const protocol = url.protocol === 'https:' ? https : https // Always use https
      const req = protocol.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`BTCPay error: ${parsed.error || res.statusCode}`))
            } else {
              resolve(parsed)
            }
          } catch (err) {
            reject(err)
          }
        })
      })

      req.on('error', reject)
      if (bodyStr) req.write(bodyStr)
      req.end()
    })
  }

  async createInvoice(
    price: number,
    currency: string,
    orderId: string,
    metadata?: Record<string, unknown>,
  ): Promise<BTCPayInvoice> {
    const response = (await this.makeRequest('POST', `/stores/${this.storeId}/invoices`, {
      amount: price,
      currency,
      orderId,
      itemDesc: `Deposit - ${orderId}`,
      notificationUrl: `${env.APP_BASE_URL}/api/webhooks/btcpay`,
      redirectUrl: `${env.APP_BASE_URL}/wallet?status=success`,
      langId: 'en',
      buyerEmail: metadata?.email as string,
      serverInitiatedLink: true,
    })) as BTCPayInvoice

    return response
  }

  async getInvoice(invoiceId: string): Promise<BTCPayInvoice> {
    const response = (await this.makeRequest('GET', `/stores/${this.storeId}/invoices/${invoiceId}`)) as BTCPayInvoice
    return response
  }

  async markInvoiceStatus(invoiceId: string, status: 'confirmed' | 'complete'): Promise<BTCPayInvoice> {
    const response = (await this.makeRequest(
      'POST',
      `/stores/${this.storeId}/invoices/${invoiceId}/status`,
      { status },
    )) as BTCPayInvoice
    return response
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const computed = crypto.createHmac('sha256', this.apiKey).update(payload).digest('hex')
    return computed === signature
  }
}

export const btcpayServer =
  env.BTCPAY_SERVER_URL && env.BTCPAY_API_KEY && env.BTCPAY_STORE_ID
    ? new BTCPayProvider(env.BTCPAY_SERVER_URL, env.BTCPAY_API_KEY, env.BTCPAY_STORE_ID)
    : null

export async function handleBTCPayWebhook(event: BTCPayWebhookEvent): Promise<void> {
  console.log('[btcpay] webhook event:', event.type, event.data.status)

  if (!event.data || !event.data.invoiceId) {
    console.warn('[btcpay] webhook missing invoice data')
    return
  }

  const invoiceId = event.data.invoiceId
  const orderId = event.data.orderId

  // Parse orderId to get userId and currency
  // Format: user-{userId}-{currency}
  const [, userId, currency] = orderId.match(/^user-([^-]+)-(.+)$/) || []
  if (!userId || !currency) {
    console.warn('[btcpay] webhook invalid order format:', orderId)
    return
  }

  const pendingDeposit = await prisma.pendingDeposit.findUnique({
    where: { txHash: invoiceId },
  })

  if (event.type === 'invoice_confirmed') {
    // At least 1 confirmation received
    const amount = event.data.amountPaid || 0
    if (amount <= 0) {
      console.warn('[btcpay] webhook zero amount:', invoiceId)
      return
    }

    const walletBalance = await prisma.walletBalance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    })

    const newBalance = (walletBalance?.balance || 0) + amount
    const newAvailable = (walletBalance?.available || 0) + amount

    await prisma.walletBalance.upsert({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
      create: {
        userId,
        currency,
        symbol: currency,
        balance: newBalance,
        available: newAvailable,
      },
      update: {
        balance: newBalance,
        available: newAvailable,
      },
    })

    if (pendingDeposit) {
      await prisma.pendingDeposit.update({
        where: { id: pendingDeposit.id },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
      })
    }

    console.log('[btcpay] deposit confirmed:', invoiceId, amount, currency)
  } else if (event.type === 'invoice_completed') {
    // Payment fully settled (6+ confirmations)
    if (pendingDeposit) {
      await prisma.pendingDeposit.update({
        where: { id: pendingDeposit.id },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
      })
    }
    console.log('[btcpay] invoice completed:', invoiceId)
  } else if (event.type === 'invoice_expired' || event.type === 'invoice_failedToConfirm') {
    if (pendingDeposit) {
      await prisma.pendingDeposit.update({
        where: { id: pendingDeposit.id },
        data: {
          status: 'failed',
          updatedAt: new Date(),
        },
      })
    }
    console.log('[btcpay] invoice failed:', invoiceId)
  }
}
