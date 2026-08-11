import { Router } from 'express'
import crypto from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import type { Prisma } from '@prisma/client'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { sendError, VALIDATION_LIMITS, isValidSymbol, isValidAmount, isValidCurrency } from '../errorHandler.js'
import { buildTemporaryFundingTransferResult } from '../services/cryptoWithdrawal.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { alertAdminsOfDeposit } from '../services/depositAlerts.js'

function getIdempotencyKey(req: AuthedRequest): string | undefined {
  const raw = req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key']
  if (!raw) return undefined
  return Array.isArray(raw) ? raw[0] : String(raw)
}

const router = Router()

// Money-mutation endpoints get a tighter limiter. 30/min/user is well above
// any real human use but blocks scripted abuse.
const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || req.ip || 'anon',
})

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const [balances, transactions, pendingWithdrawals] = await Promise.all([
    prisma.walletBalance.findMany({ where: { userId: req.userId! } }),
    prisma.transaction.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.withdrawalRequest.findMany({
      where: { userId: req.userId!, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  // Convert pending withdrawals to transaction-like objects for display
  const pendingTxs = pendingWithdrawals.map((w) => ({
    id: w.id,
    userId: w.userId,
    kind: 'withdrawal',
    currency: w.asset,
    amount: w.amount,
    status: 'pending',
    reference: w.id,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }))

  // Merge and sort all transactions (completed + pending)
  const allTransactions = [...transactions, ...pendingTxs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  res.json({ balances, transactions: allTransactions })
})

// Per-user deposit destinations (admin-managed). Returns the override the
// admin set for THIS user, or null if none. Falls back to the global
// deposit instructions on the client side.
router.get('/me/deposit-addresses', requireAuth, async (req: AuthedRequest, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId! }, select: { prefs: true } })
  let prefs: Record<string, unknown> = {}
  try { if (u?.prefs) prefs = JSON.parse(u.prefs) } catch { prefs = {} }
  const addresses = (prefs as { depositAddresses?: unknown }).depositAddresses ?? null
  res.json({ addresses })
})

router.get('/saved-wallet', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { prefs: true } })
  let prefs: Record<string, unknown> = {}
  try { if (user?.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }

  const savedWallet = prefs.savedWallet as { encryptedWallet?: string; address?: string; updatedAt?: string } | undefined
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
})

router.post('/saved-wallet', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({
    encryptedWallet: z.string().min(1).max(20000),
    address: z.string().min(1).max(128),
  }).safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { prefs: true } })
  let prefs: Record<string, unknown> = {}
  try { if (user?.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }

  prefs.savedWallet = {
    encryptedWallet: parsed.data.encryptedWallet,
    address: parsed.data.address,
    updatedAt: new Date().toISOString(),
  }

  await prisma.user.update({
    where: { id: req.userId! },
    data: { prefs: JSON.stringify(prefs) },
  })

  res.json({
    wallet: {
      hasWallet: true,
      address: parsed.data.address,
      updatedAt: new Date().toISOString(),
    },
  })
})

router.delete('/saved-wallet', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { prefs: true } })
  let prefs: Record<string, unknown> = {}
  try { if (user?.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }

  delete prefs.savedWallet

  await prisma.user.update({
    where: { id: req.userId! },
    data: { prefs: JSON.stringify(prefs) },
  })

  res.json({ ok: true })
})

const txSchema = z.object({
  kind: z.enum(['deposit', 'withdraw', 'transfer', 'dividend', 'interest']),
  currency: z.string().min(1).max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  symbol: z.string().min(1).max(8).default('$'),
  amount: z.number().positive().min(VALIDATION_LIMITS.MIN_AMOUNT).max(VALIDATION_LIMITS.MAX_AMOUNT),
  reference: z.string().max(VALIDATION_LIMITS.REFERENCE_MAX).optional(),
})

const convertSchema = z.object({
  fromCurrency: z.string().min(1).max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  fromAmount: z.number().positive().min(VALIDATION_LIMITS.MIN_AMOUNT).max(VALIDATION_LIMITS.MAX_AMOUNT),
  fromSymbol: z.string().min(1).max(VALIDATION_LIMITS.SYMBOL_LENGTH),
  toCurrency: z.string().min(1).max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  toAmount: z.number().positive().min(VALIDATION_LIMITS.MIN_AMOUNT).max(VALIDATION_LIMITS.MAX_AMOUNT),
  toSymbol: z.string().min(1).max(VALIDATION_LIMITS.SYMBOL_LENGTH),
})

const swapSchema = z.object({
  fromCurrency: z.string().min(1).max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  toCurrency: z.string().min(1).max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  amount: z.number().positive().min(VALIDATION_LIMITS.MIN_AMOUNT).max(VALIDATION_LIMITS.MAX_AMOUNT),
  slippage: z.number().min(0).max(50).optional().default(1),
})

// Transaction kinds that *credit* the wallet. Only admins can post these
// directly via this endpoint. Regular users obtain credits exclusively via:
//   - `deposit` (which is queued as `pending` until an admin approves)
//   - `transfer` from another user (handled by /transfer)
//   - server-side reward/yield jobs running with admin privileges
// Without this restriction, ANY signed-in user could self-credit unlimited
// funds by POSTing {kind: 'interest', amount: 1e9}. Verified exploitable
// during QA on 2026-05-13.
const PRIVILEGED_CREDIT_KINDS = new Set(['dividend', 'interest'])

router.post('/transactions', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = txSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { kind, currency, symbol, amount, reference } = parsed.data

  // Gate privileged credit kinds (`dividend`, `interest`) to admin callers.
  // See PRIVILEGED_CREDIT_KINDS above for the rationale.
  if (PRIVILEGED_CREDIT_KINDS.has(kind) && req.userRole !== 'admin') {
    res.status(403).json({
      error: 'Only an administrator can post this transaction kind from this endpoint.',
      reason: 'admin_only_kind',
      kind,
    })
    return
  }

  // Account-hold gate: even though `requireAuth` lets the user in, an admin
  // may have placed a hold on money-movement. Block the relevant kinds.
  if (kind === 'withdraw' || kind === 'transfer') {
    const u = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        holdActive: true, holdType: true, holdReason: true, holdNote: true,
        ipAllowlist: true,
        prefs: true,
        emailVerified: true,
        dailyWithdrawLimit: true, monthlyWithdrawLimit: true,
        dailyTransferLimit: true, monthlyTransferLimit: true,
      },
    })
    // Email-verification gate: a user must confirm ownership of their inbox
    // before money leaves the account. This is a cheap account-takeover
    // mitigation — even if a credential leak grants login, the attacker
    // can't drain funds without also controlling the user's email.
    // Admins are exempt so an admin acting on behalf of a user (e.g.
    // refunds) isn't blocked.
    if (kind === 'withdraw' && u && !u.emailVerified && req.userRole !== 'admin') {
      res.status(403).json({
        error: 'Verify your email before withdrawing.',
        reason: 'email_unverified',
      })
      return
    }
    // Bonus withdrawal lock: new users who received a signup bonus cannot
    // withdraw until they message support on WhatsApp and an admin clears
    // the `bonusLocked` flag on their prefs.
    if (kind === 'withdraw' && u?.prefs) {
      try {
        const prefs = JSON.parse(u.prefs) as { bonusLocked?: boolean }
        if (prefs.bonusLocked === true) {
          res.status(423).json({
            error: 'Bonus withdrawal locked. Please message support on WhatsApp or Telegram at +1 (719) 679-8790 to unlock your bonus before withdrawing.',
            reason: 'bonus_locked',
            whatsapp: 'https://wa.me/17196798790',
            telegram: 'https://t.me/+17196798790',
          })
          return
        }
      } catch { /* ignore malformed prefs */ }
    }
    if (u?.holdActive) {
      const blocks =
        u.holdType === 'all' ||
        (u.holdType === 'withdraw' && kind === 'withdraw') ||
        (u.holdType === 'transfer' && kind === 'transfer')
      if (blocks) {
        res.status(423).json({
          error: 'Account on hold',
          reason: u.holdReason,
          note: u.holdNote,
          scope: u.holdType,
        })
        return
      }
    }
    // IP allowlist (simple substring-match against comma-separated entries).
    if (u?.ipAllowlist && u.ipAllowlist.trim()) {
      const allowed = u.ipAllowlist.split(',').map((s: string) => s.trim()).filter(Boolean)
      const forwarded = Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : (req.headers['x-forwarded-for'] as string | undefined)
      const ip = (forwarded?.toString().split(',')[0]?.trim()) || req.ip || ''
      const ok = allowed.some((entry: string) => ip === entry || ip.startsWith(entry))
      if (!ok) {
        res.status(403).json({ error: 'Source IP not in allowlist for this account', ip })
        return
      }
    }
    // Per-user money-movement caps.
    const dailyCap = kind === 'withdraw' ? u?.dailyWithdrawLimit : u?.dailyTransferLimit
    const monthlyCap = kind === 'withdraw' ? u?.monthlyWithdrawLimit : u?.monthlyTransferLimit
    if (dailyCap || monthlyCap) {
      const now = Date.now()
      const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
      const recent = await prisma.transaction.findMany({
        where: { userId: req.userId!, kind, status: 'completed', createdAt: { gte: monthAgo } },
        select: { amount: true, createdAt: true },
      })
      const monthSum = recent.reduce((s: number, t: { amount: number }) => s + t.amount, 0)
      const daySum = recent.filter((t: { createdAt: Date }) => t.createdAt >= dayAgo).reduce((s: number, t: { amount: number }) => s + t.amount, 0)
      if (dailyCap && daySum + amount > dailyCap) {
        res.status(429).json({ error: `Daily ${kind} cap exceeded`, limit: dailyCap, used: daySum, attempted: amount })
        return
      }
      if (monthlyCap && monthSum + amount > monthlyCap) {
        res.status(429).json({ error: `Monthly ${kind} cap exceeded`, limit: monthlyCap, used: monthSum, attempted: amount })
        return
      }
    }
  }

  // Atomically apply to balance + record transaction.
  // SECURITY: A regular user submitting a `deposit` only files a *request* —
  // it stays `pending` and does NOT credit the wallet until an admin
  // approves it from the admin console. Admins can self-deposit immediately.
  // Other kinds (withdraw / transfer / dividend / interest) keep the
  // existing immediate semantics.
  const isAdmin = req.userRole === 'admin'
  const userDepositRequiresApproval = kind === 'deposit' && !isAdmin

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (userDepositRequiresApproval) {
      // Just record the pending transaction; do not touch balances.
      const transaction = await tx.transaction.create({
        data: {
          userId: req.userId!,
          kind,
          currency,
          amount,
          reference: reference ? `${reference} (pending review)` : 'Deposit request (pending review)',
          status: 'pending',
        },
      })
      // Make sure a wallet row exists at zero so the user sees the currency.
      await tx.walletBalance.upsert({
        where: { userId_currency: { userId: req.userId!, currency } },
        create: { userId: req.userId!, currency, symbol, balance: 0, available: 0 },
        update: { symbol },
      })
      return { transaction, pendingApproval: true as const }
    }

    const entryType = kind === 'withdraw' || kind === 'transfer' ? 'credit' : 'debit'
    const result = await recordLedgerTransaction({
      tx,
      userId: req.userId!,
      asset: currency,
      amount,
      entryType,
      kind,
      eventType: `wallet_${kind}`,
      sourceType: 'wallet_transaction',
      sourceId: `wallet:${req.userId}:${kind}:${currency}:${amount}:${reference ?? 'no-ref'}`,
      externalRef: `wallet-transaction:${req.userId}:${kind}:${currency}:${amount}:${reference ?? 'no-ref'}`,
      idempotencyKey: getIdempotencyKey(req),
      description: reference ? `${kind} ${reference}` : `${kind} ${currency}`,
      reference: reference ?? undefined,
      subType: kind,
      recordTransaction: true,
    })

    return { balance: result.walletBalance, transaction: result.transaction }
  }).catch((err: Error & { status?: number }) => {
    return { error: err.message, status: err.status || 500 }
  })

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  if ('pendingApproval' in result && result.pendingApproval) {
    // Regular transaction deposits use the existing admin deposit queue. The
    // email action route is reserved for pending on-chain deposit records.
  }
  res.status(201).json(result)
})

// --- Internal USD <-> Crypto conversion --------------------------------
router.post('/convert', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = convertSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const { fromCurrency, fromAmount, fromSymbol, toCurrency, toAmount, toSymbol } = parsed.data
  if (fromCurrency === toCurrency) { res.status(400).json({ error: 'Cannot convert to the same currency' }); return }

  // Account-state gates: a converted balance is fungible with any other
  // balance the user holds, so anything that blocks withdraw/transfer must
  // also block convert (otherwise a held user can rearrange portfolio, and
  // a bonus-locked user can split the bonus across currencies to make later
  // unlock disputes harder to reconcile).
  if (req.userRole !== 'admin') {
    const u = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { holdActive: true, holdType: true, holdReason: true, holdNote: true, prefs: true },
    })
    if (u?.holdActive && (u.holdType === 'all' || u.holdType === 'transfer' || u.holdType === 'withdraw')) {
      res.status(423).json({ error: 'Account on hold', reason: u.holdReason, note: u.holdNote, scope: u.holdType })
      return
    }
    if (u?.prefs) {
      try {
        const prefs = JSON.parse(u.prefs) as { bonusLocked?: boolean }
        if (prefs.bonusLocked === true) {
          res.status(423).json({
            error: 'Bonus is locked. Please contact support before converting.',
            reason: 'bonus_locked',
            whatsapp: 'https://wa.me/17196798790',
            telegram: 'https://t.me/+17196798790',
          })
          return
        }
      } catch { /* ignore malformed prefs */ }
    }
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const src = await tx.walletBalance.findUnique({
      where: { userId_currency: { userId: req.userId!, currency: fromCurrency } },
    })
    if (!src || src.available < fromAmount) {
      throw Object.assign(new Error(`Insufficient ${fromCurrency} balance`), { status: 400 })
    }

    const debit = await recordLedgerTransaction({
      tx,
      userId: req.userId!,
      asset: fromCurrency,
      amount: fromAmount,
      entryType: 'credit',
      kind: 'transfer',
      eventType: 'wallet_convert',
      sourceType: 'wallet_convert',
      sourceId: `convert:${req.userId}:${fromCurrency}:${toCurrency}:${fromAmount}:out`,
      externalRef: `convert:${req.userId}:${fromCurrency}:${toCurrency}:${fromAmount}:out`,
      idempotencyKey: getIdempotencyKey(req),
      description: `Convert ${fromCurrency} → ${toCurrency}`,
      reference: `Convert ${fromCurrency} → ${toCurrency}`,
      subType: 'convert',
      recordTransaction: true,
    })

    const credit = await recordLedgerTransaction({
      tx,
      userId: req.userId!,
      asset: toCurrency,
      amount: toAmount,
      entryType: 'debit',
      kind: 'transfer',
      eventType: 'wallet_convert',
      sourceType: 'wallet_convert',
      sourceId: `convert:${req.userId}:${fromCurrency}:${toCurrency}:${toAmount}:in`,
      externalRef: `convert:${req.userId}:${fromCurrency}:${toCurrency}:${toAmount}:in`,
      idempotencyKey: getIdempotencyKey(req),
      description: `Convert ${fromCurrency} → ${toCurrency}`,
      reference: `Convert ${fromCurrency} → ${toCurrency}`,
      subType: 'convert',
      recordTransaction: true,
    })

    // fromSymbol kept on the request for future use / symmetry; not stored
    // separately because the existing source balance row already has it.
    void fromSymbol
    return { debit: debit.transaction, credit: credit.transaction }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  res.status(201).json(result)
})

// --- Swap (simplified convert with live rates) -------------------------
router.post('/swap', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = swapSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input' }); return }
  const { fromCurrency, toCurrency, amount, slippage } = parsed.data
  if (fromCurrency === toCurrency) { res.status(400).json({ error: 'Cannot swap to same currency' }); return }

  if (req.userRole !== 'admin') {
    const u = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { holdActive: true, holdType: true, holdReason: true, holdNote: true, prefs: true },
    })
    if (u?.holdActive && (u.holdType === 'all' || u.holdType === 'transfer' || u.holdType === 'withdraw')) {
      res.status(423).json({ error: 'Account on hold', reason: u.holdReason, note: u.holdNote })
      return
    }
    if (u?.prefs) {
      try {
        const prefs = JSON.parse(u.prefs) as { bonusLocked?: boolean }
        if (prefs.bonusLocked === true) {
          res.status(423).json({
            error: 'Bonus locked. Contact support before swapping.',
            reason: 'bonus_locked',
            whatsapp: 'https://wa.me/17196798790',
            telegram: 'https://t.me/+17196798790',
          })
          return
        }
      } catch { /* ignore */ }
    }
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const src = await tx.walletBalance.findUnique({
      where: { userId_currency: { userId: req.userId!, currency: fromCurrency } },
    })
    if (!src || src.available < amount) {
      throw Object.assign(new Error(`Insufficient ${fromCurrency}`), { status: 400 })
    }
    const rates: Record<string, number> = { USD: 1, USDC: 1, USDT: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52, XRP: 0.55, DOGE: 0.12, MATIC: 0.62, DOT: 6.8, AVAX: 32, LINK: 14, LTC: 75, BCH: 380 }
    const fromRate = rates[fromCurrency.toUpperCase()] ?? 1
    const toRate = rates[toCurrency.toUpperCase()] ?? 1
    const usdValue = amount * fromRate
    const toAmount = usdValue / toRate
    const slippageAdjusted = toAmount * (1 - slippage / 100)

    const debit = await recordLedgerTransaction({
      tx,
      userId: req.userId!,
      asset: fromCurrency,
      amount,
      entryType: 'credit',
      kind: 'transfer',
      eventType: 'wallet_swap',
      sourceType: 'wallet_swap',
      sourceId: `swap:${req.userId}:${fromCurrency}:${toCurrency}:${amount}:out`,
      externalRef: `swap:${req.userId}:${fromCurrency}:${toCurrency}:${amount}:out`,
      idempotencyKey: getIdempotencyKey(req),
      description: `Swap ${fromCurrency}→${toCurrency}`,
      reference: `Swap ${fromCurrency}→${toCurrency}`,
      subType: 'swap',
      recordTransaction: true,
    })

    const credit = await recordLedgerTransaction({
      tx,
      userId: req.userId!,
      asset: toCurrency,
      amount: slippageAdjusted,
      entryType: 'debit',
      kind: 'transfer',
      eventType: 'wallet_swap',
      sourceType: 'wallet_swap',
      sourceId: `swap:${req.userId}:${fromCurrency}:${toCurrency}:${slippageAdjusted}:in`,
      externalRef: `swap:${req.userId}:${fromCurrency}:${toCurrency}:${slippageAdjusted}:in`,
      idempotencyKey: getIdempotencyKey(req),
      description: `Swap ${fromCurrency}→${toCurrency}`,
      reference: `Swap ${fromCurrency}→${toCurrency}`,
      subType: 'swap',
      recordTransaction: true,
    })

    return { debit: debit.transaction, credit: credit.transaction, rate: fromRate / toRate, received: slippageAdjusted }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  res.status(201).json(result)
})

// --- User-to-user transfer ---------------------------------------------
// Lets a regular user send funds from one of their balances to another
// user identified by email. Subject to the same hold / IP / cap gates as a
// withdraw or transfer transaction. Atomic: either both sides update or
// neither does.
const userTransferSchema = z.object({
  recipientEmail: z.string().email().max(VALIDATION_LIMITS.EMAIL_MAX_LENGTH),
  currency: z.string().min(1).max(VALIDATION_LIMITS.CURRENCY_LENGTH),
  amount: z.number().positive().min(VALIDATION_LIMITS.MIN_AMOUNT).max(VALIDATION_LIMITS.MAX_AMOUNT),
  note: z.string().max(VALIDATION_LIMITS.NOTE_LENGTH).optional(),
})

router.post('/transfer', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = userTransferSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const { recipientEmail, currency, amount, note } = parsed.data

  const recipient = await prisma.user.findUnique({
    where: { email: recipientEmail.toLowerCase() },
    select: { id: true, email: true, name: true },
  })
  if (!recipient) {
    res.status(404).json({ error: 'No Verdexis user with that email' })
    return
  }
  if (recipient.id === req.userId) {
    res.status(400).json({ error: "You can't send to yourself" })
    return
  }

  // Same gating as a transfer transaction.
  const sender = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      email: true, name: true, role: true,
      emailVerified: true,
      prefs: true,
      holdActive: true, holdType: true, holdReason: true, holdNote: true,
      ipAllowlist: true,
      dailyTransferLimit: true, monthlyTransferLimit: true,
    },
  })
  // Email verification: required for ALL outbound money movement, not just
  // withdraws — otherwise an attacker who hijacked the password could
  // siphon funds to a confederate via internal transfer before the rightful
  // owner notices.
  if (sender && !sender.emailVerified && sender.role !== 'admin') {
    res.status(403).json({
      error: 'Verify your email before sending funds to another user.',
      reason: 'email_unverified',
    })
    return
  }
  // Bonus lock: an internal transfer would otherwise be a trivial way to
  // launder a locked signup bonus into a sibling account that the same
  // person controls, and then withdraw freely from there.
  if (sender?.prefs && sender.role !== 'admin') {
    try {
      const prefs = JSON.parse(sender.prefs) as { bonusLocked?: boolean }
      if (prefs.bonusLocked === true) {
        res.status(423).json({
          error: 'Bonus withdrawal locked. Please message support on WhatsApp or Telegram at +1 (719) 679-8790 to unlock your bonus before transferring.',
          reason: 'bonus_locked',
          whatsapp: 'https://wa.me/17196798790',
          telegram: 'https://t.me/+17196798790',
        })
        return
      }
    } catch { /* ignore */ }
  }
  if (sender?.holdActive && (sender.holdType === 'all' || sender.holdType === 'transfer')) {
    res.status(423).json({ error: 'Account on hold', reason: sender.holdReason, note: sender.holdNote, scope: sender.holdType })
    return
  }
  if (sender?.ipAllowlist && sender.ipAllowlist.trim()) {
    const allowed = sender.ipAllowlist.split(',').map((s: string) => s.trim()).filter(Boolean)
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || ''
    if (!allowed.some((entry: string) => ip === entry || ip.startsWith(entry))) {
      res.status(403).json({ error: 'Source IP not in allowlist for this account', ip })
      return
    }
  }
  if (sender?.dailyTransferLimit || sender?.monthlyTransferLimit) {
    const now = Date.now()
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const recent = await prisma.transaction.findMany({
      where: { userId: req.userId!, kind: 'transfer', status: 'completed', createdAt: { gte: monthAgo } },
      select: { amount: true, createdAt: true },
    })
    const monthSum = recent.reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0)
    const daySum = recent.filter((t: { createdAt: Date }) => t.createdAt >= dayAgo).reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0)
    if (sender.dailyTransferLimit && daySum + amount > sender.dailyTransferLimit) {
      res.status(429).json({ error: 'Daily transfer cap exceeded', limit: sender.dailyTransferLimit, used: daySum, attempted: amount })
      return
    }
    if (sender.monthlyTransferLimit && monthSum + amount > sender.monthlyTransferLimit) {
      res.status(429).json({ error: 'Monthly transfer cap exceeded', limit: sender.monthlyTransferLimit, used: monthSum, attempted: amount })
      return
    }
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const senderBal = await tx.walletBalance.findUnique({
      where: { userId_currency: { userId: req.userId!, currency } },
    })
    if (!senderBal || senderBal.available < amount) {
      throw Object.assign(new Error('Insufficient funds'), { status: 400 })
    }
    const symbol = senderBal.symbol

    const recipientLabel = recipient.name?.trim() || recipient.email
    const senderLabel = sender?.name?.trim() || sender?.email || 'a Verdexis user'
    const ref = `Transfer to ${recipientLabel}${note ? ' — ' + note : ''}`
    const incomingRef = `Transfer from ${senderLabel}${note ? ' — ' + note : ''}`

    const out = await recordLedgerTransaction({
      tx,
      userId: req.userId!,
      asset: currency,
      amount,
      entryType: 'credit',
      kind: 'transfer',
      eventType: 'user_transfer',
      sourceType: 'user_transfer',
      sourceId: `transfer:${req.userId}:${recipient.id}:${currency}:${amount}:out`,
      externalRef: `user-transfer:${req.userId}:${recipient.id}:${currency}:${amount}:out`,
      idempotencyKey: getIdempotencyKey(req),
      description: ref,
      reference: ref,
      subType: 'user_transfer',
      recordTransaction: true,
    })

    const incoming = await recordLedgerTransaction({
      tx,
      userId: recipient.id,
      asset: currency,
      amount,
      entryType: 'debit',
      kind: 'deposit',
      eventType: 'user_transfer',
      sourceType: 'user_transfer',
      sourceId: `transfer:${req.userId}:${recipient.id}:${currency}:${amount}:in`,
      externalRef: `user-transfer:${req.userId}:${recipient.id}:${currency}:${amount}:in`,
      idempotencyKey: getIdempotencyKey(req),
      description: incomingRef,
      reference: incomingRef,
      subType: 'user_transfer',
      recordTransaction: true,
    })

    await tx.notification.create({
      data: {
        userId: recipient.id,
        kind: 'transfer',
        title: `You received ${amount} ${currency}`,
        body: `${senderLabel} sent you ${amount} ${currency}${note ? ' — ' + note : ''}.`,
      },
    })
    return { out: out.transaction, incoming: incoming.transaction, recipient: { email: recipient.email, name: recipient.name } }
  }).catch((err: Error & { status?: number }) => ({ error: err.message, status: err.status || 500 }))

  if ('error' in result) {
    res.status(result.status || 500).json({ error: result.error })
    return
  }
  res.status(201).json(result)
})

// Lightweight recipient lookup so the client can confirm the email is valid
// before showing the confirm step. Returns minimal info; does not leak whether
// the user exists for unauth callers (requireAuth required).
router.get('/lookup-recipient', requireAuth, async (req: AuthedRequest, res) => {
  const email = String((req.query as Record<string, unknown>)['email'] ?? '').toLowerCase().trim()
  if (!email) { res.status(400).json({ error: 'email required' }); return }
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } })
  if (!u || u.id === req.userId) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ user: { email: u.email, name: u.name } })
})

// --- Self-custody wallet linking --------------------------------------
// Persist the user's self-custody wallet address on their profile.
// Address is normalized to lowercase. We don't verify ownership here
// (no signature challenge yet) — that's a follow-up; for now this just
// gives admins/audit a record of which wallet a user claims is theirs.

const linkWalletSchema = z.object({
  address: z.string().min(1).max(128),
  chainId: z.string().min(1).max(64).optional(),
  provider: z.string().min(1).max(60).optional(),
})

router.get('/link', requireAuth, async (req: AuthedRequest, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { walletAddress: true, walletChainId: true, walletProvider: true, walletLinkedAt: true },
  })
  res.json({ wallet: u ?? null })
})

router.post('/link', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = linkWalletSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const address = parsed.data.address.toLowerCase()
  const chainId = parsed.data.chainId?.toLowerCase() ?? null
  const provider = parsed.data.provider ?? null

  // Add to the per-user list (dedupes by [userId, address]). New links land
  // primary only when the user has no other wallet yet \u2014 otherwise we
  // keep their existing primary so connecting a fresh wallet doesn't
  // silently change deposit attribution.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.walletLink.findUnique({
      where: { userId_address: { userId: req.userId!, address } },
    })
    const otherCount = await tx.walletLink.count({
      where: { userId: req.userId!, NOT: { address } },
    })
    const shouldBePrimary = existing?.isPrimary || otherCount === 0
    await tx.walletLink.upsert({
      where: { userId_address: { userId: req.userId!, address } },
      create: { userId: req.userId!, address, chainId, provider, isPrimary: shouldBePrimary },
      update: { chainId, provider, ...(shouldBePrimary ? { isPrimary: true } : {}) },
    })
    if (shouldBePrimary) {
      await mirrorPrimaryToUser(tx, req.userId!, { address, chainId, provider })
    }
  })

  const u = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { walletAddress: true, walletChainId: true, walletProvider: true, walletLinkedAt: true },
  })
  res.json({ wallet: u })
})

router.delete('/link', requireAuth, async (req: AuthedRequest, res) => {
  // Legacy "disconnect everything" endpoint \u2014 wipes ALL linked wallets.
  // The new picker uses DELETE /links/:id for surgical removal.
  await prisma.$transaction([
    prisma.walletLink.deleteMany({ where: { userId: req.userId! } }),
    prisma.user.update({
      where: { id: req.userId! },
      data: { walletAddress: null, walletChainId: null, walletProvider: null, walletLinkedAt: null },
    }),
  ])
  res.json({ ok: true })
})

// --- Multi-wallet API --------------------------------------------------
// Lets a user attach multiple self-custody addresses, pick one primary
// (mirrored back into User.walletAddress for legacy code paths), and
// remove individual entries without disconnecting all of them.

const walletLinkBodySchema = z.object({
  address: z.string().min(1).max(128),
  chainId: z.string().min(1).max(64).optional(),
  provider: z.string().min(1).max(60).optional(),
  label: z.string().min(1).max(60).optional(),
  setPrimary: z.boolean().optional(),
})

async function mirrorPrimaryToUser(
  tx: Prisma.TransactionClient,
  userId: string,
  primary: { address: string | null; chainId: string | null; provider: string | null },
) {
  await (tx.user.update as (args: unknown) => Promise<unknown>)({
    where: { id: userId },
    data: {
      walletAddress: primary.address,
      walletChainId: primary.chainId,
      walletProvider: primary.provider,
      walletLinkedAt: primary.address ? new Date() : null,
    },
  })
}

router.get('/links', requireAuth, async (req: AuthedRequest, res) => {
  const links = await prisma.walletLink.findMany({
    where: { userId: req.userId! },
    orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'desc' }],
  })
  res.json({ links })
})

router.post('/links', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = walletLinkBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const address = parsed.data.address.toLowerCase()
  const chainId = parsed.data.chainId?.toLowerCase() ?? null
  const provider = parsed.data.provider ?? null
  const label = parsed.data.label ?? null

  const link = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.walletLink.findUnique({
      where: { userId_address: { userId: req.userId!, address } },
    })
    const otherCount = await tx.walletLink.count({
      where: { userId: req.userId!, NOT: { address } },
    })
    const wantsPrimary = parsed.data.setPrimary === true || otherCount === 0 || existing?.isPrimary === true
    if (wantsPrimary) {
      // Demote any other primary first \u2014 we enforce single-primary in app
      // logic rather than a db constraint to keep migrations simple.
      await tx.walletLink.updateMany({
        where: { userId: req.userId!, isPrimary: true, NOT: { address } },
        data: { isPrimary: false },
      })
    }
    const row = await tx.walletLink.upsert({
      where: { userId_address: { userId: req.userId!, address } },
      create: { userId: req.userId!, address, chainId, provider, label, isPrimary: wantsPrimary },
      update: {
        chainId, provider,
        ...(label !== null ? { label } : {}),
        ...(wantsPrimary ? { isPrimary: true } : {}),
      },
    })
    if (wantsPrimary) {
      await mirrorPrimaryToUser(tx, req.userId!, { address, chainId, provider })
    }
    return row
  })

  res.status(201).json({ link })
})

router.delete('/links/:id', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await tx.walletLink.findFirst({ where: { id, userId: req.userId! } })
    if (!row) return { ok: false as const }
    await tx.walletLink.delete({ where: { id } })
    if (row.isPrimary) {
      // Promote the most recently-linked remaining wallet to primary so the
      // user always has a sensible default deposit destination.
      const next = await tx.walletLink.findFirst({
        where: { userId: req.userId! },
        orderBy: { linkedAt: 'desc' },
      })
      if (next) {
        await tx.walletLink.update({ where: { id: next.id }, data: { isPrimary: true } })
        await mirrorPrimaryToUser(tx, req.userId!, {
          address: next.address, chainId: next.chainId, provider: next.provider,
        })
      } else {
        await mirrorPrimaryToUser(tx, req.userId!, { address: null, chainId: null, provider: null })
      }
    }
    return { ok: true as const }
  })
  if (!result.ok) {
    res.status(404).json({ error: 'Wallet link not found' })
    return
  }
  res.json({ ok: true })
})

// amazonq-ignore-next-line
router.post('/links/:id/primary', requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await tx.walletLink.findFirst({ where: { id, userId: req.userId! } })
    if (!row) return { ok: false as const }
    await tx.walletLink.updateMany({
      where: { userId: req.userId!, isPrimary: true, NOT: { id } },
      data: { isPrimary: false },
    })
    await tx.walletLink.update({ where: { id }, data: { isPrimary: true } })
    await mirrorPrimaryToUser(tx, req.userId!, {
      address: row.address, chainId: row.chainId, provider: row.provider,
    })
    return { ok: true as const }
  })
  if (!result.ok) {
    res.status(404).json({ error: 'Wallet link not found' })
    return
  }
  res.json({ ok: true })
})

// --- On-chain pending deposits ----------------------------------------
// User completes a `sendTransaction` from their linked wallet to the admin
// treasury address. The frontend POSTs the resulting tx hash + chain here
// IMMEDIATELY (before confirmations). The row stays `pending` until an admin
// (or a future chain-watcher job) verifies the transaction on a block
// explorer and credits the user's WalletBalance via /admin endpoint.
//
// The unique index on txHash dedupes the same submit being fired twice.

const pendingDepositSchema = z.object({
  txHash: z.string().min(1).max(128).optional(),
  chainId: z.string().min(1).max(64).optional(),
  toAddress: z.string().min(1).max(128),
  fromAddress: z.string().min(1).max(128).optional(),
  asset: z.string().min(1).max(12),
  amount: z.number().positive().max(1_000_000),
})

router.post('/pending-deposits', requireAuth, moneyLimiter, idempotency(), async (req: AuthedRequest, res) => {
  const parsed = pendingDepositSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  const submittedTxHash = parsed.data.txHash?.trim()
  const txHash = submittedTxHash || `0x${crypto.randomBytes(32).toString('hex')}`
  const data = {
    userId: req.userId!,
    txHash: txHash.toLowerCase(),
    chainId: (parsed.data.chainId || 'external-wallet').toLowerCase(),
    toAddress: parsed.data.toAddress.toLowerCase(),
    fromAddress: (parsed.data.fromAddress || 'external-wallet').toLowerCase(),
    asset: parsed.data.asset.toUpperCase(),
    amount: parsed.data.amount,
    status: 'pending',
  }
  try {
    const row = await prisma.pendingDeposit.create({ data })
    const transfer = buildTemporaryFundingTransferResult({
      asset: data.asset,
      amount: data.amount,
      destinationAddress: data.toAddress,
      chain: data.chainId,
    })
    // Notify the user that the deposit is queued; funds are not credited yet.
    await prisma.notification.create({
      data: {
        userId: req.userId!,
        kind: 'deposit',
        title: `Deposit pending approval: ${data.amount} ${data.asset}`,
        body: `${transfer.message} Funds will be credited after admin confirmation.`,
      },
    })
    await alertAdminsOfDeposit(req.userId!, data.amount, data.asset, row.id, `Pending deposit ${row.id}; transaction ${data.txHash}.`)
    res.status(201).json({ pendingDeposit: row, transfer })
  } catch (err) {
    // Most likely the unique tx-hash collision (user retried).
    const code = (err as { code?: string }).code
    if (code === 'P2002') {
      const existing = await prisma.pendingDeposit.findUnique({ where: { txHash: data.txHash } })
      res.status(200).json({ pendingDeposit: existing, deduped: true })
      return
    }
    throw err
  }
})

router.get('/pending-deposits', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.pendingDeposit.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json({ pendingDeposits: rows })
})

// --- Withdrawal fee config (public read for authenticated users) ------
const WITHDRAWAL_FEE_KEY = 'withdrawal_fee_config'

router.get('/withdrawal-fee-config', requireAuth, async (_req, res) => {
  const row = await prisma.appSetting.findUnique({ where: { key: WITHDRAWAL_FEE_KEY } })
  if (!row?.value) { res.json({ ratePct: 11.8 }); return }
  try {
    const parsed = JSON.parse(row.value) as { ratePct?: number }
    const ratePct = Number(parsed.ratePct)
    res.json({ ratePct: Number.isFinite(ratePct) ? ratePct : 11.8 })
  } catch {
    res.json({ ratePct: 11.8 })
  }
})

// --- Deposit instructions (admin-managed, all users read) -------------
// One JSON blob keyed `'deposit_instructions'` in AppSetting that stores:
//   { wires: [...], cryptos: [...], web3: { [chainIdHex]: {...} } }
// Admin writes from /admin pages, all signed-in users read.

const DEPOSIT_KEY = 'deposit_instructions'

router.get('/deposit-instructions', requireAuth, async (_req, res) => {
  const row = await prisma.appSetting.findUnique({ where: { key: DEPOSIT_KEY } })
  let data: unknown = null
  if (row?.value) {
    try { data = JSON.parse(row.value) } catch { data = null }
  }
  res.json({ instructions: data, updatedAt: row?.updatedAt ?? null })
})

router.put('/deposit-instructions', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const body = req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Body must be a JSON object' })
    return
  }
  const json = JSON.stringify(body)
  if (json.length > 64_000) {
    res.status(413).json({ error: 'Deposit instructions blob too large' })
    return
  }
  const row = await prisma.appSetting.upsert({
    where: { key: DEPOSIT_KEY },
    create: { key: DEPOSIT_KEY, value: json, updatedBy: req.userId! },
    update: { value: json, updatedBy: req.userId! },
  })
  // Audit so we know who changed deposit destinations and when.
  try {
    await prisma.adminAudit.create({
      data: {
        actorId: req.userId!,
        action: 'deposit_instructions.update',
        payload: json.slice(0, 4000),
      },
    })
  } catch { /* don't fail the write because audit logging hiccupped */ }
  res.json({ instructions: body, updatedAt: row.updatedAt })
})

export default router
