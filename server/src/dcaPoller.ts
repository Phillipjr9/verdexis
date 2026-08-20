import { dcaService } from './services/dcaService.js'

let timer: ReturnType<typeof setInterval> | null = null
let running = false

export function startDcaPoller(opts: { intervalMs: number }): void {
  if (timer) return

  const interval = Math.max(15_000, opts.intervalMs || 60_000)

  const tick = async () => {
    if (running) return
    running = true
    try {
      const results = await dcaService.executeDueDCASchedules()
      if (results.length > 0) {
        const ok = results.filter((r) => r.success).length
        console.log(`[dca-poller] executed ${results.length} schedule(s), ${ok} succeeded`)
      }
    } catch (err) {
      console.error('[dca-poller] tick failed:', err)
    } finally {
      running = false
    }
  }

  // Run once shortly after boot, then on interval
  setTimeout(() => { void tick() }, 5_000)
  timer = setInterval(() => { void tick() }, interval)
  console.log(`[dca-poller] started (interval ${interval}ms)`)
}
