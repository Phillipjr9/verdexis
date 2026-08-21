/**
 * Admin queue for user deposit requests.
 *
 * Two storage paths exist in the product:
 *   1. Transaction rows with kind=deposit + status=pending  (wire / ACH / wallet form)
 *   2. PendingDeposit rows                                  (on-chain hash submissions)
 *
 * This router lists and resolves both so the admin console is the single approval surface.
 */
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { recordLedgerTransaction } from '../services/ledger.js'

const router: Router = Router()

router.get('/pending-deposits', requireAuth, requireAdmin, async (_req, res) => {
  try {
    // status/kind are free-form strings in schema — match common variants
    const pendingStatuses = ['pending', 'Pending', 'PENDING', 'awaiting_approval', 'submitted']
    const [txRows, onchain] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [
            { kind: 'deposit', status: { in: pendingStatuses } },
            { kind: 'Deposit', status: { in: pendingStatuses } },
          ],
        },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }).catch((e) => {
        console.error('[admin] list pending tx deposits failed', e)
        return []
      }),
      prisma.pendingDeposit.findMany({
        where: { status: { in: pendingStatuses } },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }).catch((e) => {
        console.error('[admin] list pending on-chain deposits failed', e)
        return []
      }),
    ])

    const deposits = [
      ...txRows.map((t) => ({
        id: t.id,
        source: 'transaction' as const,
        userId: t.userId,
        amount: t.amount,
        currency: t.currency,
        asset: t.currency,
        reference: t.reference || '',
        note: t.reference || '',
        status: t.status,
        createdAt: t.createdAt,
        user: t.user,
        txHash: null as string | null,
        fromAddress: '',
        toAddress: '',
      })),
      ...onchain.map((d) => ({
        id: d.id,
        source: 'onchain' as const,
        userId: d.userId,
        amount: d.amount,
        currency: d.asset,
        asset: d.asset,
        reference: d.txHash || d.note || '',
        note: d.note || '',
        status: d.status,
        createdAt: d.createdAt,
        user: d.user,
        txHash: d.txHash,
        fromAddress: d.fromAddress,
        toAddress: d.toAddress,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    res.json({ deposits, count: deposits.length })
  } catch (e) {
    console.error('[admin] list pending deposits', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list pending deposits' })
  }
})

router.post('/pending-deposits/:id/approve', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const id = req.params.id
  try {
    const tx = await prisma.transaction.findUnique({ where: { id } })
    if (tx && String(tx.kind).toLowerCase() === 'deposit' && String(tx.status).toLowerCase() === 'pending') {
      await prisma.$transaction(async (client) => {
        await recordLedgerTransaction({
          tx: client,
          userId: tx.userId,
          asset: tx.currency,
          amount: tx.amount,
          entryType: 'debit',
          kind: 'deposit',
          eventType: 'deposit_admin_approve',
          sourceType: 'pending_transaction',
          sourceId: tx.id,
          externalRef: `approve-tx:${tx.id}`,
          description: tx.reference || `Approved deposit ${tx.id}`,
          reference: tx.reference || undefined,
          subType: 'admin_approve',
          recordTransaction: false,
        })
        await client.transaction.update({
          where: { id: tx.id },
          data: { status: 'completed' },
        })
      })
      res.json({ ok: true, source: 'transaction', id })
      return
    }

    const pending = await prisma.pendingDeposit.findUnique({ where: { id } })
    if (!pending) {
      res.status(404).json({ error: 'Pending deposit not found' })
      return
    }
    if (String(pending.status).toLowerCase() !== 'pending') {
      res.status(400).json({ error: `Deposit already ${pending.status}` })
      return
    }

    await prisma.$transaction(async (client) => {
      const ledger = await recordLedgerTransaction({
        tx: client,
        userId: pending.userId,
        asset: pending.asset,
        amount: pending.amount,
        entryType: 'debit',
        kind: 'deposit',
        eventType: 'deposit_onchain_approve',
        sourceType: 'pending_deposit',
        sourceId: pending.id,
        externalRef: `approve-pending:${pending.id}`,
        description: `On-chain deposit ${pending.txHash}`,
        reference: pending.txHash,
        subType: 'admin_approve',
        recordTransaction: true,
      })
      await client.pendingDeposit.update({
        where: { id: pending.id },
        data: {
          status: 'completed',
          creditedTxId: (ledger as { transaction?: { id?: string }; entry?: { id?: string } }).transaction?.id
            ?? (ledger as { entry?: { id?: string } }).entry?.id
            ?? undefined,
        },
      })
    })

    res.json({ ok: true, source: 'onchain', id })
  } catch (e) {
    console.error('[admin] approve pending deposit', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Approve failed' })
  }
})

router.post('/pending-deposits/:id/reject', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const id = req.params.id
  const note =
    typeof req.body?.note === 'string'
      ? req.body.note
      : typeof req.body?.reason === 'string'
        ? req.body.reason
        : ''
  try {
    const tx = await prisma.transaction.findUnique({ where: { id } })
    if (tx && String(tx.kind).toLowerCase() === 'deposit' && String(tx.status).toLowerCase() === 'pending') {
      await prisma.transaction.update({
        where: { id },
        data: {
          status: 'rejected',
          reference: note
            ? `${tx.reference || 'Deposit'} (rejected: ${note})`
            : `${tx.reference || 'Deposit'} (rejected)`,
        },
      })
      res.json({ ok: true, source: 'transaction', id })
      return
    }

    const pending = await prisma.pendingDeposit.findUnique({ where: { id } })
    if (!pending) {
      res.status(404).json({ error: 'Pending deposit not found' })
      return
    }
    if (String(pending.status).toLowerCase() !== 'pending') {
      res.status(400).json({ error: `Deposit already ${pending.status}` })
      return
    }
    await prisma.pendingDeposit.update({
      where: { id },
      data: {
        status: 'rejected',
        note: note || pending.note || 'Rejected by admin',
      },
    })
    res.json({ ok: true, source: 'onchain', id })
  } catch (e) {
    console.error('[admin] reject pending deposit', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Reject failed' })
  }
})

export default router
