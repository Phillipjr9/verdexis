import https from 'node:https'
import { prisma } from './db.js'
import { env } from './env.js'

interface BlockchainNode {
  network: string
  rpc: string
  explorer: string
  decimals: number
}

// Public RPC endpoints (no auth required)
const BLOCKCHAIN_NODES: Record<string, BlockchainNode> = {
  bitcoin: {
    network: 'bitcoin',
    rpc: 'https://blockstream.info/api',
    explorer: 'https://blockchair.com/bitcoin',
    decimals: 8,
  },
  ethereum: {
    network: 'ethereum',
    rpc: 'https://eth.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    explorer: 'https://etherscan.io',
    decimals: 18,
  },
  solana: {
    network: 'solana',
    rpc: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://solscan.io',
    decimals: 9,
  },
}

class DepositMonitor {
  private monitoredAddresses: Map<string, { userId: string; currency: string; depositId: string }> = new Map()
  private isRunning = false
  private pollIntervalMs = 30_000 // Check every 30 seconds

  async initialize(): Promise<void> {
    console.log('[deposit-monitor] initializing...')
    // Load pending deposits to monitor
    const pendingDeposits = await prisma.pendingDeposit.findMany({
      where: { status: 'pending' },
    })

    for (const deposit of pendingDeposits) {
      this.monitoredAddresses.set(deposit.toAddress, {
        userId: deposit.userId,
        currency: deposit.asset,
        depositId: deposit.id,
      })
    }

    console.log(`[deposit-monitor] loaded ${this.monitoredAddresses.size} pending deposits`)
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    console.log('[deposit-monitor] started')
    this.poll()
  }

  stop(): void {
    this.isRunning = false
    console.log('[deposit-monitor] stopped')
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return

    try {
      for (const [address, { userId, currency, depositId }] of this.monitoredAddresses) {
        await this.checkAddress(address, userId, currency, depositId)
      }
    } catch (err) {
      console.error('[deposit-monitor] poll error:', err)
    }

    if (this.isRunning) {
      setTimeout(() => this.poll(), this.pollIntervalMs)
    }
  }

  private async checkAddress(address: string, userId: string, currency: string, depositId: string): Promise<void> {
    const node = BLOCKCHAIN_NODES[currency.toLowerCase()]
    if (!node) {
      console.warn(`[deposit-monitor] unsupported currency: ${currency}`)
      return
    }

    try {
      if (currency.toLowerCase() === 'bitcoin') {
        await this.checkBitcoinAddress(address, userId, currency, depositId, node)
      } else if (currency.toLowerCase() === 'ethereum') {
        await this.checkEthereumAddress(address, userId, currency, depositId, node)
      } else if (currency.toLowerCase() === 'solana') {
        await this.checkSolanaAddress(address, userId, currency, depositId, node)
      }
    } catch (err) {
      console.error(`[deposit-monitor] error checking ${currency} address ${address}:`, err)
    }
  }

  private async checkBitcoinAddress(
    address: string,
    userId: string,
    currency: string,
    depositId: string,
    node: BlockchainNode,
  ): Promise<void> {
    const response = await this.fetchJson(`${node.rpc}/address/${address}`)

    if (!response || !response.chain_stats) return

    const { received_value, confirmed_balance } = response.chain_stats

    if (confirmed_balance > 0) {
      const btcAmount = confirmed_balance / Math.pow(10, node.decimals)
      await this.creditDeposit(depositId, userId, currency, btcAmount)
    }
  }

  private async checkEthereumAddress(
    address: string,
    userId: string,
    currency: string,
    depositId: string,
    node: BlockchainNode,
  ): Promise<void> {
    const response = await this.fetchJson(
      `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=YourEtherscanAPIKey`,
    )

    if (!response || response.status !== '1') return

    const balanceWei = BigInt(response.result || '0')
    if (balanceWei > 0n) {
      const ethAmount = Number(balanceWei) / Math.pow(10, node.decimals)
      await this.creditDeposit(depositId, userId, currency, ethAmount)
    }
  }

  private async checkSolanaAddress(
    address: string,
    userId: string,
    currency: string,
    depositId: string,
    node: BlockchainNode,
  ): Promise<void> {
    const response = await this.fetchJsonPost(node.rpc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    })

    if (!response || response.result === undefined) return

    const lamports = response.result.value || 0
    if (lamports > 0) {
      const solAmount = lamports / Math.pow(10, node.decimals)
      await this.creditDeposit(depositId, userId, currency, solAmount)
    }
  }

  private async creditDeposit(depositId: string, userId: string, currency: string, amount: number): Promise<void> {
    const deposit = await prisma.pendingDeposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit || deposit.status !== 'pending') return

    // Verify amount matches expected deposit amount (with some tolerance for fees)
    if (Math.abs(amount - deposit.amount) > deposit.amount * 0.01) {
      console.warn(`[deposit-monitor] amount mismatch: expected ${deposit.amount}, got ${amount}`)
      return
    }

    // Credit user's wallet
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

    // Mark deposit as completed
    await prisma.pendingDeposit.update({
      where: { id: depositId },
      data: {
        status: 'completed',
        updatedAt: new Date(),
      },
    })

    // Remove from monitoring
    this.monitoredAddresses.delete(deposit.toAddress)

    console.log(`[deposit-monitor] ✓ deposited ${amount} ${currency} to user ${userId}`)
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
