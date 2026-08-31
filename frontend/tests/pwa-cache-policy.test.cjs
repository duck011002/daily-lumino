const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildExcludes,
  publicExcludes,
  runtimeCaching,
} = require('../pwa-cache-policy')
const {
  ACTIVE_CACHE_NAMES,
  LEGACY_RUNTIME_CACHE_NAMES,
} = require('../pwa-cache-names')

global.self = {
  location: {
    origin: 'https://lovestory1314.fun',
  },
}

const request = ({ destination = '', mode = 'cors', rsc = null } = {}) => ({
  destination,
  mode,
  headers: {
    get(name) {
      return name.toLowerCase() === 'rsc' ? rsc : null
    },
  },
})

test('same-origin API GET requests are network only', () => {
  const rule = runtimeCaching[0]
  assert.equal(rule.handler, 'NetworkOnly')
  assert.equal(rule.method, 'GET')
  assert.equal(
    rule.urlPattern({
      url: new URL('https://lovestory1314.fun/api/site/profile'),
    }),
    true
  )
  assert.equal(
    rule.urlPattern({
      url: new URL('https://example.com/api/site/profile'),
    }),
    false
  )
})

test('documents, RSC and Next data requests are network only', () => {
  const rule = runtimeCaching[1]
  assert.equal(rule.handler, 'NetworkOnly')

  const cases = [
    {
      url: new URL('https://lovestory1314.fun/blog'),
      request: request({ mode: 'navigate', destination: 'document' }),
    },
    {
      url: new URL('https://lovestory1314.fun/blog?_rsc=abc123'),
      request: request(),
    },
    {
      url: new URL('https://lovestory1314.fun/blog'),
      request: request({ rsc: '1' }),
    },
    {
      url: new URL('https://lovestory1314.fun/_next/data/build/blog.json'),
      request: request(),
    },
  ]

  for (const value of cases) {
    assert.equal(rule.urlPattern(value), true)
  }

  assert.equal(
    rule.urlPattern({
      url: new URL('https://lovestory1314.fun/icons/icon-192.png'),
      request: request({ destination: 'image' }),
    }),
    false
  )
})

test('only hashed Next.js static assets use CacheFirst', () => {
  const cacheFirstRules = runtimeCaching.filter((rule) => rule.handler === 'CacheFirst')
  assert.equal(cacheFirstRules.length, 1)

  const rule = cacheFirstRules[0]
  assert.equal(rule.options.cacheName, ACTIVE_CACHE_NAMES.nextStatic)
  assert.equal(
    rule.urlPattern({
      url: new URL('https://lovestory1314.fun/_next/static/chunks/app/page-abc123.js'),
    }),
    true
  )
  assert.equal(
    rule.urlPattern({
      url: new URL('https://lovestory1314.fun/blog'),
    }),
    false
  )
})

test('eager precaching is disabled', () => {
  assert.deepEqual(publicExcludes, ['!**/*'])
  assert.equal(buildExcludes.length, 1)
  assert.equal(buildExcludes[0].test('static/chunks/app/page.js'), true)
})

test('legacy caches that may contain pages or API data are migrated', () => {
  for (const cacheName of ['apis', 'others', 'start-url', 'next-data', 'static-data-assets']) {
    assert.equal(LEGACY_RUNTIME_CACHE_NAMES.includes(cacheName), true)
  }
  assert.equal(LEGACY_RUNTIME_CACHE_NAMES.includes(ACTIVE_CACHE_NAMES.nextStatic), false)
})

test('activate migration deletes only known legacy caches', async () => {
  const originalSelf = global.self
  const originalCaches = global.caches
  let activateHandler
  const deletedCacheNames = []

  global.self = {
    addEventListener(name, handler) {
      if (name === 'activate') {
        activateHandler = handler
      }
    },
  }
  global.caches = {
    async keys() {
      return ['apis', 'others', ACTIVE_CACHE_NAMES.nextStatic, 'unrelated-app-cache']
    },
    async delete(cacheName) {
      deletedCacheNames.push(cacheName)
      return true
    },
  }

  try {
    const workerPath = require.resolve('../worker/index')
    delete require.cache[workerPath]
    require(workerPath)

    assert.equal(typeof activateHandler, 'function')
    let migrationPromise
    activateHandler({
      waitUntil(promise) {
        migrationPromise = promise
      },
    })
    await migrationPromise

    assert.deepEqual(deletedCacheNames.sort(), ['apis', 'others'])
  } finally {
    global.self = originalSelf
    global.caches = originalCaches
  }
})
