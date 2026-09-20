// Disabled temporarily - was causing build failures.
export function startStakingYieldPoller(_opts: { intervalMs?: number } = {}) {
  console.log('[stakingYield] Disabled')
  return () => {}
}
