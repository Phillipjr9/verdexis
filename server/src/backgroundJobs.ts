import { prisma } from './db.js'
import { trackPriceHistory, checkPriceAlerts } from './priceService.js'

export async function distributeYieldRewards(): Promise<void> {
  try {
    const positions = await prisma.stakingPosition.findMany({
      where: { unstakedAt: null },
    })

    for (const position of positions) {
      // Calculate daily yield
      const dailyYield = (position.amount * position.apy) / 365 / 100

      // Create yield reward
      await prisma.yieldReward.create({
        data: {
          userId: position.userId,
          stakingPositionId: position.id,
          amount: dailyYield,
          asset: position.asset,
        },
      })

      // Update total yield earned
      await prisma.stakingPosition.update({
        where: { id: position.id },
        data: {
          totalYieldEarned: position.totalYieldEarned + dailyYield,
        },
      })
    }

    console.log(`[yield-service] Distributed yield to ${positions.length} positions`)
  } catch (error) {
    console.error('[yield-service] Error distributing yield:', error)
  }
}

export async function resetLimitCounters(): Promise<void> {
  try {
    const now = new Date()

    // Reset daily limits
    await prisma.depositLimit.updateMany({
      where: {
        dailyResetAt: { lte: now },
      },
      data: {
        dailyUsed: 0,
        dailyResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    })

    await prisma.withdrawalLimit.updateMany({
      where: {
        dailyResetAt: { lte: now },
      },
      data: {
        dailyUsed: 0,
        dailyResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    })

    // Reset monthly limits
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    await prisma.depositLimit.updateMany({
      where: {
        monthlyResetAt: { lte: now },
      },
      data: {
        monthlyUsed: 0,
        monthlyResetAt: nextMonth,
      },
    })

    await prisma.withdrawalLimit.updateMany({
      where: {
        monthlyResetAt: { lte: now },
      },
      data: {
        monthlyUsed: 0,
        monthlyResetAt: nextMonth,
      },
    })

    console.log('[limit-service] Reset limit counters')
  } catch (error) {
    console.error('[limit-service] Error resetting limits:', error)
  }
}

export async function cleanupExpiredVerifications(): Promise<void> {
  try {
    const now = new Date()

    const deleted = await prisma.walletVerification.deleteMany({
      where: {
        expiresAt: { lte: now },
        verifiedAt: null,
      },
    })

    console.log(`[verification-service] Cleaned up ${deleted.count} expired verifications`)
  } catch (error) {
    console.error('[verification-service] Error cleaning up verifications:', error)
  }
}

export async function cleanupExpiredExports(): Promise<void> {
  try {
    const now = new Date()

    const deleted = await prisma.transactionExport.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    })

    console.log(`[export-service] Cleaned up ${deleted.count} expired exports`)
  } catch (error) {
    console.error('[export-service] Error cleaning up exports:', error)
  }
}

export function startBackgroundJobs(): void {
  // Distribute yield daily at 00:00 UTC
  const yieldInterval = setInterval(async () => {
    const now = new Date()
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      await distributeYieldRewards()
    }
  }, 60 * 1000) // Check every minute

  // Reset limits daily at 00:00 UTC
  const limitInterval = setInterval(async () => {
    const now = new Date()
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      await resetLimitCounters()
    }
  }, 60 * 1000)

  // Clean up expired verifications every hour
  const verificationInterval = setInterval(async () => {
    await cleanupExpiredVerifications()
  }, 60 * 60 * 1000)

  // Clean up expired exports every 6 hours
  const exportInterval = setInterval(async () => {
    await cleanupExpiredExports()
  }, 6 * 60 * 60 * 1000)

  // Track price history every hour
  const priceHistoryInterval = setInterval(async () => {
    await trackPriceHistory()
  }, 60 * 60 * 1000)

  // Check price alerts every 5 minutes
  const priceAlertInterval = setInterval(async () => {
    await checkPriceAlerts()
  }, 5 * 60 * 1000)

  console.log('[background-jobs] Started all background jobs')

  // Cleanup on exit
  process.on('exit', () => {
    clearInterval(yieldInterval)
    clearInterval(limitInterval)
    clearInterval(verificationInterval)
    clearInterval(exportInterval)
    clearInterval(priceHistoryInterval)
    clearInterval(priceAlertInterval)
  })
}
