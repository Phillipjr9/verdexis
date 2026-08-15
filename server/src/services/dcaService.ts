import { prisma } from '../db.js'
import { getCurrentCryptoPrice, getHistoricalStockPrice } from '../historicalPrice.js'

export interface DCAScheduleRecord {
  id: string
  userId: string
  asset: string
  assetId: string
  name: string
  amountUsd: number
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  paused: boolean
  intervalDays: number
  active: boolean
  totalInvested: number
  totalAcquired: number
  runs: number
  lastRunAt?: Date
  nextRunAt: Date
  lastSkipReason?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DCAExecutionResult {
  success: boolean
  scheduleId: string
  asset: string
  amountUsd: number
  quantityPurchased: number
  price: number
  txHash?: string
  error?: string
}

/**
 * DCA Service: Manages dollar-cost-averaging schedules and executions
 * Supports: daily, weekly, biweekly, monthly frequencies
 * Integrates with trade execution and price feeds
 */
export class DCAService {
  async createSchedule(
    userId: string,
    {
      asset,
      amountUsd,
      frequency,
    }: {
      asset: string
      amountUsd: number
      frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    }
  ): Promise<DCAScheduleRecord> {
    if (amountUsd < 5) throw new Error('Minimum $5 per DCA purchase')
    if (!['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'UNI'].includes(asset)) {
      throw new Error('Unsupported asset for DCA')
    }

    const nextRunAt = this.calculateNextRun(new Date(), frequency)
    const intervalDays = this.frequencyToIntervalDays(frequency)

    const created = await prisma.dcaSchedule.create({
      data: {
        userId,
        asset,
        assetId: asset.toLowerCase(),
        name: `${asset} DCA`,
        amountUsd,
        frequency: frequency as string, // Store as string in DB
        paused: false,
        intervalDays,
        active: true,
        totalInvested: 0,
        totalAcquired: 0,
        runs: 0,
        nextRunAt,
      },
    })
    return {
      ...created,
      frequency: frequency,
    }
  }

  /**
   * Get all schedules for a user
   */
  async getSchedules(userId: string): Promise<DCAScheduleRecord[]> {
    const schedules = await prisma.dcaSchedule.findMany({
      where: { userId },
      orderBy: { nextRunAt: 'asc' },
    })
    return schedules.map((s) => ({
      ...s,
      frequency: s.frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    }))
  }

  /**
   * Get a single schedule
   */
  async getSchedule(id: string, userId: string): Promise<DCAScheduleRecord | null> {
    const schedule = await prisma.dcaSchedule.findFirst({
      where: { id, userId },
    })
    if (!schedule) return null
    return {
      ...schedule,
      frequency: schedule.frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    }
  }

  /**
   * Pause/unpause a schedule
   */
  async togglePause(id: string, userId: string): Promise<DCAScheduleRecord> {
    const schedule = await this.getSchedule(id, userId)
    if (!schedule) throw new Error('Schedule not found')

    const updated = await prisma.dcaSchedule.update({
      where: { id },
      data: { paused: !schedule.paused },
    })
    return {
      ...updated,
      frequency: updated.frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string, userId: string): Promise<void> {
    const schedule = await this.getSchedule(id, userId)
    if (!schedule) throw new Error('Schedule not found')

    await prisma.dcaSchedule.delete({ where: { id } })
  }

  /**
   * Execute a single DCA purchase
   */
  async executeDCAPurchase(schedule: DCAScheduleRecord): Promise<DCAExecutionResult> {
    try {
      const price = await getCurrentCryptoPrice(schedule.asset)
      if (!price) {
        throw new Error(`Price unavailable for ${schedule.asset}`)
      }

      const wallet = await prisma.walletBalance.findUnique({
        where: { userId_currency: { userId: schedule.userId, currency: 'USD' } },
      })
      const usdBalance = wallet?.available ?? 0
      if (usdBalance < schedule.amountUsd) {
        throw new Error(`Insufficient USD balance. Need $${schedule.amountUsd}, have $${usdBalance}`)
      }

      const quantity = schedule.amountUsd / price

      const transaction = await prisma.$transaction(async (tx) => {
        await tx.trade.create({
          data: {
            userId: schedule.userId,
            symbol: schedule.asset,
            side: 'buy',
            amount: quantity,
            price,
            total: schedule.amountUsd,
          },
        })

        await tx.walletBalance.update({
          where: { userId_currency: { userId: schedule.userId, currency: 'USD' } },
          data: {
            balance: { decrement: schedule.amountUsd },
            available: { decrement: schedule.amountUsd },
          },
        })

        const nextRunAt = this.calculateNextRun(new Date(), schedule.frequency)
        await tx.dcaSchedule.update({
          where: { id: schedule.id },
          data: {
            totalInvested: { increment: schedule.amountUsd },
            runs: { increment: 1 },
            nextRunAt,
            lastRunAt: new Date(),
          },
        })
      })

      return {
        success: true,
        scheduleId: schedule.id,
        asset: schedule.asset,
        amountUsd: schedule.amountUsd,
        quantityPurchased: quantity,
        price,
      }
    } catch (error) {
      return {
        success: false,
        scheduleId: schedule.id,
        asset: schedule.asset,
        amountUsd: schedule.amountUsd,
        quantityPurchased: 0,
        price: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Execute all due DCA schedules (call this from a cron job)
   */
  async executeDueDCASchedules(): Promise<DCAExecutionResult[]> {
    const now = new Date()

    const schedules = await prisma.dcaSchedule.findMany({
      where: {
        paused: false,
        nextRunAt: { lte: now },
      },
    })

    const results: DCAExecutionResult[] = []

    for (const schedule of schedules) {
      const typedSchedule: DCAScheduleRecord = {
        ...schedule,
        frequency: schedule.frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly',
      }
      const result = await this.executeDCAPurchase(typedSchedule)
      results.push(result)
    }

    return results
  }

  /**
   * Calculate next run date based on frequency
   */
  private calculateNextRun(from: Date, frequency: string): Date {
    const next = new Date(from)

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1)
        break
      case 'weekly':
        next.setDate(next.getDate() + 7)
        break
      case 'biweekly':
        next.setDate(next.getDate() + 14)
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        break
      default:
        throw new Error(`Unknown frequency: ${frequency}`)
    }

    return next
  }

  private frequencyToIntervalDays(frequency: string): number {
    switch (frequency) {
      case 'daily':
        return 1
      case 'weekly':
        return 7
      case 'biweekly':
        return 14
      case 'monthly':
        return 30
      default:
        throw new Error(`Unknown frequency: ${frequency}`)
    }
  }
}

export const dcaService = new DCAService()
