import crypto from 'node:crypto'
import https from 'node:https'
import { env } from '../env.js'
import { prisma } from '../db.js'

interface CryptocomPayment {
  id: string
  merchant_id: string
  type: string
  currency: string
  amount: number
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'
  address: string
  tx_id?: string
  create_time: number
  update_time: number
  expire_time: number
}

interface CryptocomWebhookEvent {
  id: string
  create_time: number
  update_time: number
  merchant_id: string
  type: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'
  currency: string
  amount: number
  address: string
  tx_id?: string
}

class CryptocomPayProvider {
  private apiKey: string
  private apiSecret: string
  private baseUrl = 'https://api.crypto.com/payment/v1'

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
  }

  private generateSignature(method: string, path: string, body: string = ''): string {
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `${method}${path}${body}${timestamp}`
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex')
    return signature
  }

  private async makeRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : ''
      const signature = this.generateSignature(method, path, bodyStr)
      const timestamp = Math.floor(Date.now() / 1000)

      const options = {
        hostname: 'api.crypto.com',
        path: `/payment/v1${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-MERCHANT-ID': this.apiKey,
          'X-SIGN': signature,
          'X-TIMESTAMP': timestamp.toString(),
        },
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Crypto.com API error: ${parsed.message || res.statusCode}`))
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

  async createPayment(amount: number, currency: string, metadata: Record<string, string>): Promise<CryptocomPayment> {
    const response = (await this.makeRequest('POST', '/payments', {
      amount,
      currency,
      metadata,
      return_url: `${env.APP_BASE_URL}/wallet?status=success`,
      cancel_url: `${env.APP_BASE_URL}/wallet?status=cancelled`,
    })) as { id: string; address: string; create_time: number; expire_time: number; currency: string; amount: number }

    return {
      id: response.id,
      merchant_id: this.apiKey,
      type: 'PAYMENT',
      currency: response.currency,
      amount: response.amount,
      status: 'PENDING',
      address: response.address,
      create_time: response.create_time,
      update_time: response.create_time,
      expire_time: response.expire_time,
    }
  }

  async getPayment(paymentId: string): Promise<CryptocomPayment> {
    const response = (await this.makeRequest('GET', `/payments/${paymentId}`)) as CryptocomPayment
    return response
  }

  async listPayments(limit: number = 50, offset: number = 0): Promise<CryptocomPayment[]> {
    const response = (await this.makeRequest('GET', `/payments?limit=${limit}&offset=${offset}`)) as {
      data: CryptocomPayment[]
    }
    return response.data
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const computed = crypto.createHmac('sha256', this.apiSecret).update(payload).digest('hex')
    return computed === signature
  }
}

export const cryptocomPay =
  env.CRYPTOCOM_PAY_KEY && env.CRYPTOCOM_PAY_SECRET
    ? new CryptocomPayProvider(env.CRYPTOCOM_PAY_KEY, env.CRYPTOCOM_PAY_SECRET)
    : null

export async function handleCryptocomWebhook(event: CryptocomWebhookEvent): Promise<void> {
  console.log('[cryptocom] webhook event:', event.type, event.status)

  if (!event.id) {
    console.warn('[cryptocom] webhook missing payment ID')
    return
  }

  const pendingDeposit = await prisma.pendingDeposit.findUnique({
    where: { txHash: event.tx_id || event.id },
  })

  if (!pendingDeposit) {
    console.warn('[cryptocom] webhook payment not found:', event.id)
    return
  }

  if (event.status === 'COMPLETED') {
    const walletBalance = await prisma.walletBalance.findUnique({
      where: {
        userId_currency: {
          userId: pendingDeposit.userId,
          currency: event.currency,
        },
      },
    })

    const newBalance = (walletBalance?.balance || 0) + event.amount
    const newAvailable = (walletBalance?.available || 0) + event.amount

    await prisma.walletBalance.upsert({
      where: {
        userId_currency: {
          userId: pendingDeposit.userId,
          currency: event.currency,
        },
      },
      create: {
        userId: pendingDeposit.userId,
        currency: event.currency,
        symbol: event.currency,
        balance: newBalance,
        available: newAvailable,
      },
      update: {
        balance: newBalance,
        available: newAvailable,
      },
    })

    await prisma.pendingDeposit.update({
      where: { id: pendingDeposit.id },
      data: {
        status: 'completed',
        txHash: event.tx_id || event.id,
        updatedAt: new Date(),
      },
    })

    console.log('[cryptocom] deposit confirmed:', event.id, event.amount, event.currency)
  } else if (event.status === 'FAILED') {
    await prisma.pendingDeposit.update({
      where: { id: pendingDeposit.id },
      data: {
        status: 'failed',
        updatedAt: new Date(),
      },
    })
    console.log('[cryptocom] deposit failed:', event.id)
  } else if (event.status === 'EXPIRED') {
    await prisma.pendingDeposit.update({
      where: { id: pendingDeposit.id },
      data: {
        status: 'expired',
        updatedAt: new Date(),
      },
    })
    console.log('[cryptocom] deposit expired:', event.id)
  }
}
