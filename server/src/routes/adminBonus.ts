// Admin Bonus Management Endpoint
// POST /api/admin/users/:id/bonus
// Allows admins to give custom bonus amounts with withdrawal locks and processing fees

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

const bonusSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()).default('USD'),
  amount: z.number().positive({ message: 'Bonus amount must be positive' }),
  note: z.string().max(500).optional(),
  notify: z.boolean().default(true),
  
  // Withdrawal lock settings
  lockWithdrawal: z.boolean().default(false),
  processingFee: z.number().min(0).max(100).optional(), // Percentage (0-100%)
  processingFeeFixed: z.number().min(0).optional(), // Fixed USD amount
  unlockMessage: z.string().max(1000).optional().default(
    'To withdraw your bonus, please contact support and pay the processing fee.'
  ),
})

async function audit(actorId: string, action: string, targetUserId: string | null, payload: unknown) {
  try {
    await prisma.adminAudit.create({
      data: {
        actorId,
        action,
        targetUserId: targetUserId ?? undefined,
        payload: payload === undefined ? null : JSON.stringify(payload).slice(0, 4000),
      },
    })
  } catch (e) {
    console.error('[admin audit] CRITICAL: audit logging failed', e)
  }
}

router.post('/users/:id/bonus', async (req: AuthedRequest, res) => {
  const parsed = bonusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const userId = req.params.id
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, prefs: true } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const { currency, amount, note, notify, lockWithdrawal, processingFee, processingFeeFixed, unlockMessage } = parsed.data
  const symbol = currency === 'USD' ? '$' : currency

  // Calculate processing fee amounts
  let feePercent = 0
  let feeFixed = 0
  if (lockWithdrawal) {
    feePercent = processingFee ?? 0
    feeFixed = processingFeeFixed ?? 0
  }

  const result = await prisma.$transaction(async (tx) => {
    // Credit the wallet
    const existing = await tx.walletBalance.findUnique({ where: { userId_currency: { userId, currency } } })
    const nextBalance = (existing?.balance ?? 0) + amount
    const nextAvailable = (existing?.available ?? 0) + amount

    const balance = await tx.walletBalance.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, symbol, balance: nextBalance, available: nextAvailable },
      update: { balance: nextBalance, available: nextAvailable, symbol },
    })

    // Create transaction record
    const reference = note?.trim() || 'Admin bonus'
    const transaction = await tx.transaction.create({
      data: {
        userId,
        kind: 'deposit',
        currency,
        amount,
        status: 'completed',
        subType: 'bonus',
        reference,
      },
    })

    // Set withdrawal lock in user prefs if enabled
    if (lockWithdrawal) {
      let prefs: Record<string, unknown> = {}
      try {
        if (user.prefs) prefs = JSON.parse(user.prefs)
      } catch {
        prefs = {}
      }

      // Store bonus lock info
      const bonusLock = {
        active: true,
        amountUsd: currency === 'USD' ? amount : 0,
        currency,
        amount,
        grantedAt: new Date().toISOString(),
        grantedBy: req.userId,
        processingFeePercent: feePercent,
        processingFeeFixed: feeFixed,
        message: unlockMessage,
        transactionId: transaction.id,
      }

      prefs.bonusLock = bonusLock

      await tx.user.update({
        where: { id: userId },
        data: { prefs: JSON.stringify(prefs) },
      })
    }

    return { balance, transaction }
  })

  // Send notification
  if (notify) {
    let notificationBody = `You've received ${symbol}${amount.toLocaleString()} ${currency} bonus${note ? ': ' + note : ''}.`
    
    if (lockWithdrawal) {
      const feeInfo: string[] = []
      if (feePercent > 0) feeInfo.push(`${feePercent}%`)
      if (feeFixed > 0) feeInfo.push(`$${feeFixed}`)
      const feeText = feeInfo.length > 0 ? ` (Processing fee: ${feeInfo.join(' + ')})` : ''
      notificationBody += `\n\n⚠️ Withdrawal Lock Active${feeText}\n${unlockMessage}`
    }

    await prisma.notification.create({
      data: {
        userId,
        kind: 'deposit',
        title: `Bonus received: ${symbol}${amount.toLocaleString()} ${currency}`,
        body: notificationBody,
      },
    }).catch(() => { /* best-effort */ })
  }

  await audit(req.userId!, 'user.bonus.grant', userId, {
    currency,
    amount,
    note,
    lockWithdrawal,
    processingFeePercent: feePercent,
    processingFeeFixed: feeFixed,
  })

  res.status(201).json({
    balance: result.balance,
    transaction: result.transaction,
    bonusLock: lockWithdrawal ? {
      active: true,
      requiresProcessingFee: feePercent > 0 || feeFixed > 0,
      feePercent,
      feeFixed,
    } : null,
  })
})

// GET bonus lock status
router.get('/users/:id/bonus-lock', async (req: AuthedRequest, res) => {
  const userId = req.params.id
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
  
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  let prefs: Record<string, unknown> = {}
  try {
    if (user.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }

  const bonusLock = prefs.bonusLock || null
  res.json({ bonusLock })
})

// POST unlock bonus (after processing fee paid)
router.post('/users/:id/bonus/unlock', async (req: AuthedRequest, res) => {
  const userId = req.params.id
  const { note } = req.body as { note?: string }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, prefs: true } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  let prefs: Record<string, unknown> = {}
  try {
    if (user.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }

  const bonusLock = prefs.bonusLock as Record<string, unknown> | undefined
  if (!bonusLock || !bonusLock.active) {
    res.status(400).json({ error: 'No active bonus lock found' })
    return
  }

  // Remove the lock
  delete prefs.bonusLock

  await prisma.user.update({
    where: { id: userId },
    data: { prefs: JSON.stringify(prefs) },
  })

  // Send notification
  await prisma.notification.create({
    data: {
      userId,
      kind: 'system',
      title: 'Bonus withdrawal unlocked',
      body: note || 'Your bonus has been unlocked. You can now withdraw funds.',
    },
  }).catch(() => {})

  await audit(req.userId!, 'user.bonus.unlock', userId, { note })

  res.json({ ok: true, message: 'Bonus unlocked successfully' })
})

export default router
