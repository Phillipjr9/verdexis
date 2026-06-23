import Queue from 'bull'
import { prisma } from './db.js'

/**
 * VERDEXIS Job Queue System
 * Week 4: Background job processing
 */

export interface JobData {
  [key: string]: any
}

export interface JobResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

// Create job queues
const depositQueue = new Queue('deposits', process.env.REDIS_URL || 'redis://localhost:6379')
const alertQueue = new Queue('price-alerts', process.env.REDIS_URL || 'redis://localhost:6379')
const dcaQueue = new Queue('dca-schedules', process.env.REDIS_URL || 'redis://localhost:6379')
const emailQueue = new Queue('emails', process.env.REDIS_URL || 'redis://localhost:6379')
const reportQueue = new Queue('reports', process.env.REDIS_URL || 'redis://localhost:6379')
const notificationQueue = new Queue('notifications', process.env.REDIS_URL || 'redis://localhost:6379')

// Map of all queues
export const queues = {
  deposits: depositQueue,
  alerts: alertQueue,
  dca: dcaQueue,
  emails: emailQueue,
  reports: reportQueue,
  notifications: notificationQueue,
}

/**
 * DEPOSIT PROCESSING JOB
 * Verify crypto deposits and credit user account
 */
depositQueue.process(async (job) => {
  const { depositId, transactionHash, userAddress } = job.data

  try {
    // Verify transaction on blockchain
    const verified = await verifyBlockchainTransaction(transactionHash)

    if (!verified) {
      throw new Error('Transaction verification failed')
    }

    // Get deposit record
    const deposit = await prisma.pendingDeposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit) {
      throw new Error('Deposit not found')
    }

    // Credit user account
    await prisma.walletBalance.upsert({
      where: {
        userId_currency: {
          userId: deposit.userId,
          currency: deposit.asset,
        },
      },
      create: {
        userId: deposit.userId,
        currency: deposit.asset,
        balance: deposit.amount,
        available: deposit.amount,
      },
      update: {
        balance: { increment: deposit.amount },
        available: { increment: deposit.amount },
      },
    })

    // Mark deposit as completed
    await prisma.pendingDeposit.update({
      where: { id: depositId },
      data: {
        status: 'completed',
        creditedTxId: transactionHash,
      },
    })

    return {
      success: true,
      message: `Deposit of ${deposit.amount} ${deposit.asset} credited`,
      depositId,
    }
  } catch (error) {
    console.error('[deposit-job] Error:', error)
    throw error
  }
})

/**
 * PRICE ALERT JOB
 * Check if price alerts should be triggered
 */
alertQueue.process(async (job) => {
  const { alertId, symbol, target, direction } = job.data

  try {
    // Get current price
    const currentPrice = await getCurrentPrice(symbol)

    if (!currentPrice) {
      throw new Error(`Cannot fetch price for ${symbol}`)
    }

    let triggered = false

    if (direction === 'above' && currentPrice >= target) {
      triggered = true
    } else if (direction === 'below' && currentPrice <= target) {
      triggered = true
    } else if (direction === 'crosses') {
      triggered = true // Simplified
    }

    if (triggered) {
      // Mark alert as triggered
      await prisma.priceAlert.update({
        where: { id: alertId },
        data: {
          triggered: true,
          triggeredAt: new Date(),
          active: false,
        },
      })

      // Send notification
      await notificationQueue.add(
        {
          userId: (await prisma.priceAlert.findUnique({ where: { id: alertId } }))?.userId,
          type: 'price_alert',
          title: `${symbol} Alert Triggered`,
          body: `${symbol} reached your target of ${target}. Current price: ${currentPrice}`,
        },
        { delay: 0 }
      )
    }

    return { success: true, triggered, currentPrice }
  } catch (error) {
    console.error('[alert-job] Error:', error)
    throw error
  }
})

/**
 * DCA SCHEDULE JOB
 * Execute dollar-cost averaging schedules
 */
dcaQueue.process(async (job) => {
  const { scheduleId } = job.data

  try {
    // Get schedule
    const schedule = await prisma.dcaSchedule.findUnique({
      where: { id: scheduleId },
    })

    if (!schedule || !schedule.active) {
      return { success: false, message: 'Schedule not active' }
    }

    // Get current price
    const price = await getCurrentPrice(schedule.assetId)

    if (!price || price <= 0) {
      throw new Error('Invalid price')
    }

    // Calculate amount to acquire
    const amountToAcquire = schedule.amountUsd / price

    // Execute trade
    await prisma.trade.create({
      data: {
        userId: schedule.userId,
        symbol: schedule.assetId,
        side: 'buy',
        amount: amountToAcquire,
        price,
        total: schedule.amountUsd,
      },
    })

    // Update schedule
    await prisma.dcaSchedule.update({
      where: { id: scheduleId },
      data: {
        runs: { increment: 1 },
        totalInvested: { increment: schedule.amountUsd },
        totalAcquired: { increment: amountToAcquire },
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + schedule.intervalDays * 24 * 60 * 60 * 1000),
      },
    })

    return {
      success: true,
      message: `DCA executed: ${amountToAcquire} ${schedule.assetId}`,
      amountToAcquire,
      price,
    }
  } catch (error) {
    console.error('[dca-job] Error:', error)
    throw error
  }
})

/**
 * EMAIL JOB
 * Send email notifications
 */
emailQueue.process(async (job) => {
  const { to, subject, template, data } = job.data

  try {
    // Send email via your email service
    // await emailService.send({ to, subject, template, data })

    console.log(`[email-job] Sending email to ${to}: ${subject}`)

    return { success: true, to, subject }
  } catch (error) {
    console.error('[email-job] Error:', error)
    throw error
  }
})

/**
 * REPORT GENERATION JOB
 * Generate PDF tax reports
 */
reportQueue.process(async (job) => {
  const { userId, year, format } = job.data

  try {
    // Get user trades for the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    const trades = await prisma.trade.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    // Generate report
    // const report = await generateTaxReport(trades, format)

    // Store report
    // await storeReport(userId, report, year)

    return {
      success: true,
      message: `Report generated for ${year}`,
      tradesCount: trades.length,
    }
  } catch (error) {
    console.error('[report-job] Error:', error)
    throw error
  }
})

/**
 * NOTIFICATION JOB
 * Send real-time notifications
 */
notificationQueue.process(async (job) => {
  const { userId, type, title, body } = job.data

  try {
    // Create notification in database
    await prisma.notification.create({
      data: {
        userId,
        kind: type,
        title,
        body,
      },
    })

    // Send push notification if user has subscribed
    // await sendPushNotification(userId, title, body)

    return { success: true, userId, type }
  } catch (error) {
    console.error('[notification-job] Error:', error)
    throw error
  }
})

/**
 * Add job to queue
 */
export async function addJob(
  queueName: keyof typeof queues,
  data: JobData,
  options?: any
) {
  const queue = queues[queueName]
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`)
  }

  return queue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
    ...options,
  })
}

/**
 * Get queue stats
 */
export async function getQueueStats(queueName: keyof typeof queues) {
  const queue = queues[queueName]
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`)
  }

  const [active, waiting, delayed, failed, completed] = await Promise.all([
    queue.count(),
    queue.getWaitingCount(),
    queue.getDelayedCount(),
    queue.getFailedCount(),
    queue.getCompletedCount(),
  ])

  return {
    name: queueName,
    active,
    waiting,
    delayed,
    failed,
    completed,
  }
}

/**
 * Schedule recurring job
 */
export async function scheduleRecurringJob(
  queueName: keyof typeof queues,
  data: JobData,
  cronPattern: string
) {
  const queue = queues[queueName]
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`)
  }

  return queue.add(data, {
    repeat: {
      cron: cronPattern,
    },
  })
}

/**
 * Helper functions (stubs - implement based on your infrastructure)
 */
async function verifyBlockchainTransaction(hash: string): Promise<boolean> {
  // Implement blockchain verification
  return true
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
  // Implement price fetching
  return 100 // Stub
}

/**
 * Queue event handlers
 */
export function setupQueueHandlers() {
  Object.entries(queues).forEach(([name, queue]) => {
    queue.on('completed', (job) => {
      console.log(`[queue] ✅ ${name}: Job ${job.id} completed`)
    })

    queue.on('failed', (job, err) => {
      console.error(`[queue] ❌ ${name}: Job ${job.id} failed - ${err.message}`)
    })

    queue.on('error', (error) => {
      console.error(`[queue] Error in ${name}:`, error)
    })
  })
}

/**
 * Close all queues
 */
export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()))
}

export default {
  queues,
  addJob,
  getQueueStats,
  scheduleRecurringJob,
  setupQueueHandlers,
  closeQueues,
}
