import { Router } from 'express'
import { prisma } from '../db.js'
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

  let prefs: Record<string, unknown> = {}
  try { if (user.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }
  if (prefs.bonusLocked === true && (kind === 'withdraw' || kind === 'withdrawal')) {
    res.status(423).json({
      error: 'Withdrawals are locked until your signup bonus is reviewed.',
      reason: 'bonus_locked',
      whatsapp: 'https://wa.me/17196798790',
      telegram: 'https://t.me/+17196798790',
    })
    return
  }

  try {
    const { generateTransactionId } = await import('../utils/transactionIdGenerator.js')
    const mappedKind = kind === 'withdrawal' ? 'withdraw' : kind
    const tx = await prisma.transaction.create({
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
    console.error('[wallet] POST /transactions', e)
    res.status(500).json({ error: 'Failed to record transaction' })
  }
})

export default router
