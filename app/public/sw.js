// Service Worker for offline support
const CACHE_VERSION = 'verdexis-v1'
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg'
]

const API_CACHE = 'verdexis-api-v1'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CACHE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
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

  // API requests - network first, cache fallback
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

  const isJavaScriptAsset = url.pathname.endsWith('.js')

  if (isJavaScriptAsset) {
    // Use network-first for JS bundles so stale cached chunks do not block
    // dynamic imports after a new deploy.
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
    return
  }

  // Static assets - cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.match(/\.(js|css|woff2?|png|jpg|svg)$/) || url.pathname === '/')) {
          const clone = response.clone()
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
    })
  )
})
