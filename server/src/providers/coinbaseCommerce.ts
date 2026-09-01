import crypto from 'node:crypto'
import https from 'node:https'
import { env } from '../env.js'
import { prisma } from '../db.js'
import { notifyDepositEvent } from '../services/emailHooks.js'

interface CoinbaseCharge {
  id: string
  resource: string
  type: string
  code: string
  name: string
  description?: string
  logo_url?: string
  hosted_url: string
  created_at: string
  expires_at: string
  confirmed_at?: string
  checkout?: {
    id: string
  }
  payments: Array<{
    id: string
    status: string
    value: {
      local: { amount: string; currency: string }
      crypto: { amount: string; currency: string }
    }
    block?: {
      height: number
      hash: string
      confirmations_required: number
      confirmations_accumulated?: number
    }
  }>
  addresses: Record<string, string>
  metadata: Record<string, string>
  pricing_type: string
  timeline: Array<{ time: string; status: string; context?: string }>
}

interface CoinbaseWebhookEvent {
  id: string
  type: string
  data: CoinbaseCharge
}

class CoinbaseCommerceProvider {
  private apiKey: string
  private baseUrl = 'https://api.commerce.coinbase.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async makeRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : ''

      const options = {
        hostname: 'api.commerce.coinbase.com',
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CC-Api-Key': this.apiKey,
          'X-CC-Version': '2018-03-22',
          'User-Agent': 'verdexis/1.0',
        },
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Coinbase error: ${parsed.error?.message || res.statusCode}`))
            } else {
              resolve(parsed.data || parsed)
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

  async createCharge(
    name: string,
    description: string,
    amount: string,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<CoinbaseCharge> {
    const response = (await this.makeRequest('POST', '/v1/charges', {
      name,
      description,
      pricing_type: 'fixed_price',
      local_price: {
        amount,
        currency,
      },
      metadata,
      notify_email: metadata.user_email,
    })) as CoinbaseCharge

    return response
  }

  async getCharge(chargeId: string): Promise<CoinbaseCharge> {
    const response = (await this.makeRequest('GET', `/v1/charges/${chargeId}`)) as CoinbaseCharge
    return response
  }

  async listCharges(limit: number = 100, pagination_token?: string): Promise<{ charges: CoinbaseCharge[]; pagination: { pagination_token?: string } }> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (pagination_token) params.append('pagination_token', pagination_token)

    const response = (await this.makeRequest('GET', `/v1/charges?${params.toString()}`)) as {
      pagination: { pagination_token?: string }
      data: CoinbaseCharge[]
    }

    return {
      charges: response.data,
      pagination: response.pagination,
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const computed = crypto.createHmac('sha256', this.apiKey).update(payload).digest('hex')
    return computed === signature
  }
}

export const coinbaseCommerce =
  env.COINBASE_COMMERCE_KEY ? new CoinbaseCommerceProvider(env.COINBASE_COMMERCE_KEY) : null

export async function handleCoinbaseWebhook(event: CoinbaseWebhookEvent): Promise<void> {
  console.log('[coinbase-commerce] webhook event:', event.type)

  const charge = event.data
  if (!charge || !charge.id) {
    console.warn('[coinbase-commerce] webhook missing charge data')
    return
  }

  const userId = charge.metadata?.user_id
  if (!userId) {
    console.warn('[coinbase-commerce] webhook missing user_id in metadata')
    return
  }

  // Find pending deposit by charge ID
  const pendingDeposit = await prisma.pendingDeposit.findUnique({
    where: { txHash: charge.id },
  })

  if (event.type === 'charge:confirmed') {
    // Payment confirmed - credit user's wallet
    const payment = charge.payments?.[0]
    if (!payment) {
      console.warn('[coinbase-commerce] no payment found in charge')
      return
    }

    const amount = parseFloat(payment.value.crypto.amount)
    const currency = payment.value.crypto.currency

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
          txHash: payment.id,
          updatedAt: new Date(),
        },
      })
    }

    await prisma.notification.create({
      data: {
        userId,
        kind: 'deposit',
        title: `${amount.toLocaleString()} ${currency} credited`,
        body: `Deposit confirmed via Coinbase Commerce (charge ${charge.id})`,
      },
    }).catch((e) => {
      console.error('[coinbase-commerce] failed to create notification:', e instanceof Error ? e.message : e)
    })

    const depositUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
    if (depositUser) {
      void notifyDepositEvent(depositUser, { status: 'credited', amount, asset: currency, reference: charge.id, id: charge.id })
    }

    console.log('[coinbase-commerce] deposit confirmed:', charge.id, amount, currency)
  } else if (event.type === 'charge:failed') {
    if (pendingDeposit) {
      await prisma.pendingDeposit.update({
        where: { id: pendingDeposit.id },
        data: {
          status: 'failed',
          updatedAt: new Date(),
        },
      })
    }
    console.log('[coinbase-commerce] charge failed:', charge.id)
  } else if (event.type === 'charge:delayed') {
    console.log('[coinbase-commerce] charge delayed:', charge.id)
  } else if (event.type === 'charge:resolved') {
    if (pendingDeposit) {
      await prisma.pendingDeposit.update({
        where: { id: pendingDeposit.id },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
      })
    }
    console.log('[coinbase-commerce] charge resolved:', charge.id)
  }
}
