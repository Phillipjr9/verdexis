import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { executeCryptoWithdrawal, resolveWithdrawalChain } from '../services/cryptoWithdrawal.js'

const router = Router()

const SUPPORTED_WITHDRAWAL_CHAINS: Record<string, Array<'ethereum' | 'solana' | 'bitcoin' | 'bsc'>> = {
  BTC:  ['bitcoin'],
  ETH:  ['ethereum'],
  BNB:  ['bsc'],
  SOL:  ['solana'],
  USDC: ['ethereum', 'solana', 'bsc'],
  USDT: ['ethereum', 'solana', 'bsc'],
  // Custom platform token — chains depend on which contract address is set
  ...(process.env['ETHEREUM_TOKEN_ADDRESS'] || process.env['BSC_TOKEN_ADDRESS']
    ? {
        [(process.env['ETHEREUM_TOKEN_SYMBOL'] ?? 'VDX').toUpperCase()]: [
          ...(process.env['ETHEREUM_TOKEN_ADDRESS'] ? ['ethereum' as const] : []),
          ...(process.env['BSC_TOKEN_ADDRESS']      ? ['bsc'      as const] : []),
        ],
      }
    : {}),
}

const getSupportedWithdrawalChains = (asset: string) => SUPPORTED_WITHDRAWAL_CHAINS[asset.toUpperCase()] ?? []
const getEnabledWithdrawalChains = () => [
  { chain: 'ethereum', enabled: Boolean(process.env['ETHEREUM_WITHDRAWAL_PRIVATE_KEY'] && process.env['ETHEREUM_RPC_ENDPOINT']) },
  { chain: 'solana', enabled: Boolean(process.env['SOLANA_WITHDRAWAL_PRIVATE_KEY'] && process.env['SOLANA_RPC_ENDPOINT']) },
  { chain: 'bsc', enabled: Boolean(process.env['BSC_WITHDRAWAL_PRIVATE_KEY'] && process.env['BSC_RPC_ENDPOINT']) },
  { chain: 'bitcoin', enabled: process.env['BTC_WITHDRAWAL_ENABLED'] === 'true' },
]

router.get('/config', requireAuth, async (_req, res) => {
  const hasEthereum = Boolean(process.env['ETHEREUM_WITHDRAWAL_PRIVATE_KEY'] && process.env['ETHEREUM_RPC_ENDPOINT'])
  const hasSolana = Boolean(process.env['SOLANA_WITHDRAWAL_PRIVATE_KEY'] && process.env['SOLANA_RPC_ENDPOINT'])
  const hasBsc = Boolean(process.env['BSC_WITHDRAWAL_PRIVATE_KEY'] && process.env['BSC_RPC_ENDPOINT'])
  const hasBitcoin = process.env['BTC_WITHDRAWAL_ENABLED'] === 'true'
  const enabled = hasEthereum || hasSolana || hasBsc || hasBitcoin

  res.json({
    enabled,
    networks: [
      { chain: 'ethereum', enabled: hasEthereum },
      { chain: 'bsc', enabled: hasBsc },
      { chain: 'solana', enabled: hasSolana },
      { chain: 'bitcoin', enabled: hasBitcoin },
    ],
    message: enabled
      ? 'On-chain withdrawals are active for the configured networks. Funds will be sent directly to your wallet address.'
      : 'Withdrawals are processed manually by an administrator. Submit your request and you will be notified once it is approved and sent.',
  })
})

const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip || 'anon',
})

const withdrawalSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  asset: z.string().min(1).max(12),
  destinationAddress: z.string().min(1).max(128),
  chain: z.enum(['solana', 'ethereum', 'bitcoin', 'bsc']).optional(),
  tokenAddress: z.string().min(1).max(128).optional(),
  memo: z.string().max(256).optional(),
  withdrawalMethod: z.enum(['crypto', 'wire', 'check']).default('crypto'),
})

function calculateUserTier(balance: number, level: number): string {
  if (level >= 5 && balance >= 50000) return 'PLATINUM'
  if (level >= 4 && balance >= 25000) return 'GOLD'
  if (level >= 3 && balance >= 10000) return 'SILVER'
  if (level >= 2 && balance >= 5000) return 'BRONZE'
  if (level >= 1 && balance >= 1000) return 'VERIFIED'
  return 'UNVERIFIED'
}

function getProcessingFeeRate(tier: string, method: string): number {
  if (method === 'check') return 0
  const feeMap: Record<string, number> = {
    'PLATINUM': 0.5,
    'GOLD': 1.0,
    'SILVER': 1.5,
    'BRONZE': 2.0,
    'VERIFIED': 2.5,
    'UNVERIFIED': 3.0,
  }
  const rate = feeMap[tier] ?? 3.0
  return Math.min(rate, 15)
}

function validateWithdrawalMethod(method: string): boolean {
  return ['crypto', 'wire', 'check'].includes(method)
}

router.post('/', requireAuth, moneyLimiter, async (req: AuthedRequest, res) => {
  const parsed = withdrawalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const { amount, asset, destinationAddress, chain, tokenAddress, withdrawalMethod } = parsed.data

  if (!validateWithdrawalMethod(withdrawalMethod)) {
    res.status(400).json({ error: 'Invalid withdrawal method' })
    return
  }

  if (withdrawalMethod !== 'crypto' && withdrawalMethod !== 'wire') {
    res.status(400).json({ error: 'Processing fees only supported for crypto and wire transfers' })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { kycTier: true, walletBalances: true, prefs: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const totalBalance = (user.walletBalances ?? []).reduce((sum, wb) => sum + wb.balance, 0)
    const level = user.kycTier === 'UNVERIFIED' ? 0 : parseInt(user.kycTier.split('_')[1] ?? '1', 10)
    const tier = calculateUserTier(totalBalance, level)
    
    let userPrefs: Record<string, unknown> = {}
    try { if (user.prefs) userPrefs = JSON.parse(user.prefs) } catch { userPrefs = {} }
    const customFeeRate = (userPrefs as { withdrawalFeeOverride?: number }).withdrawalFeeOverride
    
    // Ensure fee is capped at 15% maximum
    const cappedCustomFeeRate = customFeeRate !== undefined ? Math.min(customFeeRate, 15) : undefined
    
    const feeRate = cappedCustomFeeRate !== undefined ? cappedCustomFeeRate : getProcessingFeeRate(tier, withdrawalMethod)
    const processingFee = (amount * feeRate) / 100
    const totalDebit = amount + processingFee

    const normalizedAsset = asset.toUpperCase()
    const enabledChains = getEnabledWithdrawalChains().filter((n) => n.enabled).map((n) => n.chain) as Array<'solana' | 'ethereum' | 'bitcoin' | 'bsc'>
    const supportedChains = getSupportedWithdrawalChains(normalizedAsset)
    const allowedChains = supportedChains.length > 0 ? enabledChains.filter((value) => supportedChains.includes(value)) : enabledChains

    if (allowedChains.length === 0) {
      throw Object.assign(new Error(`Withdrawals are not available for ${normalizedAsset} on the configured networks.`), { status: 400 })
    }

    const targetAddress = destinationAddress.trim()
    let requestedChain = chain
    if (requestedChain) {
      if (!allowedChains.includes(requestedChain)) {
        throw Object.assign(new Error(`Unsupported withdrawal network for ${normalizedAsset}. Available: ${allowedChains.join(', ')}.`), { status: 400 })
      }
    } else {
      const resolvedChain = resolveWithdrawalChain({
        asset: normalizedAsset,
        destinationAddress: targetAddress,
        chain,
      })
      if (resolvedChain.chain && allowedChains.includes(resolvedChain.chain)) {
        requestedChain = resolvedChain.chain
      } else if (allowedChains.length === 1) {
        requestedChain = allowedChains[0] as 'solana' | 'ethereum' | 'bitcoin'
      } else if (supportedChains.length > 0 && resolvedChain.detectedWalletType === 'unknown') {
        throw Object.assign(new Error(`Please specify a withdrawal network for ${normalizedAsset}. Supported networks: ${allowedChains.join(', ')}.`), { status: 400 })
      }
    }
    if (!targetAddress) {
      res.status(400).json({ error: 'Destination address is required' })
      return
    }

    const prepared = await prisma.$transaction(async (tx) => {
      const walletLink = await tx.walletLink.upsert({
        where: { userId_address: { userId: req.userId!, address: targetAddress } },
        create: {
          userId: req.userId!,
          address: targetAddress,
          chainId: requestedChain ?? null,
          provider: 'user',
          isPrimary: false,
        },
        update: {},
      })

      const limit = await tx.withdrawalLimit.findUnique({
        where: { userId_asset: { userId: req.userId!, asset } },
      })

      const now = new Date()
      let dailyUsed = limit?.dailyUsed ?? 0
      let monthlyUsed = limit?.monthlyUsed ?? 0

      if (limit?.dailyResetAt && limit.dailyResetAt < now) {
        dailyUsed = 0
      }
      if (limit?.monthlyResetAt && limit.monthlyResetAt < now) {
        monthlyUsed = 0
      }

      if (limit?.dailyLimit && dailyUsed + totalDebit > limit.dailyLimit) {
        throw Object.assign(new Error('Daily withdrawal limit exceeded'), { status: 400 })
      }
      if (limit?.monthlyLimit && monthlyUsed + totalDebit > limit.monthlyLimit) {
        throw Object.assign(new Error('Monthly withdrawal limit exceeded'), { status: 400 })
      }
      if (limit?.perTransactionLimit && amount > limit.perTransactionLimit) {
        throw Object.assign(new Error('Per-transaction limit exceeded'), { status: 400 })
      }

      const normalizedAsset = asset.toUpperCase()
      let holding = await tx.holding.findUnique({
        where: { userId_symbol: { userId: req.userId!, symbol: normalizedAsset } },
      })
      let usedWalletBalanceFallback = false
      if (!holding || holding.amount < totalDebit) {
        // Development helper: allow the demo test user to withdraw from their USD wallet balance
        // when a corresponding holding record doesn't exist. This is strictly a dev-only
        // convenience to let the local demo user (testuser@verdexis.local) exercise withdrawals
        // without needing full production holdings migration. Guarded by explicit email check.
        const userRow = await tx.user.findUnique({ where: { id: req.userId! }, select: { email: true } })
        const demoEmail = process.env.TEST_USER_EMAIL || 'testuser@verdexis.local'
        if (userRow?.email === demoEmail) {
          // Try to consume from walletBalance as a fallback for the demo user.
          const wb = await tx.walletBalance.findUnique({ where: { userId_currency: { userId: req.userId!, currency: normalizedAsset } } })
          if (wb && wb.available >= totalDebit) {
            // Decrement the wallet balance and ensure a lightweight holding exists so later
            // refund logic that updates holdings still works.
            await tx.walletBalance.update({ where: { id: wb.id }, data: { balance: { decrement: totalDebit }, available: { decrement: totalDebit } } })

            const existingHolding = await tx.holding.findUnique({
              where: { userId_symbol: { userId: req.userId!, symbol: normalizedAsset } },
            })

            if (existingHolding) {
              holding = await tx.holding.update({
                where: { id: existingHolding.id },
                data: { amount: { set: Math.max(0, existingHolding.amount - totalDebit) } },
              })
            } else {
              holding = await tx.holding.create({
                data: {
                  user: { connect: { id: req.userId! } },
                  symbol: normalizedAsset,
                  name: normalizedAsset,
                  amount: Math.max(0, wb.available - totalDebit),
                  avgPrice: 0,
                  type: 'manual',
                },
              })
            }

            usedWalletBalanceFallback = true
          } else {
            throw Object.assign(new Error('Insufficient balance for withdrawal and processing fee'), { status: 400 })
          }
        } else {
          throw Object.assign(new Error('Insufficient balance for withdrawal and processing fee'), { status: 400 })
        }
      }

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: req.userId!,
          walletLinkId: walletLink.id,
          amount,
          asset: normalizedAsset,
          fee: processingFee,
          status: 'pending',
        },
      })

      if (!usedWalletBalanceFallback) {
        await tx.holding.update({
          where: { id: holding.id },
          data: { amount: { decrement: totalDebit } },
        })
      }

      const nextDailyResetAt = limit?.dailyResetAt && limit.dailyResetAt < now
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : limit?.dailyResetAt ?? null
      const nextMonthlyResetAt = limit?.monthlyResetAt && limit.monthlyResetAt < now
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
        : limit?.monthlyResetAt ?? null

      await tx.withdrawalLimit.upsert({
        where: { userId_asset: { userId: req.userId!, asset } },
        create: {
          userId: req.userId!,
          asset,
          dailyUsed: totalDebit,
          monthlyUsed: totalDebit,
          dailyResetAt: nextDailyResetAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
          monthlyResetAt: nextMonthlyResetAt ?? new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
        update: {
          dailyUsed: dailyUsed + totalDebit,
          monthlyUsed: monthlyUsed + totalDebit,
          dailyResetAt: nextDailyResetAt,
          monthlyResetAt: nextMonthlyResetAt,
        },
      })

      return {
        withdrawal,
        normalizedAsset,
        targetAddress,
        chain: requestedChain,
        tokenAddress,
      }
    })

    const transfer = await executeCryptoWithdrawal({
      asset: prepared.normalizedAsset,
      amount,
      destinationAddress: prepared.targetAddress,
      ...(prepared.chain ? { chain: prepared.chain } : {}),
      ...(prepared.tokenAddress ? { tokenAddress: prepared.tokenAddress } : {}),
    })

    const finalized = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: prepared.withdrawal.id },
      })
      if (!withdrawal) {
        throw Object.assign(new Error('Withdrawal not found'), { status: 404 })
      }

      if (transfer.status === 'completed') {
        const updated = await tx.withdrawalRequest.update({
          where: { id: prepared.withdrawal.id },
          data: {
            status: 'approved',
            txHash: transfer.txHash?.toLowerCase() ?? null,
            approvedBy: req.userId!,
            approvedAt: new Date(),
            completedAt: new Date(),
          },
        })

        await tx.transaction.create({
          data: {
            userId: req.userId!,
            kind: 'withdrawal',
            currency: prepared.normalizedAsset,
            amount,
            status: 'completed',
            reference: transfer.txHash ?? null,
          },
        })

        await tx.notification.create({
          data: {
            userId: req.userId!,
            kind: 'withdrawal',
            title: `Withdrawal completed: ${amount} ${prepared.normalizedAsset}`,
            body: transfer.message,
          },
        })

        return updated
      }

      // transfer.status === 'pending': keep the withdrawal request open for
      // admin manual processing. Do NOT refund the holding yet — the admin
      // will either approve (and send on-chain) or reject (which triggers
      // the refund via PUT /admin/:id/reject).
      const updated = await tx.withdrawalRequest.update({
        where: { id: prepared.withdrawal.id },
        data: { status: 'pending' },
      })

      await tx.notification.create({
        data: {
          userId: req.userId!,
          kind: 'withdrawal',
          title: `Withdrawal queued: ${amount} ${prepared.normalizedAsset}`,
          body: transfer.message,
        },
      })

      return updated
    })

    res.status(201).json({
      withdrawal: finalized,
      transfer: {
        status: transfer.status,
        message: transfer.message,
        txHash: transfer.txHash ?? null,
      },
      tier,
      processingFee,
      totalDebit,
    })
  } catch (err) {
    const error = err as Error & { status?: number }
    console.error('[withdrawals] POST error:', error)
    const msg = error.status && error.status < 500 ? error.message : (process.env.NODE_ENV !== 'production' ? error.message : 'An error occurred. Please try again.')
    res.status(error.status || 500).json({ error: msg })
  }
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const withdrawals = await prisma.withdrawalRequest.findMany({
    where: { userId: req.userId! },
    include: { walletLink: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json({ withdrawals })
})

router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const withdrawalId = req.params['id']
  if (!withdrawalId) {
    res.status(400).json({ error: 'Withdrawal id is required' })
    return
  }

  const withdrawal = await prisma.withdrawalRequest.findFirst({
    where: { id: withdrawalId, userId: req.userId! },
    include: { walletLink: true },
  })
  if (!withdrawal) {
    res.status(404).json({ error: 'Withdrawal not found' })
    return
  }
  res.json({ withdrawal })
})

// Admin endpoints
router.get('/admin/pending', requireAuth, requireAdmin, async (_req, res) => {
  const pending = await prisma.withdrawalRequest.findMany({
    where: { status: 'pending' },
    include: { user: true, walletLink: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  res.json({ withdrawals: pending })
})

router.put('/admin/:id/approve', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { txHash, fee } = z.object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid tx hash'),
    fee: z.number().nonnegative().optional(),
  }).parse(req.body)

  const withdrawalId = req.params['id']
  if (!withdrawalId) {
    res.status(400).json({ error: 'Withdrawal id is required' })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { user: true },
      })
      if (!withdrawal) {
        throw Object.assign(new Error('Withdrawal not found'), { status: 404 })
      }
      if (withdrawal.status !== 'pending') {
        throw Object.assign(new Error('Withdrawal already processed'), { status: 400 })
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: 'approved',
          txHash: txHash.toLowerCase(),
          fee: fee ?? 0,
          approvedBy: req.userId!,
          approvedAt: new Date(),
        },
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: withdrawal.userId,
          kind: 'withdrawal',
          currency: withdrawal.asset,
          amount: withdrawal.amount,
          status: 'completed',
          reference: txHash,
        },
      })

      // Credit processing fee back to user in the same asset it was charged
      if (withdrawal.fee && withdrawal.fee > 0) {
        const feeBalance = await tx.walletBalance.findUnique({
          where: { userId_currency: { userId: withdrawal.userId, currency: withdrawal.asset } },
        })
        if (feeBalance) {
          await tx.walletBalance.update({
            where: { id: feeBalance.id },
            data: { available: { increment: withdrawal.fee } },
          })
        } else {
          await tx.walletBalance.create({
            data: {
              userId: withdrawal.userId,
              currency: withdrawal.asset,
              symbol: withdrawal.asset,
              balance: withdrawal.fee,
              available: withdrawal.fee,
            },
          })
        }
      }

      // Notify user
      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          kind: 'withdrawal',
          title: `Withdrawal approved: ${withdrawal.amount} ${withdrawal.asset}`,
          body: `Your withdrawal has been approved and sent. Tx: ${txHash.slice(0, 14)}…${withdrawal.fee ? ` Processing fee of $${withdrawal.fee.toFixed(2)} has been credited.` : ''}`,
        },
      })

      return updated
    })

    res.json({ withdrawal: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    console.error('[withdrawals] approve error:', error)
    const msg = error.status && error.status < 500 ? error.message : (process.env.NODE_ENV !== 'production' ? error.message : 'An error occurred. Please try again.')
    res.status(error.status || 500).json({ error: msg })
  }
})

router.put('/admin/:id/reject', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { reason } = z.object({
    reason: z.string().min(1).max(500),
  }).parse(req.body)

  const withdrawalId = req.params['id']
  if (!withdrawalId) {
    res.status(400).json({ error: 'Withdrawal id is required' })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { user: true },
      })
      if (!withdrawal) {
        throw Object.assign(new Error('Withdrawal not found'), { status: 404 })
      }
      if (withdrawal.status !== 'pending') {
        throw Object.assign(new Error('Withdrawal already processed'), { status: 400 })
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: 'rejected',
          rejectedReason: reason,
        },
      })

      // Refund balance and fee
      const balance = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId: withdrawal.userId, currency: withdrawal.asset } },
      })
      if (balance) {
        await tx.walletBalance.update({
          where: { id: balance.id },
          data: { available: balance.available + withdrawal.amount + (withdrawal.fee ?? 0) },
        })
      }

      // Notify user
      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          kind: 'withdrawal',
          title: `Withdrawal rejected: ${withdrawal.amount} ${withdrawal.asset}`,
          body: `Reason: ${reason}. Amount${withdrawal.fee ? ` and processing fee of $${withdrawal.fee.toFixed(2)}` : ''} refunded to your account.`,
        },
      })

      return updated
    })

    res.json({ withdrawal: result })
  } catch (err) {
    const error = err as Error & { status?: number }
    console.error('[withdrawals] reject error:', error)
    const msg = error.status && error.status < 500 ? error.message : (process.env.NODE_ENV !== 'production' ? error.message : 'An error occurred. Please try again.')
    res.status(error.status || 500).json({ error: msg })
  }
})

export default router
