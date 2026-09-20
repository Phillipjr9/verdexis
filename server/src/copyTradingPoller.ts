// Disabled temporarily - was causing build failures.
export function startCopyTradingPoller(_opts: { intervalMs?: number } = {}) {
  console.log('[copyTrading] Poller disabled')
  return () => {}
}
