import { dcaService } from './services/dcaService.js'

let timer: ReturnType<typeof setInterval> | null = null
let running = false

export function startDcaPoller(opts: { intervalMs: number }): void {
  const intervalMs = Math.max(15_000, opts.intervalMs || 60_000)
  if (timer) return

  const tick = async () => {
    if (running) return
    running = true
    try {
      const results = await dcaService.executeDueDCASchedules()
      if (results.length > 0) {
        const ok = results.filter((r) => r.success).length
        console.log(`[dcaPoller] executed ${results.length} due schedule(s), ${ok} succeeded`)
      }
    } catch (err) {
      console.error('[dcaPoller] tick failed', err)
    } finally {
      running = false
    }
  }

  void tick()
  timer = setInterval(() => { void tick() }, intervalMs)
  if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref()
}
