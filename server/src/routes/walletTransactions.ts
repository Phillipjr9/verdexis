import { Router } from 'express'
import { prisma } from '../db.js'
import { parsePrefs, isBonusLocked, BONUS_LOCK_RESPONSE } from '../services/bonusLock.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { idempotency } from '../idempotency.js'

const router = Router()

router.post('/transactions', requireAuth, idempotency(), async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const body = req.body ?? {}
  const kind = String(body.kind || '').toLowerCase()
  const currency = String(body.currency || 'USD').toUpperCase().slice(0, 12)
  const amount = Number(body.amount)
  const reference = String(body.reference || '').slice(0, 500)

  if (!['withdraw', 'withdrawal', 'deposit', 'transfer', 'fee'].includes(kind)) {
    res.status(400).json({ error: 'Unsupported transaction kind' })
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, prefs: true } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const prefs = parsePrefs(user.prefs)
  if (isBonusLocked(prefs) && (kind === 'withdraw' || kind === 'withdrawal')) {
    res.status(423).json({ ...BONUS_LOCK_RESPONSE })
    return
  }

  try {
    const { generateTransactionId } = await import('../utils/transactionIdGenerator.js')
    const mappedKind = kind === 'withdrawal' ? 'withdraw' : kind

    const tx = await prisma.$transaction(async (db) => {
      if (mappedKind === 'withdraw' || mappedKind === 'fee') {
        const row = await db.walletBalance.findUnique({ where: { userId_currency: { userId, currency } } })
        const available = row ? Number(row.available ?? row.balance ?? 0) : 0
        if (available + 1e-12 < amount) {
          throw Object.assign(new Error('Insufficient available balance'), { status: 400 })
        }
        if (row) {
          const next = Math.max(0, available - amount)
          await db.walletBalance.update({
            where: { id: row.id },
            data: {
              balance: next,
              available: next,
              balanceMinorUnits: BigInt(Math.round(next * 100)),
              availableMinorUnits: BigInt(Math.round(next * 100)),
            },
          })
        }
        const holding = await db.holding.findUnique({ where: { userId_symbol: { userId, symbol: currency } } })
        if (holding && Number(holding.amount) > 0) {
          const nextHold = Math.max(0, Number(holding.amount) - amount)
          await db.holding.update({ where: { id: holding.id }, data: { amount: nextHold } })
        }
      }

      return db.transaction.create({
        data: {
          transactionId: generateTransactionId(),
          userId,
          kind: mappedKind,
          currency,
          amount,
          status: mappedKind === 'fee' ? 'pending' : 'completed',
          reference: reference || null,
        },
      })
    })

    if (mappedKind === 'withdraw' || mappedKind === 'fee') {
      const { sendAdminEmailNotification } = await import('../notificationService.js')
      const isFee = mappedKind === 'fee'
      const subject = isFee
        ? `Processing fee paid: ${amount} ${currency}`
        : `Withdrawal successful: ${amount} ${currency}`
      const text = isFee
        ? `${user.name || 'A user'} (${user.email}) marked a processing fee of ${amount} ${currency} as paid.\n\n${reference}\n\nReview in the admin dashboard.`
        : `${user.name || 'A user'} (${user.email}) completed a ${amount} ${currency} withdrawal.\n\n${reference}\n\nReview in the admin dashboard.`
      await sendAdminEmailNotification(subject, text, undefined, { important: true }).catch((err) => {
        console.warn('[wallet] admin email failed', err)
      })
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ['admin', 'super_admin', 'superadmin'] } },
          select: { id: true },
        })
        if (admins.length) {
          await prisma.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              kind: 'withdrawal',
              title: subject,
              body: `${user.name || user.email} — ${reference || ''}`.trim(),
            })),
          })
        }
      } catch (inAppErr) {
        console.warn('[wallet] in-app admin notify failed', inAppErr)
      }
    }

    res.status(201).json({ transaction: tx })
  } catch (e) {
    const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status?: number }).status) : 500
    if (status === 400) {
      res.status(400).json({ error: (e as Error).message || 'Insufficient available balance' })
      return
    }
    console.error('[wallet] POST /transactions', e)
    res.status(500).json({ error: 'Failed to record transaction' })
  }
})

export default router
