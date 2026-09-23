import { prisma } from './db.js'

export async function executePendingCopyTrades() {
  try {
    const relationships = await prisma.copyRelationship.findMany({
      where: { status: 'active' },
      include: {
        follower: { select: { id: true, walletBalances: true } },
      },
    })

    if (relationships.length === 0) return

    for (const rel of relationships) {
      try {
        const traderRecentTrades = await prisma.trade.findMany({
          where: {
            userId: rel.traderId,
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        })

        const tradesCopied = await prisma.copyTrade.findMany({
          where: {
            followerId: rel.followerId,
            traderId: rel.traderId,
          },
          select: { traderTradeId: true },
        })

        const copiedTradeIds = new Set(tradesCopied.map((ct) => ct.traderTradeId))
        const newTrades = traderRecentTrades.filter((t) => !copiedTradeIds.has(t.id))
        if (newTrades.length === 0) continue

        for (const traderTrade of newTrades) {
          try {
            const scaledAmount = traderTrade.amount * (rel.allocationPercent / 100)
            const scaledTotal = scaledAmount * traderTrade.price

            const followerUSD = rel.follower.walletBalances?.find((wb) => wb.currency === 'USD')
            if (!followerUSD || followerUSD.available < scaledTotal) {
              console.warn(`[copyTrading] Insufficient USD for follower ${rel.followerId}`)
              continue
            }

            await prisma.$transaction(async (tx) => {
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

              const holding = await tx.holding.findUnique({
                where: {
                  userId_symbol: {
                    userId: rel.followerId,
                    symbol: traderTrade.symbol,
                  },
                },
              })

              if (traderTrade.side === 'buy') {
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

              await tx.copyRelationship.update({
                where: { id: rel.id },
                data: {
                  copyCount: { increment: 1 },
                  totalCopied: { increment: scaledTotal },
                },
              })
            })

            console.log(
              `[copyTrading] Copied ${traderTrade.symbol} ${traderTrade.side} for follower ${rel.followerId}`,
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
  const intervalMs = opts.intervalMs ?? 5_000

  console.log(`[copyTrading] Starting copy trading poller (interval: ${intervalMs}ms)`)

  const poll = async () => {
    await executePendingCopyTrades()
  }

  void poll().catch((err) => console.error('[copyTrading] Initial poll failed:', err))

  const intervalId = setInterval(() => { void poll() }, intervalMs)
  if (typeof intervalId === 'object' && intervalId && 'unref' in intervalId) intervalId.unref()

  return () => {
    clearInterval(intervalId)
    console.log('[copyTrading] Stopped')
  }
}
