import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { notifyDepositEvent } from '../services/emailHooks.js'

const router = Router()

// Validate pending deposit before crediting
const validatePendingDepositSchema = z.object({
  pendingDepositId: z.string().min(1),
  confirmedAmount: z.number().positive(),
  confirmedNetwork: z.string().min(1),
  blockConfirmations: z.number().min(0),
  explorerUrl: z.string().url(),
})

// Admin validates on-chain deposit before crediting wallet
router.post('/admin/pending-deposits/:id/validate', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = validatePendingDepositSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const pending = await prisma.pendingDeposit.findUnique({ where: { id: req.params.id } })
  if (!pending) {
    res.status(404).json({ error: 'Pending deposit not found' })
    return
  }

  // Validate chain matches what user selected
  if (pending.chainId.toLowerCase() !== parsed.data.confirmedNetwork.toLowerCase()) {
    res.status(400).json({
      error: 'Chain mismatch detected',
      expected: pending.chainId,
      actual: parsed.data.confirmedNetwork,
      reason: 'User selected different network'
    })
    return
  }

  // Validate amount matches claimed
  if (Math.abs(pending.amount - parsed.data.confirmedAmount) > 0.01) {
    res.status(400).json({
      error: 'Amount mismatch detected',
      claimed: pending.amount,
      confirmed: parsed.data.confirmedAmount,
      reason: 'User claimed different amount than sent'
    })
    return
  }

  // Store validation details
  await prisma.pendingDeposit.update({
    where: { id: pending.id },
    data: {
      note: `Validated on-chain: ${parsed.data.blockConfirmations} confirmations, ${parsed.data.explorerUrl}`,
    }
  })

  res.json({
    ok: true,
    validated: true,
    deposit: {
      id: pending.id,
      amount: pending.amount,
      asset: pending.asset,
      network: pending.chainId,
      confirmations: parsed.data.blockConfirmations,
      explorerUrl: parsed.data.explorerUrl
    }
  })
})

// Reject deposit if validation fails
router.post('/admin/pending-deposits/:id/reject', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const rejectSchema = z.object({
    reason: z.enum([
      'wrong_network',
      'wrong_amount',
      'suspicious_activity',
      'user_requested',
      'compliance_hold',
      'other'
    ]),
    note: z.string().max(500).optional(),
  })

  const parsed = rejectSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const pending = await prisma.pendingDeposit.findUnique({ where: { id: req.params.id } })
  if (!pending) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const updated = await prisma.pendingDeposit.update({
    where: { id: pending.id },
    data: {
      status: 'rejected',
      note: `Rejected: ${parsed.data.reason}${parsed.data.note ? '. ' + parsed.data.note : ''}`,
    }
  })

  // Notify user with specific reason
  const reasonMessages: Record<string, string> = {
    wrong_network: 'Asset was sent on wrong network. To recover, contact support with tx hash.',
    wrong_amount: 'Amount received differs from claimed amount. Please clarify before retry.',
    suspicious_activity: 'Transaction flagged as suspicious. Please contact support.',
    user_requested: 'Deposit cancelled per your request.',
    compliance_hold: 'Account compliance hold prevents deposits. Contact support.',
    other: parsed.data.note || 'Deposit could not be processed.'
  }

  await prisma.notification.create({
    data: {
      userId: pending.userId,
      kind: 'deposit',
      title: 'Deposit Rejected',
      body: reasonMessages[parsed.data.reason] || 'Your deposit was rejected. Please contact support.'
    }
  }).catch(() => {})

  const depositUser = await prisma.user.findUnique({ where: { id: pending.userId }, select: { id: true, email: true, name: true } })
  if (depositUser) {
    void notifyDepositEvent(depositUser, {
      status: 'rejected',
      amount: pending.amount,
      asset: pending.asset,
      reference: reasonMessages[parsed.data.reason] || parsed.data.reason,
      id: pending.id,
    })
  }

  res.json({ pendingDeposit: updated })
})

export default router
