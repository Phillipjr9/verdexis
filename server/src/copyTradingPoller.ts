import { prisma } from '../db.js'
import { getCurrentCryptoPrice } from '../historicalPrice.js'

/**
 * Copy Trading Execution Poller
 * 
 * For each trader who places a trade, automatically execute the same trade
 * for all followers (scaled by allocation)
 */
export async function executePendingCopyTrades() {
  try {
    // Find all active copy relationships
    const relationships = await prisma.copyRelationship.findMany({
      where: { status: 'active' },
      include: {
        follower: { select: { id: true, walletBalances: true } },
      },
    })

    if (relationships.length === 0) return

    // For each active relationship, check if trader made new trades
    for (const rel of relationships) {
      try {
        // Get trader's recent trades not yet copied
        const traderRecentTrades = await prisma.trade.findMany({
          where: {
            userId: rel.traderId,
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        })

        // Filter trades that haven't been copied yet
        const tradesCopied = await prisma.copyTrade.findMany({
          where: {
            followerId: rel.followerId,
            traderId: rel.traderId,
          },
          select: { traderTradeId: true },
        })

        const copiedTradeIds = new Set(tradesCopied.map(ct => ct.traderTradeId))
        const newTrades = traderRecentTrades.filter(t => !copiedTradeIds.has(t.id))

        if (newTrades.length === 0) continue

        // Execute copies for follower
        for (const traderTrade of newTrades) {
          try {
            // Scale trade by allocation
            const scaledAmount = traderTrade.amount * (rel.allocationPercent / 100)
            const scaledTotal = scaledAmount * traderTrade.price

            // Check follower has sufficient USD balance
            const followerUSD = rel.follower.walletBalances?.find(wb => wb.currency === 'USD')
            if (!followerUSD || followerUSD.available < scaledTotal) {
              console.warn(`[copyTrading] Insufficient USD for follower ${rel.followerId}`)
              continue
            }

            // Execute copy trade in transaction
            await prisma.$transaction(async (tx) => {
              // Create copy trade record
              await tx.copyTrade.create({
                data: {
                  followerId: rel.followerId,
                  traderId: rel.traderId,
                  traderTradeId: traderTrade.id,
                  symbol: traderTrade.symbol,
                  side: traderTrade.side,
                  amount: scaledAmount,
                  price: traderTrade.price,
                  total: scaledTotal,
                  status: 'executed',
                },
              })

              // Update follower holdings
              const holding = await tx.holding.findUnique({
                where: {
                  userId_symbol: {
                    userId: rel.followerId,
                    symbol: traderTrade.symbol,
                  },
                },
              })

              if (traderTrade.side === 'buy') {
                // Increase holding
                if (holding) {
                  const newAmount = holding.amount + scaledAmount
                  const newAvg =
                    (holding.avgPrice * holding.amount + traderTrade.price * scaledAmount) / newAmount
                  await tx.holding.update({
                    where: { id: holding.id },
                    data: { amount: newAmount, avgPrice: newAvg },
                  })
                } else {
                  await tx.holding.create({
                    data: {
                      userId: rel.followerId,
                      symbol: traderTrade.symbol,
                      name: traderTrade.symbol,
                      amount: scaledAmount,
                      avgPrice: traderTrade.price,
                      type: 'crypto',
                    },
                  })
                }

                // Deduct USD
                await tx.walletBalance.update({
                  where: {
                    userId_currency: {
                      userId: rel.followerId,
                      currency: 'USD',
                    },
                  },
                  data: {
                    balance: { decrement: scaledTotal },
                    available: { decrement: scaledTotal },
                  },
                })
              } else {
                // Sell
                if (!holding || holding.amount < scaledAmount) {
                  throw new Error('Insufficient holding to copy sell')
                }

                const remaining = holding.amount - scaledAmount
                if (remaining === 0) {
                  await tx.holding.delete({ where: { id: holding.id } })
                } else {
                  await tx.holding.update({
                    where: { id: holding.id },
                    data: { amount: remaining },
                  })
                }

                // Credit USD
                await tx.walletBalance.update({
                  where: {
                    userId_currency: {
                      userId: rel.followerId,
                      currency: 'USD',
                    },
                  },
                  data: {
                    balance: { increment: scaledTotal },
                    available: { increment: scaledTotal },
                  },
                })
              }

              // Update relationship stats
              await tx.copyRelationship.update({
                where: { id: rel.id },
                data: {
                  copyCount: { increment: 1 },
                  totalCopied: { increment: scaledTotal },
                },
              })
            })

            console.log(
              `[copyTrading] Copied ${traderTrade.symbol} ${traderTrade.side} for follower ${rel.followerId}`
            )
          } catch (err) {
            console.error(`[copyTrading] Error copying trade ${traderTrade.id}:`, err)
          }
        }
      } catch (err) {
        console.error(`[copyTrading] Error processing relationship ${rel.id}:`, err)
      }
    }
  } catch (err) {
    console.error('[copyTrading] Poller error:', err)
  }
}

export function startCopyTradingPoller(opts: { intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 5_000 // Check every 5 seconds

  console.log(`[copyTrading] Starting copy trading poller (interval: ${intervalMs}ms)`)

  const poll = async () => {
    await executePendingCopyTrades()
  }

  // Run on interval
  const intervalId = setInterval(poll, intervalMs)

  // Return cleanup
  return () => {
    clearInterval(intervalId)
    console.log('[copyTrading] Stopped')
  }
}
