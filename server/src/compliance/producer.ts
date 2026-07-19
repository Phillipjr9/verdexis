import Queue from 'bull'
import { env } from '../env.js'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const complianceQueue = new Queue('compliance', { redis: redisUrl })

export interface ComplianceTx {
  txId: string
  userId?: string
  from: string
  to: string
  amount: number
  currency: string
  metadata?: Record<string, unknown>
}

export async function enqueueComplianceCheck(tx: ComplianceTx): Promise<Queue.Job> {
  return complianceQueue.add(tx, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } })
}
