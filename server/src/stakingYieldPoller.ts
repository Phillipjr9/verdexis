import { prisma } from '../db.js'

/**
 * Staking Yield Poller
 * 
 * Automatically generates and credits yield rewards for active staking positions
 * Based on APY and yield frequency (daily, weekly, monthly)
 */
export async function generatePendingYieldRewards() {
  try {
    const now = new Date()
    
    // Find all active staking positions
    const positions = await prisma.stakingPosition.findMany({
      where: { unstakedAt: null },
      include: { yieldRewards: { orderBy: { earnedAt: 'desc' }, take: 1 } },
    })

    if (positions.length === 0) return

    for (const position of positions) {
      try {
        // Check if yield should be generated based on frequency
        const lastYield = position.yieldRewards[0]?.earnedAt
        let shouldGenerate = false
        let description = ''

        if (!lastYield) {
          // First yield - generate after 1 day
          const dayOld = new Date(position.startedAt.getTime() + 24 * 60 * 60 * 1000)
          shouldGenerate = now >= dayOld
          description = 'First daily yield'
        } else {
          const daysSinceYield = (now.getTime() - lastYield.getTime()) / (24 * 60 * 60 * 1000)
          
          if (position.yieldFrequency === 'daily' && daysSinceYield >= 1) {
            shouldGenerate = true
            description = 'Daily yield'
          } else if (position.yieldFrequency === 'weekly' && daysSinceYield >= 7) {
            shouldGenerate = true
            description = 'Weekly yield'
          } else if (position.yieldFrequency === 'monthly' && daysSinceYield >= 30) {
            shouldGenerate = true
            description = 'Monthly yield'
          }
        }

        if (!shouldGenerate) continue

        // Calculate yield amount
        const dailyRate = position.apy / 365 / 100
        const yieldAmount = position.amount * dailyRate

        // Create yield reward
        const reward = await prisma.yieldReward.create({
          data: {
            userId: position.userId,
            stakingPositionId: position.id,
            amount: yieldAmount,
            asset: position.asset,
            earnedAt: now,
          },
        })

        // Update position total
        await prisma.stakingPosition.update({
          where: { id: position.id },
          data: {
            totalYieldEarned: {
              increment: yieldAmount,
            },
          },
        })

        console.log(`[stakingYield] Generated ${yieldAmount} ${position.asset} for user ${position.userId}`)
      } catch (err) {
        console.error(`[stakingYield] Error processing position ${position.id}:`, err)
      }
    }
  } catch (err) {
    console.error('[stakingYield] Poller error:', err)
  }
}

export function startStakingYieldPoller(opts: { intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 60_000 // Check every minute

  console.log(`[stakingYield] Starting staking yield poller (interval: ${intervalMs}ms)`)

  const poll = async () => {
    await generatePendingYieldRewards()
  }

  // Run on interval
  const intervalId = setInterval(poll, intervalMs)

  // Return cleanup
  return () => {
    clearInterval(intervalId)
    console.log('[stakingYield] Stopped')
  }
}
