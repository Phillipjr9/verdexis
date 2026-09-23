import { prisma } from './db.js'

export async function generatePendingYieldRewards() {
  try {
    const now = new Date()

    const positions = await prisma.stakingPosition.findMany({
      where: { unstakedAt: null },
      include: { yieldRewards: { orderBy: { earnedAt: 'desc' }, take: 1 } },
    })

    if (positions.length === 0) return

    for (const position of positions) {
      try {
        const lastYield = position.yieldRewards[0]?.earnedAt
        let shouldGenerate = false

        if (!lastYield) {
          const dayOld = new Date(position.startedAt.getTime() + 24 * 60 * 60 * 1000)
          shouldGenerate = now >= dayOld
        } else {
          const daysSinceYield = (now.getTime() - lastYield.getTime()) / (24 * 60 * 60 * 1000)

          if (position.yieldFrequency === 'daily' && daysSinceYield >= 1) {
            shouldGenerate = true
          } else if (position.yieldFrequency === 'weekly' && daysSinceYield >= 7) {
            shouldGenerate = true
          } else if (position.yieldFrequency === 'monthly' && daysSinceYield >= 30) {
            shouldGenerate = true
          }
        }

        if (!shouldGenerate) continue

        const dailyRate = position.apy / 365 / 100
        const yieldAmount = position.amount * dailyRate

        await prisma.yieldReward.create({
          data: {
            userId: position.userId,
            stakingPositionId: position.id,
            amount: yieldAmount,
            asset: position.asset,
            earnedAt: now,
          },
        })

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
  const intervalMs = opts.intervalMs ?? 60_000

  console.log(`[stakingYield] Starting staking yield poller (interval: ${intervalMs}ms)`)

  const poll = async () => {
    await generatePendingYieldRewards()
  }

  void poll().catch((err) => console.error('[stakingYield] Initial poll failed:', err))

  const intervalId = setInterval(() => { void poll() }, intervalMs)
  if (typeof intervalId === 'object' && intervalId && 'unref' in intervalId) intervalId.unref()

  return () => {
    clearInterval(intervalId)
    console.log('[stakingYield] Stopped')
  }
}
