const { LEGACY_RUNTIME_CACHE_NAMES } = require('../pwa-cache-names')

const legacyCacheNames = new Set(LEGACY_RUNTIME_CACHE_NAMES)

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => legacyCacheNames.has(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
  )
})
