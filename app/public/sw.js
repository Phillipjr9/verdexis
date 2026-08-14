// Service Worker for offline support
// THIS SW DOES NOT CACHE HTML - to prevent stale content issues

const CACHE_VERSION = 'verdexis-v2'
const STATIC_CACHE = [
  // Only cache static assets that have hashed filenames
  // DO NOT cache index.html or any HTML files
]

const API_CACHE = 'verdexis-api-v1'

self.addEventListener('install', (event) => {
  // Skip caching on install - we'll cache assets on fetch
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Delete all old caches
          if (key !== CACHE_VERSION && key !== API_CACHE) {
            return caches.delete(key)
          }
          return Promise.resolve()
        })
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // NEVER cache navigation requests or HTML files
  const isNavigationRequest =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')

  if (isNavigationRequest) {
    // Always go to network for HTML - no caching
    event.respondWith(fetch(request))
    return
  }

  // API requests - network first, cache fallback for offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('{"ok":false,"error":"Offline"}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })))
    )
    return
  }

  // Static assets with hashed filenames (e.g., main-abc123.js) - cache first
  const isHashedAsset = /-[a-f0-9]{8,}\.(js|css)$/.test(url.pathname)
  
  if (isHashedAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Other static assets - network first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
