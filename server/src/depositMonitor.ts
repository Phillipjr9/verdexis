import https from 'node:https'
import { prisma } from './db.js'
import { recordLedgerTransaction } from './services/ledger.js'

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
      : 'https://eth.llamarpc.com',
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

/** Basic shape checks so we never hit explorers with garbage addresses. */
function isPlausibleAddress(nodeKey: string, address: string): boolean {
  const a = (address || '').trim()
  if (!a || a.length < 10) return false
  if (nodeKey === 'bitcoin') {
    // Legacy (1…/3…) or bech32 (bc1…)
    return /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a)
  }
  if (nodeKey === 'ethereum') {
    return /^0x[a-fA-F0-9]{40}$/.test(a)
  }
  if (nodeKey === 'solana') {
    // base58, roughly 32–44 chars
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)
  }
  return false
}

function parseUserPrefs(prefs: unknown): {
  depositAddresses?: { cryptos?: Record<string, { currency: string; address: string }> }
} | null {
  if (!prefs) return null
  if (typeof prefs === 'object') return prefs as any
  if (typeof prefs === 'string') {
    try {
      return JSON.parse(prefs)
    } catch {
      return null
    }
  }
  return null
}

class DepositMonitor {
  private monitoredAddresses: Map<string, { userId: string; currency: string; depositId: string }> = new Map()
  private isRunning = false
  private pollIntervalMs = 30_000
  /** Addresses that failed validation or permanently error — log once, then skip. */
  private skippedAddresses = new Set<string>()

  async initialize(): Promise<void> {
    console.log('[deposit-monitor] initializing...')
    const users = await prisma.user.findMany({
      select: { id: true, prefs: true },
    })

    for (const user of users) {
      if (!user.prefs) continue
      try {
        const prefs = parseUserPrefs(user.prefs)
        const cryptos = prefs?.depositAddresses?.cryptos
        if (!cryptos) continue

        for (const addr of Object.values(cryptos)) {
          if (addr.address && addr.currency) {
            this.monitoredAddresses.set(addr.address, {
              userId: user.id,
              currency: addr.currency,
              depositId: '',
            })
          }
        }
      } catch (err) {
        console.error(`[deposit-monitor] failed to parse prefs for user ${user.id}:`, err)
      }
    }

    console.log(`[deposit-monitor] loaded ${this.monitoredAddresses.size} deposit addresses`)
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
    if (this.skippedAddresses.has(address)) return

    const nodeKey = resolveNodeKey(currency)
    if (!nodeKey) {
      // Unsupported currency for on-chain poll (e.g. USDT/TRX) — skip quietly after one warn
      console.warn(`[deposit-monitor] unsupported currency for auto-monitor: ${currency} (${address})`)
      this.skippedAddresses.add(address)
      return
    }

    if (!isPlausibleAddress(nodeKey, address)) {
      console.warn(
        `[deposit-monitor] skipping invalid ${currency} address shape: ${address} (not a valid ${nodeKey} address)`,
      )
      this.skippedAddresses.add(address)
      return
    }

    const node = BLOCKCHAIN_NODES[nodeKey]
    try {
      if (nodeKey === 'bitcoin') {
        await this.checkBitcoinAddress(address, userId, currency, depositId, node)
      } else if (nodeKey === 'ethereum') {
        await this.checkEthereumAddress(address, userId, currency, depositId, node)
      } else if (nodeKey === 'solana') {
        await this.checkSolanaAddress(address, userId, currency, depositId, node)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Invalid / rate-limited / HTML error pages — don't spam every 30s
      if (/parse JSON|HTTP \d+|Invalid|not found/i.test(msg)) {
        console.warn(`[deposit-monitor] ${currency} ${address}: ${msg}`)
        if (/Invalid|not found/i.test(msg)) this.skippedAddresses.add(address)
      } else {
        console.error(`[deposit-monitor] error checking ${currency} address ${address}:`, err)
      }
    }
  }

  private async checkBitcoinAddress(
    address: string,
    userId: string,
    currency: string,
    depositId: string,
    node: BlockchainNode,
  ): Promise<void> {
    // Blockstream: GET /address/{addr} → chain_stats.funded_txo_sum / spent_txo_sum (sats)
    const response = (await this.fetchJson(`${node.rpc}/address/${encodeURIComponent(address)}`)) as {
      chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number }
      message?: string
    } | null

    if (!response || !response.chain_stats) return

    const funded = Number(response.chain_stats.funded_txo_sum ?? 0)
    const spent = Number(response.chain_stats.spent_txo_sum ?? 0)
    const confirmedSats = Math.max(0, funded - spent)

    if (confirmedSats > 0) {
      const btcAmount = confirmedSats / Math.pow(10, node.decimals)
      await this.creditDeposit(address, depositId, userId, currency, btcAmount)
    }
  }

  private async checkEthereumAddress(
    address: string,
    userId: string,
    currency: string,
    depositId: string,
    node: BlockchainNode,
  ): Promise<void> {
    const apiKey = process.env.ETHERSCAN_API_KEY || ''
    const url = apiKey
      ? `https://api.etherscan.io/api?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest&apikey=${apiKey}`
      : `https://api.etherscan.io/api?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest`
    const response = (await this.fetchJson(url)) as { status?: string; result?: string } | null

    if (!response || response.status !== '1') return

    const balanceWei = BigInt(response.result || '0')
    if (balanceWei > 0n) {
      const ethAmount = Number(balanceWei) / Math.pow(10, node.decimals)
      await this.creditDeposit(address, depositId, userId, currency, ethAmount)
    }
  }

  private async checkSolanaAddress(
    address: string,
    userId: string,
    currency: string,
    depositId: string,
    node: BlockchainNode,
  ): Promise<void> {
    const response = (await this.fetchJsonPost(node.rpc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    })) as { result?: { value?: number } } | null

    if (!response || response.result === undefined) return

    const lamports = response.result.value || 0
    if (lamports > 0) {
      const solAmount = lamports / Math.pow(10, node.decimals)
      await this.creditDeposit(address, depositId, userId, currency, solAmount)
    }
  }

  private async creditDeposit(
    address: string,
    depositId: string,
    userId: string,
    currency: string,
    amount: number,
  ): Promise<void> {
    const recentDeposit = await prisma.transaction.findFirst({
      where: {
        userId,
        currency,
        kind: 'deposit',
        amount,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })

    if (recentDeposit) {
      console.log(`[deposit-monitor] duplicate deposit detected for user ${userId}, skipping`)
      return
    }

    // User-submitted pending deposits require explicit admin approval.
    if (depositId) {
      console.log(`[deposit-monitor] deposit ${depositId} observed; awaiting admin approval`)
      return
    }

    await prisma.$transaction(async (tx) => {
      const externalRef = `deposit-monitor:${address}:${userId}:${amount}`
      const sourceId = `${address}:${amount}`
      const ledgerResult = await recordLedgerTransaction({
        tx,
        userId,
        asset: currency,
        amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'deposit_auto_credit',
        sourceType: 'deposit_monitor',
        sourceId,
        externalRef,
        idempotencyKey: externalRef,
        description: `Auto-credit monitored address ${address}`,
        metadata: {
          address,
          depositId,
          currency,
          source: 'depositMonitor',
        },
        createdBy: 'system',
        reference: `Auto-credit from monitored address ${address}`,
        recordTransaction: true,
      })

      void ledgerResult

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
  }

  private async fetchJson(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 15_000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          const status = res.statusCode || 0
          const trimmed = data.trim()
          if (status >= 400) {
            reject(new Error(`HTTP ${status}: ${trimmed.slice(0, 120)}`))
            return
          }
          if (!trimmed) {
            resolve(null)
            return
          }
          // Blockstream returns plain text for invalid addresses, e.g. "Invalid Bitcoin address"
          if (trimmed[0] !== '{' && trimmed[0] !== '[') {
            reject(new Error(trimmed.slice(0, 160) || 'Non-JSON response'))
            return
          }
          try {
            resolve(JSON.parse(trimmed))
          } catch {
            reject(new Error(`Failed to parse JSON: ${trimmed.slice(0, 80)}`))
          }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
    })
  }

  private async fetchJsonPost(url: string, body: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url)
      const bodyStr = JSON.stringify(body)

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        timeout: 15_000,
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          const status = res.statusCode || 0
          const trimmed = data.trim()
          if (status >= 400) {
            reject(new Error(`HTTP ${status}: ${trimmed.slice(0, 120)}`))
            return
          }
          if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
            reject(new Error(trimmed.slice(0, 160) || 'Non-JSON response'))
            return
          }
          try {
            resolve(JSON.parse(trimmed))
          } catch {
            reject(new Error(`Failed to parse JSON: ${trimmed.slice(0, 80)}`))
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      req.write(bodyStr)
      req.end()
    })
  }

  registerDeposit(depositId: string, address: string, userId: string, currency: string): void {
    this.monitoredAddresses.set(address, { depositId, userId, currency })
    this.skippedAddresses.delete(address)
    console.log(`[deposit-monitor] registered ${currency} address ${address}`)
  }

  unregisterDeposit(address: string): void {
    this.monitoredAddresses.delete(address)
    this.skippedAddresses.delete(address)
  }
}

export const depositMonitor = new DepositMonitor()
