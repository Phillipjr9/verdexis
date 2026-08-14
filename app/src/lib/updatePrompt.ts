// Lightweight "new build available" notifier.
//
// Compares the build id baked into the bundle (via Vite `define`) against
// /version.json on the server. When they differ we surface a toast that
// reloads with a cache-busting query so iOS Safari (which loves to keep a
// stale index.html) actually picks up the new build.

import { toast } from 'sonner'

declare const __BUILD_ID__: string

const CURRENT = (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev')
let promptShown = false
let autoReloadAttempted = false

// Get URL parameter
function getUrlParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get(name)
}

// Check if we just reloaded (prevent infinite loops)
function isFreshReload(): boolean {
  const navigationType = (performance as unknown as { navigation?: { type?: number } }).navigation?.type
  return navigationType === 1 // TYPE_RELOAD
}

async function checkOnce(): Promise<void> {
  if (promptShown) return
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    })
    if (!res.ok) return
    const { id } = (await res.json()) as { id?: string }
    if (!id || id === CURRENT) return

    // NEW: Auto-reload once if we haven't tried yet and this isn't already a reload
    if (!autoReloadAttempted && !isFreshReload() && !getUrlParam('updated')) {
      autoReloadAttempted = true
      console.log('[Update] New version detected, auto-reloading...')
      // Clear all caches before reload
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
      // Force reload with cache-busting
      const url = new URL(window.location.href)
      url.searchParams.set('updated', id)
      url.searchParams.set('ts', Date.now().toString())
      window.location.replace(url.toString())
      return
    }

    promptShown = true
    toast('A new version is available', {
      description: 'Reload to get the latest changes.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => {
          // Cache-bust the document itself so Safari refetches index.html.
          const url = new URL(window.location.href)
          url.searchParams.set('v', id)
          url.searchParams.set('ts', Date.now().toString())
          window.location.replace(url.toString())
        },
      },
    })
  } catch {
    // Network blip — try again on the next tick.
  }
}

export function initUpdatePrompt(): void {
  if (typeof window === 'undefined') return
  // Initial check after first paint so it doesn't compete with hydration.
  setTimeout(() => { void checkOnce() }, 4000)
  // Re-check every 2 minutes and whenever the tab regains focus.
  setInterval(() => { void checkOnce() }, 120_000)
  window.addEventListener('focus', () => { void checkOnce() })
}
