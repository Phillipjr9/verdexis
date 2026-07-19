#!/usr/bin/env node
/**
 * DCA Execution Cron Job
 * Run this periodically (daily recommended) to execute due DCA schedules
 *
 * Usage:
 *   node scripts/run-dca-schedules.mjs
 *
 * Or add to cron:
 *   0 8 * * * cd /app && node scripts/run-dca-schedules.mjs
 */

import { dcaService } from '../src/services/dcaService.js'

async function main() {
  const startTime = Date.now()
  console.log('[DCA] Starting execution at', new Date().toISOString())

  try {
    const results = await dcaService.executeDueDCASchedules()

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`[DCA] Execution complete: ${successful} succeeded, ${failed} failed`)

    if (failed > 0) {
      results.filter(r => !r.success).forEach(r => {
        console.error(`[DCA] ${r.scheduleId} (${r.asset}): ${r.error}`)
      })
    }

    const elapsedMs = Date.now() - startTime
    console.log(`[DCA] Total time: ${elapsedMs}ms`)

    process.exit(successful > 0 ? 0 : 1)
  } catch (error) {
    console.error('[DCA] Fatal error:', error)
    process.exit(1)
  }
}

main()
