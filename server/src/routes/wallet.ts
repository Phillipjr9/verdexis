import { Router } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import {
  mapBalances,
  clampTransactionLimit,
  normalizeEmail,
  evaluateTransferGate,
  buildTransferKeyBase,
  parseWithdrawalFeeRate,
  transferBodySchema,
} from './walletHelpers.js'
import { notifyPeerTransfer } from '../services/transferNotifications.js'

const router = Router()

function getIdempotencyKey(req: AuthedRequest): string | undefined {
  const raw = req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key']
  if (!raw) return undefined
  return Array.isArray(raw) ? raw[0] : String(raw)
}

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const isAdmin = req.userRole === 'admin'
  const ADMIN_USD = 1_000_000_000_000
  const adminBalances = () => [
    { currency: 'USD', symbol: '$', balance: ADMIN_USD, available: ADMIN_USD, locked: 0 },
  ]

  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms)),
    ])

  const sumBal = (bs: { balance?: number; available?: number }[]) =>
    bs.reduce((s, b) => s + (Number(b.available) || 0) + (Number(b.balance) || 0), 0)

  let balances: ReturnType<typeof mapBalances> = []
  let transactions: unknown[] = []

  try {
    const rows = await withTimeout(
      prisma.walletBalance.findMany({ where: { userId }, orderBy: { currency: 'asc' } }),
      8_000,
      'walletBalance',
    )
    balances = mapBalances(rows as any)
    if (isAdmin && sumBal(balances) === 0) balances = adminBalances()
  } catch (e) {
    console.warn('[wallet] balance load failed', e instanceof Error ? e.message : e)
    if (isAdmin) balances = adminBalances()
  }

  try {
    transactions = await withTimeout(
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      8_000,
      'transactions',
    )
  } catch {
    transactions = []
  }

  res.json({ balances, transactions })
})

router.get('/transactions', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const limit = clampTransactionLimit(req.query.limit)
  try {
    const rows = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    res.json({ transactions: rows })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/lookup-recipient', requireAuth, async (req: AuthedRequest, res) => {
  const email = normalizeEmail(req.body?.email ?? req.query?.email)
  if (!email) {
    res.status(400).json({ error: 'Email required' })
    return
  }
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, name: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: 'Lookup failed' })
  }
})

router.post('/transfer', requireAuth, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = transferBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const senderId = req.userId!
  const { recipientEmail, amount, currency, note } = parsed.data
  const emailNorm = normalizeEmail(recipientEmail)

  try {
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, email: true, name: true, suspended: true, holdActive: true, holdType: true },
      }),
      prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: 'insensitive' } },
        select: { id: true, email: true, name: true, suspended: true },
      }),
    ])

    const srcBal = await prisma.walletBalance.findUnique({
      where: { userId_currency: { userId: senderId, currency } },
    })
    const available = srcBal ? Number(srcBal.available) : 0

    const gate = evaluateTransferGate({
      senderId,
      sender,
      recipient,
      amount,
      available,
    })
    if (gate.ok === false) {
      res.status(gate.status).json({ error: gate.error })
      return
    }

    const toUserId = recipient!.id
    const symbol = currency === 'USD' ? '$' : currency
    const outRef = `Transfer to ${recipient!.email}${note ? ' — ' + note : ''}`
    const inRef = `Transfer from ${sender!.email}${note ? ' — ' + note : ''}`
    const clientKey = getIdempotencyKey(req)
    const opKey = buildTransferKeyBase({
      clientKey,
      senderId,
      recipientId: toUserId,
      currency,
      amount,
      uuid: crypto.randomUUID(),
    })

    const { generateTransactionId } = await import('../utils/transactionIdGenerator.js')

    const result = await prisma.$transaction(async (tx) => {
      const src = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId: senderId, currency } },
      })
      const srcBalance = src ? Number(src.balance) : 0
      const srcAvail = src ? Number(src.available) : 0
      if (srcAvail < amount) {
        throw Object.assign(new Error('Insufficient available balance'), { status: 400 })
      }
      const nextSrcBal = srcBalance - amount
      const nextSrcAvail = srcAvail - amount
      const fromWallet = await tx.walletBalance.upsert({
        where: { userId_currency: { userId: senderId, currency } },
        create: {
          userId: senderId, currency, symbol,
          balance: nextSrcBal, available: nextSrcAvail,
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
        },
        update: {
          balance: nextSrcBal, available: nextSrcAvail,
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
          symbol,
        },
      })

      const dst = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId: toUserId, currency } },
      })
      const dstBal = dst ? Number(dst.balance) : 0
      const dstAvail = dst ? Number(dst.available) : 0
      const nextDstBal = dstBal + amount
      const nextDstAvail = dstAvail + amount
      const toWallet = await tx.walletBalance.upsert({
        where: { userId_currency: { userId: toUserId, currency } },
        create: {
          userId: toUserId, currency, symbol,
          balance: nextDstBal, available: nextDstAvail,
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
        },
        update: {
          balance: nextDstBal, available: nextDstAvail,
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
          symbol,
        },
      })

      await tx.accountBalance.upsert({
        where: { userId_asset: { userId: senderId, asset: currency } },
        create: {
          userId: senderId, asset: currency,
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
          lockedMinorUnits: 0n,
        },
        update: {
          balanceMinorUnits: BigInt(Math.round(nextSrcBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextSrcAvail * 100)),
        },
      }).catch(() => null)

      await tx.accountBalance.upsert({
        where: { userId_asset: { userId: toUserId, asset: currency } },
        create: {
          userId: toUserId, asset: currency,
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
          lockedMinorUnits: 0n,
        },
        update: {
          balanceMinorUnits: BigInt(Math.round(nextDstBal * 100)),
          availableMinorUnits: BigInt(Math.round(nextDstAvail * 100)),
        },
      }).catch(() => null)

      const fromTx = await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(),
          userId: senderId,
          kind: 'transfer',
          currency,
          amount: -amount,
          status: 'completed',
          reference: outRef,
          subType: 'user_transfer',
        } as any,
      })
      const toTx = await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(),
          userId: toUserId,
          kind: 'transfer',
          currency,
          amount,
          status: 'completed',
          reference: inRef,
          subType: 'user_transfer',
        } as any,
      })

      return {
        fromBalance: fromWallet,
        toBalance: toWallet,
        fromTx,
        toTx,
        amount,
        currency,
        operationKey: opKey,
      }
    })

    await notifyPeerTransfer({
      sender: { id: sender!.id, email: sender!.email, name: sender!.name },
      recipient: { id: recipient!.id, email: recipient!.email, name: recipient!.name },
      amount,
      currency,
      note: note || null,
    }).catch((e) => console.warn('[wallet] transfer notify failed', e))

    res.status(201).json({
      ok: true,
      amount: result.amount,
      currency: result.currency,
      fromAvailable: Number(result.fromBalance.available),
      toUser: { id: recipient!.id, email: recipient!.email, name: recipient!.name },
      debitTransactionId: result.fromTx.transactionId,
      creditTransactionId: result.toTx.transactionId,
    })
  } catch (e) {
    const err = e as { status?: number; message?: string }
    if (err?.status === 400) {
      res.status(400).json({ error: err.message || 'Transfer failed' })
      return
    }
    console.error('[wallet] transfer', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Transfer failed' })
  }
})

router.get('/saved-wallet', requireAuth, async (_req, res) => {
  res.json({ savedWallet: null })
})

router.get('/links', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!
  try {
    const links = await prisma.walletLink.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'desc' }],
    })
    res.json({ links })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/link', requireAuth, async (req: AuthedRequest, res) => {
  res.status(501).json({ error: 'Wallet link not available in this build' })
})

router.delete('/links/:id', requireAuth, async (req: AuthedRequest, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/links/:id/primary', requireAuth, async (req: AuthedRequest, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/convert', requireAuth, idempotency(), async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const fromCurrency = String(req.body?.fromCurrency || '').toUpperCase()
  const toCurrency = String(req.body?.toCurrency || '').toUpperCase()
  const fromAmount = Number(req.body?.fromAmount)
  const toAmount = Number(req.body?.toAmount)
  if (!fromCurrency || !toCurrency || !(fromAmount > 0) || !(toAmount > 0)) {
    res.status(400).json({ error: 'fromCurrency, toCurrency, fromAmount, toAmount required' })
    return
  }
  try {
    await prisma.$transaction(async (tx) => {
      const src = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId, currency: fromCurrency } },
      })
      const srcAvail = Number(src?.available ?? 0)
      if (srcAvail < fromAmount) {
        throw Object.assign(new Error(`Insufficient ${fromCurrency}`), { status: 400 })
      }
      await tx.walletBalance.update({
        where: { userId_currency: { userId, currency: fromCurrency } },
        data: {
          balance: Math.max(0, Number(src?.balance ?? 0) - fromAmount),
          available: Math.max(0, srcAvail - fromAmount),
        },
      })
      const dst = await tx.walletBalance.findUnique({
        where: { userId_currency: { userId, currency: toCurrency } },
      })
      const nextDst = Number(dst?.balance ?? 0) + toAmount
      await tx.walletBalance.upsert({
        where: { userId_currency: { userId, currency: toCurrency } },
        create: {
          userId,
          currency: toCurrency,
          symbol: toCurrency === 'USD' ? '$' : toCurrency,
          balance: toAmount,
          available: toAmount,
        },
        update: { balance: nextDst, available: Number(dst?.available ?? 0) + toAmount },
      })
      if (toCurrency !== 'USD') {
        const h = await tx.holding.findUnique({ where: { userId_symbol: { userId, symbol: toCurrency } } })
        const nextAmt = (h?.amount ?? 0) + toAmount
        const px = toAmount > 0 && fromCurrency === 'USD' ? fromAmount / toAmount : (h?.avgPrice ?? 0)
        await tx.holding.upsert({
          where: { userId_symbol: { userId, symbol: toCurrency } },
          create: {
            userId, symbol: toCurrency, name: toCurrency, amount: nextAmt, avgPrice: px, type: 'crypto',
          },
          update: {
            amount: nextAmt,
            avgPrice: nextAmt > 0 ? (((h?.avgPrice ?? px) * (h?.amount ?? 0) + px * toAmount) / nextAmt) : px,
          },
        })
      }
      if (fromCurrency !== 'USD') {
        const h = await tx.holding.findUnique({ where: { userId_symbol: { userId, symbol: fromCurrency } } })
        if (h) {
          const nextAmt = Math.max(0, (h.amount ?? 0) - fromAmount)
          if (nextAmt <= 0) await tx.holding.delete({ where: { id: h.id } })
          else await tx.holding.update({ where: { id: h.id }, data: { amount: nextAmt } })
        }
      }
      const { generateTransactionId } = await import('../utils/transactionIdGenerator.js')
      const ref = `Convert ${fromCurrency} \u2192 ${toCurrency}`
      await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(), userId, kind: 'transfer', currency: fromCurrency,
          amount: -fromAmount, status: 'completed', reference: ref, subType: 'convert',
        } as any,
      })
      await tx.transaction.create({
        data: {
          transactionId: generateTransactionId(), userId, kind: 'transfer', currency: toCurrency,
          amount: toAmount, status: 'completed', reference: ref, subType: 'convert',
        } as any,
      })
    })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e?.message || 'Convert failed' })
  }
})

export default router
