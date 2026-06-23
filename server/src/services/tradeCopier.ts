import { prisma } from '../db.js'
import { EventEmitter } from 'events'

class TradeCopier extends EventEmitter {
  private isRunning = false
  private lastCheckTime = new Date()
  private pollInterval = 2000 // 2 seconds

  start() {
    if (this.isRunning) return
    this.isRunning = true
    console.log('[trade-copier] Started')
    this.poll()
  }

  stop() {
    this.isRunning = false
    console.log('[trade-copier] Stopped')
  }

  private async poll() {
    if (!this.isRunning) return

    try {
      const trades = await prisma.trade.findMany({
        where: {
          createdAt: {
            gt: this.lastCheckTime,
          },
        },
        include: {
          user: true,
        },
      })

      this.lastCheckTime = new Date()

      for (const trade of trades) {
        await this.processTraderTrade(trade)
      }
    } catch (err) {
      console.error('[trade-copier] Poll error:', err)
    }

    // Schedule next poll
    if (this.isRunning) {
      setTimeout(() => this.poll(), this.pollInterval)
    }
  }

  private async processTraderTrade(trade: any) {
    try {
      // Find all followers copying this trader
      const relationships = await prisma.copyRelationship.findMany({
        where: {
          traderId: trade.userId,
          status: 'active',
        },
        include: {
          follower: {
            select: {
              id: true,
            },
          },
        },
      })

      if (relationships.length === 0) return

      console.log(`[trade-copier] Found ${relationships.length} followers for trader ${trade.userId}`)

      // Copy trade for each follower
      for (const rel of relationships) {
        await this.copyTradeForFollower(trade, rel)
      }
    } catch (err) {
      console.error('[trade-copier] Error processing trader trade:', err)
    }
  }

  private async copyTradeForFollower(
    traderTrade: any,
    relationship: any
  ): Promise<void> {
    const followerId = relationship.follower.id

    try {
      // Calculate follower's allocation based on their allocation amount
      const followerAllocation = relationship.allocationUsd
      const followerAmount = (followerAllocation / 100) * traderTrade.amount

      if (followerAmount <= 0) {
        console.warn(`[trade-copier] Invalid follower amount for ${followerId}: ${followerAmount}`)
        return
      }

      // Check if follower has sufficient balance
      const followerWallet = await prisma.walletBalance.findUnique({
        where: {
          userId_currency: {
            userId: followerId,
            currency: 'USD',
          },
        },
      })

      if (!followerWallet || followerWallet.available < traderTrade.total) {
        console.warn(
          `[trade-copier] Insufficient balance for ${followerId}. Available: ${followerWallet?.available || 0}, Need: ${traderTrade.total}`
        )
        return
      }

      // Execute the copy trade
      const copyTrade = await prisma.$transaction(async (tx) => {
        // Create copy trade record
        const created = await tx.copyTrade.create({
          data: {
            followerId,
            traderId: traderTrade.userId,
            traderTradeId: traderTrade.id,
            symbol: traderTrade.symbol,
            side: traderTrade.side,
            amount: followerAmount,
            price: traderTrade.price,
            total: followerAmount * traderTrade.price,
            status: 'executed',
          },
        })

        // Update follower's holding
        const holding = await tx.holding.findUnique({
          where: {
            userId_symbol: {
              userId: followerId,
              symbol: traderTrade.symbol,
            },
          },
        })

        if (traderTrade.side === 'buy') {
          if (holding) {
            const newAmount = holding.amount + followerAmount
            const newAvgPrice = (holding.avgPrice * holding.amount + traderTrade.price * followerAmount) / newAmount
            await tx.holding.update({
              where: { id: holding.id },
              data: {
                amount: newAmount,
                avgPrice: newAvgPrice,
              },
            })
          } else {
            await tx.holding.create({
              data: {
                userId: followerId,
                symbol: traderTrade.symbol,
                name: traderTrade.symbol,
                amount: followerAmount,
                avgPrice: traderTrade.price,
                type: 'crypto',
              },
            })
          }

          // Deduct from USD balance
          await tx.walletBalance.update({
            where: {
              userId_currency: {
                userId: followerId,
                currency: 'USD',
              },
            },
            data: {
              balance: { decrement: followerAmount * traderTrade.price },
              available: { decrement: followerAmount * traderTrade.price },
            },
          })
        } else {
          // SELL
          if (holding && holding.amount >= followerAmount) {
            const newAmount = holding.amount - followerAmount
            if (newAmount === 0) {
              await tx.holding.delete({ where: { id: holding.id } })
            } else {
              await tx.holding.update({
                where: { id: holding.id },
                data: { amount: newAmount },
              })
            }

            // Add to USD balance
            await tx.walletBalance.update({
              where: {
                userId_currency: {
                  userId: followerId,
                  currency: 'USD',
                },
              },
              data: {
                balance: { increment: followerAmount * traderTrade.price },
                available: { increment: followerAmount * traderTrade.price },
              },
            })
          }
        }

        return created
      })

      // Update copy relationship stats
      await prisma.copyRelationship.update({
        where: { id: relationship.id },
        data: {
          copyCount: { increment: 1 },
          totalCopied: { increment: copyTrade.total },
        },
      })

      console.log(
        `[trade-copier] Copied trade for ${followerId}: ${traderTrade.side} ${followerAmount} ${traderTrade.symbol}`
      )
    } catch (err) {
      console.error(`[trade-copier] Error copying trade for follower ${followerId}:`, err)
    }
  }
}

export const tradeCopier = new TradeCopier()
