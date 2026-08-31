const { ACTIVE_CACHE_NAMES } = require('./pwa-cache-names')

const runtimeCaching = [
  {
    urlPattern: ({ url }) =>
      url.origin === self.location.origin && url.pathname.startsWith('/api/'),
    handler: 'NetworkOnly',
    method: 'GET',
  },
  {
    urlPattern: ({ request, url }) =>
      url.origin === self.location.origin &&
      (request.mode === 'navigate' ||
        request.destination === 'document' ||
        request.headers.get('RSC') === '1' ||
        url.searchParams.has('_rsc') ||
        url.pathname.startsWith('/_next/data/')),
    handler: 'NetworkOnly',
    method: 'GET',
  },
  {
    urlPattern: ({ url }) =>
      url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'),
    handler: 'CacheFirst',
    method: 'GET',
    options: {
      cacheName: ACTIVE_CACHE_NAMES.nextStatic,
      cacheableResponse: {
        statuses: [0, 200],
      },
      expiration: {
        maxEntries: 128,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      },
    },
  },
]

// Do not eagerly download every route bundle or public asset. Hashed Next.js
// assets are cached only after the browser actually requests them.
const buildExcludes = [/.*/]
const publicExcludes = ['!**/*']

module.exports = {
  buildExcludes,
  publicExcludes,
  runtimeCaching,
}
