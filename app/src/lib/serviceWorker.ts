export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister()
      console.log('[SW] Unregistered:', registration.scope)
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName)
        console.log('[SW] Deleted cache:', cacheName)
      }
    }
  } catch (err) {
    console.error('[SW] Error during cleanup:', err)
  }
}
