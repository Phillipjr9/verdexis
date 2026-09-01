// Admin Bonus Management Endpoint
// POST /api/admin/users/:id/bonus

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { notifyAdminFundedUser } from '../services/transferNotifications.js'
import { sendEmailNotification } from '../notificationService.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

const bonusSchema = z.object({
  currency: z.string().min(1).max(10).transform((s) => s.toUpperCase()).default('USD'),
  amount: z.number().positive({ message: 'Bonus amount must be positive' }),
  note: z.string().max(500).optional(),
  notify: z.boolean().default(true),
  lockWithdrawal: z.boolean().default(false),
  processingFee: z.number().min(0).max(100).optional(),
  processingFeeFixed: z.number().min(0).optional(),
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

router.post('/users/:id/bonus', idempotency(), async (req: AuthedRequest, res) => {
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
  const rawIdempotencyKey = req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key']
  const idempotencyKey = rawIdempotencyKey
    ? Array.isArray(rawIdempotencyKey) ? rawIdempotencyKey[0] : String(rawIdempotencyKey)
    : undefined
  const operationKey = idempotencyKey
    ?? `admin_bonus:${userId}:${currency}:${amount}:${lockWithdrawal}:${processingFee ?? 0}:${processingFeeFixed ?? 0}:${note ?? ''}`

  let feePercent = 0
  let feeFixed = 0
  if (lockWithdrawal) {
    feePercent = processingFee ?? 0
    feeFixed = processingFeeFixed ?? 0
  }

  const result = await prisma.$transaction(async (tx) => {
    const reference = note?.trim() || 'Account credit'
    const ledgerResult = await recordLedgerTransaction({
      tx,
      userId,
      asset: currency,
      amount,
      entryType: 'debit',
      kind: 'deposit',
      eventType: 'bonus_grant',
      sourceType: 'admin_bonus',
      sourceId: operationKey,
      externalRef: operationKey,
      idempotencyKey: operationKey,
      description: reference,
      reference,
      subType: 'bonus',
      recordTransaction: true,
      createdBy: req.userId!,
    })

    const balance = ledgerResult.walletBalance
    const transaction = ledgerResult.transaction

    if (lockWithdrawal) {
      let prefs: Record<string, unknown> = {}
      try {
        if (user.prefs) prefs = JSON.parse(user.prefs)
      } catch {
        prefs = {}
      }

      prefs.bonusLock = {
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

      await tx.user.update({
        where: { id: userId },
        data: { prefs: JSON.stringify(prefs) },
      })
    }

    return { balance, transaction }
  })

  if (notify) {
    let notificationBody = `You've received ${symbol}${amount.toLocaleString()} ${currency}${note ? ': ' + note : ''}.`
    if (lockWithdrawal) {
      const feeInfo: string[] = []
      if (feePercent > 0) feeInfo.push(`${feePercent}%`)
      if (feeFixed > 0) feeInfo.push(`$${feeFixed}`)
      const feeText = feeInfo.length > 0 ? ` (Processing fee: ${feeInfo.join(' + ')})` : ''
      notificationBody += `\n\nWithdrawal Lock Active${feeText}\n${unlockMessage}`
    }

    await notifyAdminFundedUser({
      userId,
      email: user.email,
      name: user.name,
      amount,
      currency,
      note: notificationBody,
    }).catch((e) => console.warn('[adminBonus] email notify failed', e))
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
    bonusLock: lockWithdrawal
      ? {
          active: true,
          requiresProcessingFee: feePercent > 0 || feeFixed > 0,
          feePercent,
          feeFixed,
        }
      : null,
  })
})

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
  res.json({ bonusLock: prefs.bonusLock || null })
})

router.post('/users/:id/bonus/unlock', async (req: AuthedRequest, res) => {
  const userId = req.params.id
  const { note } = req.body as { note?: string }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, prefs: true } })
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
  delete prefs.bonusLock
  await prisma.user.update({ where: { id: userId }, data: { prefs: JSON.stringify(prefs) } })
  await prisma.notification.create({
    data: {
      userId,
      kind: 'system',
      title: 'Bonus withdrawal unlocked',
      body: note || 'Your bonus has been unlocked. You can now withdraw funds.',
    },
  }).catch(() => {})
  if (user.email) {
    void sendEmailNotification(
      user.email,
      'Bonus withdrawal unlocked',
      note || 'Your bonus has been unlocked. You can now withdraw funds.'
    ).catch((e) => console.warn('[adminBonus] unlock email notify failed', e))
  }
  await audit(req.userId!, 'user.bonus.unlock', userId, { note })
  res.json({ ok: true, message: 'Bonus unlocked successfully' })
})

export default router
