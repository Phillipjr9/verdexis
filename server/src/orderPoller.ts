import { advancedOrdersService } from '../services/advancedOrdersService.js'

export function startOrderPoller(opts: { intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 10_000 // Default: check every 10 seconds
  
  console.log(`[orderPoller] Starting advanced order poller (interval: ${intervalMs}ms)`)
  
  const poll = async () => {
    try {
      const triggered = await advancedOrdersService.checkAndTriggerOrders()
      if (triggered.length > 0) {
        console.log(`[orderPoller] Triggered ${triggered.length} orders`)
      }
    } catch (err) {
      console.error('[orderPoller] Error checking orders:', err instanceof Error ? err.message : String(err))
    }
  }
  
  // Run immediately on startup
  poll().catch(err => console.error('[orderPoller] Initial poll failed:', err))
  
  // Then run on interval
  const intervalId = setInterval(poll, intervalMs)
  
  // Return cleanup function
  return () => {
    clearInterval(intervalId)
    console.log('[orderPoller] Stopped')
  }
}
