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
import walletUserExtrasRoutes from './wallet-user-extras.js'

const router = Router()

function getIdempotencyKey(req: AuthedRequest): string | undefined {
  const raw = req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key']
  if (!raw) return undefined
  return Array.isArray(raw) ? raw[0] : String(raw)
}

function parseUserPrefs(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!

  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms)),
    ])

  let balances: ReturnType<typeof mapBalances> = []
  let transactions: unknown[] = []

  try {
    const rows = await withTimeout(
      prisma.walletBalance.findMany({ where: { userId }, orderBy: { currency: 'asc' } }),
      8_000,
      'walletBalance',
    )
    balances = mapBalances(rows as any)
  } catch (e) {
    console.warn('[wallet] balance load failed', e instanceof Error ? e.message : e)
    balances = []
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

async function lookupRecipientHandler(req: AuthedRequest, res: import('express').Response) {
  const raw = (req.body && (req.body as { email?: string }).email) ?? req.query?.email
  const email = normalizeEmail(raw)
  if (!email) {
    res.status(400).json({ error: 'Email required' })
    return
  }
  try {
    let user = await prisma.user.findFirst({
      where: { email: email },
      select: { id: true, email: true, name: true },
    })
    if (!user) {
      user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, name: true },
      }).catch(() => null)
    }
    if (!user) {
      const rows = await prisma.user.findMany({
        where: { email: { contains: email.split('@')[0] } },
        select: { id: true, email: true, name: true },
        take: 25,
      }).catch(() => [] as { id: string; email: string; name: string | null }[])
      user = rows.find((u) => u.email.toLowerCase() === email) ?? null
    }
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    console.error('[wallet] lookup-recipient failed', e)
    res.status(500).json({ error: 'Lookup failed' })
  }
}
router.get('/lookup-recipient', requireAuth, lookupRecipientHandler)
router.post('/lookup-recipient', requireAuth, lookupRecipientHandler)

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
      (async () => {
        let u = await prisma.user.findFirst({
          where: { email: emailNorm },
          select: { id: true, email: true, name: true, suspended: true },
        })
        if (!u) {
          u = await prisma.user.findFirst({
            where: { email: { equals: emailNorm, mode: 'insensitive' } },
            select: { id: true, email: true, name: true, suspended: true },
          }).catch(() => null)
        }
        if (!u) {
          const rows = await prisma.user.findMany({
            where: { email: { contains: emailNorm.split('@')[0] } },
            select: { id: true, email: true, name: true, suspended: true },
            take: 25,
          }).catch(() => [])
          u = rows.find((r) => r.email.toLowerCase() === emailNorm) ?? null
        }
        return u
      })(),
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

router.get('/saved-wallet', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { prefs: true },
    })
    const prefs = parseUserPrefs(user?.prefs)
    const savedWallet = prefs.savedWallet as
      | { encryptedWallet?: string; address?: string; updatedAt?: string }
      | undefined
    if (!savedWallet?.encryptedWallet) {
      res.json({ wallet: null })
      return
    }
    res.json({
      wallet: {
        hasWallet: true,
        address: savedWallet.address ?? null,
        encryptedWallet: savedWallet.encryptedWallet,
        updatedAt: savedWallet.updatedAt ?? null,
      },
    })
  } catch (e) {
    console.error('[wallet] saved-wallet get', e)
    res.status(500).json({ error: 'Failed to load saved wallet' })
  }
})

router.post('/saved-wallet', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const encryptedWallet = String(req.body?.encryptedWallet || '').trim()
    const address = String(req.body?.address || '').trim()
    if (!encryptedWallet || !address) {
      res.status(400).json({ error: 'encryptedWallet and address are required' })
      return
    }
    if (encryptedWallet.length > 20000 || address.length > 128) {
      res.status(400).json({ error: 'Payload too large' })
      return
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { prefs: true },
    })
    const prefs = parseUserPrefs(user?.prefs)
    const updatedAt = new Date().toISOString()
    prefs.savedWallet = { encryptedWallet, address, updatedAt }
    await prisma.user.update({
      where: { id: req.userId! },
      data: { prefs: JSON.stringify(prefs) },
    })
    res.json({
      wallet: {
        hasWallet: true,
        address,
        updatedAt,
      },
    })
  } catch (e) {
    console.error('[wallet] saved-wallet post', e)
    res.status(500).json({ error: 'Failed to save wallet' })
  }
})

router.delete('/saved-wallet', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { prefs: true },
    })
    const prefs = parseUserPrefs(user?.prefs)
    delete prefs.savedWallet
    await prisma.user.update({
      where: { id: req.userId! },
      data: { prefs: JSON.stringify(prefs) },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('[wallet] saved-wallet delete', e)
    res.status(500).json({ error: 'Failed to clear saved wallet' })
  }
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
      const ref = `Convert ${fromCurrency} → ${toCurrency}`
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

router.use(walletUserExtrasRoutes)

export default router
