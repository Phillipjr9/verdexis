import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { prisma } from '../db.js';

const router = Router();

router.get('/audit-trail', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Get all trades
    const trades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    // Get admin audits related to this user
    const audits = await prisma.adminAudit.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({
      trades: trades.map(t => ({
        type: 'TRADE',
        date: t.createdAt,
        symbol: t.symbol,
        side: t.side,
        amount: t.amount,
        price: t.price,
        total: t.total,
        hash: `TRADE_${t.id}` // Mock blockchain hash
      })),
      transactions: transactions.map(tx => ({
        type: 'TRANSACTION',
        date: tx.createdAt,
        kind: tx.kind,
        currency: tx.currency,
        amount: tx.amount,
        status: tx.status,
        reference: tx.reference || `REF_${tx.id}`
      })),
      audits: audits.map(a => ({
        type: 'AUDIT',
        date: a.createdAt,
        action: a.action,
        details: a.payload
      }))
    });
  } catch (error) {
    console.error('Audit trail fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

export default router;
