import { complianceQueue } from './producer.js'
import { prisma } from '../db.js'
import { pushNotifications } from '../pushNotificationService.js'

// Simple mock sanctions list for placeholder
const SANCTIONS_HINTS = ['blocked', 'sanctioned', 'badguy']

complianceQueue.process(async (job) => {
  const tx = job.data

  // Mock check: if address contains hint or amount > threshold mark suspicious
  const suspect = SANCTIONS_HINTS.some((h) => tx.from.includes(h) || tx.to.includes(h)) || tx.amount > 100000

  const finding = {
    txId: tx.txId,
    userId: tx.userId || null,
    suspect,
    reason: suspect ? 'mock-sanctions-match-or-large-amount' : 'clean',
    timestamp: new Date().toISOString(),
    payload: tx,
  }

  try {
    // Store structured compliance finding
    await prisma.complianceFinding.upsert({
      where: { txId: tx.txId },
      create: {
        txId: tx.txId,
        userId: tx.userId,
        suspect,
        reason: finding.reason,
        payload: JSON.stringify(tx),
      },
      update: {
        userId: tx.userId,
        suspect,
        reason: finding.reason,
        payload: JSON.stringify(tx),
      },
    })

    if (finding.suspect && tx.userId) {
      // Send a push notification if possible
      await pushNotifications.sendToUser(tx.userId, {
        title: 'Suspicious transaction detected',
        body: `Transaction ${tx.txId} flagged by compliance checks`,
        data: { type: 'compliance_flag', txId: tx.txId },
      } as any)
    }

    console.log(`[compliance] processed tx ${tx.txId} suspect=${finding.suspect}`)
  } catch (err) {
    console.error('[compliance] processing failed:', err)
    throw err
  }
})
