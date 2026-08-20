import https from 'node:https'
import { prisma } from './db.js'
import { recordLedgerTransaction } from './services/ledger.js'
import { activateReferralOnDeposit } from './referrals.js'

/**
 * Polls public explorers for incoming deposits to monitored addresses.
 * User-submitted pending deposits always require explicit admin approval;
 * this monitor only auto-credits pure address watches (no pendingDeposit id).
 */
class DepositMonitor {
  private interval: ReturnType<typeof setInterval> | null = null
  private running = false

  start(pollMs = 60_000) {
    if (this.interval) return
    console.log('[deposit-monitor] starting')
    this.interval = setInterval(() => {
      this.tick().catch((e) => console.error('[deposit-monitor] tick failed', e))
    }, pollMs)
    this.tick().catch((e) => console.error('[deposit-monitor] initial tick failed', e))
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const addresses = await prisma.monitoredAddress.findMany({
        where: { active: true },
        take: 200,
      })
      for (const row of addresses) {
        try {
          if (row.currency === 'BTC' || row.network?.toLowerCase().includes('btc')) {
            await this.checkBtc(row.address, row.userId, row.currency, row.pendingDepositId)
          } else if (row.currency === 'ETH' || row.network?.toLowerCase().includes('eth') || row.network?.toLowerCase().includes('erc')) {
            await this.checkEth(row.address, row.userId, row.currency, row.pendingDepositId)
          } else if (row.currency === 'SOL' || row.network?.toLowerCase().includes('sol')) {
            await this.checkSol(row.address, row.userId, row.currency, row.pendingDepositId)
          }
        } catch (e) {
          console.error(`[deposit-monitor] check failed for ${row.address}`, e)
        }
      }
    } finally {
      this.running = false
    }
  }

  private async checkBtc(address: string, userId: string, currency: string, depositId: string | null) {
    // Simplified placeholder — real implementation would use blockstream/mempool API
    void address
    void userId
    void currency
    void depositId
  }

  private async checkEth(address: string, userId: string, currency: string, depositId: string | null) {
    void address
    void userId
    void currency
    void depositId
  }

  private async checkSol(address: string, userId: string, currency: string, depositId: string | null) {
    void address
    void userId
    void currency
    void depositId
  }

  private async creditDeposit(address: string, depositId: string, userId: string, currency: string, amount: number): Promise<void> {
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

    if (depositId) {
      console.log(`[deposit-monitor] deposit ${depositId} observed; awaiting admin approval`)
      return
    }

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
}

export const depositMonitor = new DepositMonitor()
