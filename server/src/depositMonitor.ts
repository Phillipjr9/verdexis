import https from 'node:https'
import { prisma } from './db.js'
import { recordLedgerTransaction } from './services/ledger.js'
import { activateReferralOnDeposit } from './referrals.js'

interface BlockchainNode {
  network: string
  rpc: string
  explorer: string
  decimals: number
}

// Public RPC endpoints (no auth required for basic usage)
// For production, set these in .env for better rate limits:
// ETHERSCAN_API_KEY, BLOCKCHAIR_API_KEY, SOLANA_RPC_URL
const BLOCKCHAIN_NODES: Record<string, BlockchainNode> = {
  bitcoin: {
    network: 'bitcoin',
    rpc: 'https://blockstream.info/api',
    explorer: 'https://blockchair.com/bitcoin',
    decimals: 8,
  },
  ethereum: {
    network: 'ethereum',
    rpc: process.env.INFURA_PROJECT_ID 
      ? `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
      : 'https://eth.llamarpc.com', // Free public RPC fallback
    explorer: 'https://etherscan.io',
    decimals: 18,
  },
  solana: {
    network: 'solana',
    rpc: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    explorer: 'https://solscan.io',
    decimals: 9,
  },
}

function resolveNodeKey(currency: string): string | undefined {
  const c = (currency || '').toLowerCase()
  const symbolMap: Record<string, string> = {
    eth: 'ethereum',
    ethereum: 'ethereum',
    btc: 'bitcoin',
    bitcoin: 'bitcoin',
    sol: 'solana',
    solana: 'solana',
  }
  return symbolMap[c]
}

class DepositMonitor {
  private monitoredAddresses: Map<string, { userId: string; currency: string; depositId: string }> = new Map()
  private isRunning = false
  private pollIntervalMs = 30_000 // Check every 30 seconds

  async initialize(): Promise<void> {
    console.log('[deposit-monitor] initializing...')
    // Load all users with assigned deposit addresses to monitor
    const users = await prisma.user.findMany({
      select: { id: true, prefs: true },
    })

    for (const user of users) {
      if (!user.prefs) continue
      try {
        const prefs = JSON.parse(user.prefs) as { depositAddresses?: { cryptos?: Record<string, { currency: string; address: string }> } }
        const cryptos = prefs.depositAddresses?.cryptos
        if (!cryptos) continue

        for (const addr of Object.values(cryptos)) {
          if (addr.address && addr.currency) {
            this.monitoredAddresses.set(addr.address, {
              userId: user.id,
              currency: addr.currency,
              depositId: '', // Not using pending deposits for assigned addresses
            })
          }
        }
      } catch {
        // ignore bad prefs
      }
    }

    console.log(`[deposit-monitor] monitoring ${this.monitoredAddresses.size} addresses`)
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.initialize()
      .then(() => this.poll())
      .catch((e) => console.error('[deposit-monitor] init failed', e))
    setInterval(() => {
      this.poll().catch((e) => console.error('[deposit-monitor] poll failed', e))
    }, this.pollIntervalMs)
  }

  private async poll(): Promise<void> {
    for (const [address, meta] of this.monitoredAddresses.entries()) {
      try {
        const key = resolveNodeKey(meta.currency)
        if (!key) continue
        if (key === 'bitcoin') await this.checkBitcoin(address, meta.depositId, meta.userId, meta.currency)
        else if (key === 'ethereum') await this.checkEthereum(address, meta.depositId, meta.userId, meta.currency)
        else if (key === 'solana') await this.checkSolana(address, meta.depositId, meta.userId, meta.currency)
      } catch (e) {
        console.error(`[deposit-monitor] check failed for ${address}`, e)
      }
    }
  }

  private async checkBitcoin(address: string, depositId: string, userId: string, currency: string): Promise<void> {
    const node = BLOCKCHAIN_NODES.bitcoin
    if (!node) return
    try {
      const data = (await this.fetchJson(`${node.rpc}/address/${address}`)) as {
        chain_stats?: { funded_txo_sum?: number }
        mempool_stats?: { funded_txo_sum?: number }
      }
      const funded = (data.chain_stats?.funded_txo_sum ?? 0) + (data.mempool_stats?.funded_txo_sum ?? 0)
      if (funded <= 0) return
      const btcAmount = funded / 10 ** node.decimals
      await this.creditDeposit(address, depositId, userId, currency, btcAmount)
    } catch (e) {
      console.error('[deposit-monitor] bitcoin check error', e)
    }
  }

  private async checkEthereum(address: string, depositId: string, userId: string, currency: string): Promise<void> {
    const node = BLOCKCHAIN_NODES.ethereum
    if (!node) return
    try {
      const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }
      const data = (await this.fetchJsonPost(node.rpc, payload)) as { result?: string }
      if (!data.result) return
      const wei = BigInt(data.result)
      if (wei <= 0n) return
      const ethAmount = Number(wei) / 10 ** node.decimals
      await this.creditDeposit(address, depositId, userId, currency, ethAmount)
    } catch (e) {
      console.error('[deposit-monitor] ethereum check error', e)
    }
  }

  private async checkSolana(address: string, depositId: string, userId: string, currency: string): Promise<void> {
    const node = BLOCKCHAIN_NODES.solana
    if (!node) return
    try {
      const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }
      const data = (await this.fetchJsonPost(node.rpc, payload)) as { result?: { value?: number } }
      const lamports = data.result?.value ?? 0
      if (lamports <= 0) return
      const solAmount = lamports / 10 ** node.decimals
      await this.creditDeposit(address, depositId, userId, currency, solAmount)
    } catch (e) {
      console.error('[deposit-monitor] solana check error', e)
    }
  }

  private async creditDeposit(address: string, depositId: string, userId: string, currency: string, amount: number): Promise<void> {
    // Check if we already recorded this deposit recently (prevent duplicates)
    const recentDeposit = await prisma.transaction.findFirst({
      where: {
        userId,
        currency,
        kind: 'deposit',
        amount,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Within last hour
      },
    })

    if (recentDeposit) {
      console.log(`[deposit-monitor] duplicate deposit detected for user ${userId}, skipping`)
      return
    }

    // User-submitted pending deposits require explicit admin approval. The
    // monitor may observe the chain, but it must never credit the account.
    if (depositId) {
      console.log(`[deposit-monitor] deposit ${depositId} observed; awaiting admin approval`)
      return
    }

    // Credit user's wallet atomically using ledger accounting
    await prisma.$transaction(async (tx) => {
      const externalRef = depositId ? `pending-deposit:${depositId}` : `deposit-monitor:${address}:${userId}:${amount}`
      const sourceId = depositId ?? `${address}:${amount}`
      const ledgerResult = await recordLedgerTransaction({
        tx,
        userId,
        asset: currency,
        amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: depositId ? 'pending_deposit_confirmed' : 'deposit_auto_credit',
        sourceType: depositId ? 'pending_deposit' : 'deposit_monitor',
        sourceId,
        externalRef,
        idempotencyKey: externalRef,
        description: depositId
          ? `Auto-credit pending deposit ${depositId}`
          : `Auto-credit monitored address ${address}`,
        metadata: {
          address,
          depositId,
          currency,
          source: 'depositMonitor',
        },
        createdBy: 'system',
        reference: depositId
          ? `Auto-credit pending deposit ${depositId}`
          : `Auto-credit from monitored address ${address}`,
        recordTransaction: true,
      })

      if (depositId) {
        await tx.pendingDeposit.updateMany({
          where: {
            id: depositId,
            status: 'pending',
          },
          data: {
            status: 'completed',
            creditedTxId: ledgerResult.transaction?.id ?? `auto-${Date.now()}`,
          },
        })
      }

      await tx.notification.create({
        data: {
          userId,
          kind: 'deposit',
          title: `${amount} ${currency} deposited`,
          body: `Your crypto deposit has been confirmed and credited to your wallet.`,
        },
      })
    })

    console.log(`[deposit-monitor] ✓ deposited ${amount} ${currency} to user ${userId}`)

    // Referral activation (no-op if program disabled or no pending referral)
    try {
      const amountUsd = currency.toUpperCase() === 'USD' ? amount : amount
      await activateReferralOnDeposit(userId, amountUsd)
    } catch (e) {
      console.warn('[deposit-monitor] referral activation skipped', e instanceof Error ? e.message : e)
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('Failed to parse JSON'))
          }
        })
      })
    })
  }

  private async fetchJsonPost(url: string, body: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url)
      const bodyStr = JSON.stringify(body)

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('Failed to parse JSON'))
          }
        })
      })

      req.on('error', reject)
      req.write(bodyStr)
      req.end()
    })
  }

  registerDeposit(depositId: string, address: string, userId: string, currency: string): void {
    this.monitoredAddresses.set(address, { depositId, userId, currency })
    console.log(`[deposit-monitor] registered ${currency} address ${address}`)
  }

  unregisterDeposit(address: string): void {
    this.monitoredAddresses.delete(address)
  }
}

export const depositMonitor = new DepositMonitor()
