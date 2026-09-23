import { advancedOrdersService } from './services/advancedOrdersService.js'

export function startOrderPoller(opts: { intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 10_000

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

  void poll().catch((err) => console.error('[orderPoller] Initial poll failed:', err))

  const intervalId = setInterval(() => { void poll() }, intervalMs)
  if (typeof intervalId === 'object' && intervalId && 'unref' in intervalId) intervalId.unref()

  return () => {
    clearInterval(intervalId)
    console.log('[orderPoller] Stopped')
  }
}
