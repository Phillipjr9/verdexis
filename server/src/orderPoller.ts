// Disabled temporarily - was causing build failures.
export function startOrderPoller(_opts: { intervalMs?: number } = {}) {
  console.log('[orderPoller] Disabled')
  return () => {}
}
