const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const publicDir = path.resolve(__dirname, '..', 'public')
const swPath = path.join(publicDir, 'sw.js')

test('generated service worker keeps dynamic data out of runtime caches', () => {
  assert.equal(fs.existsSync(swPath), true, 'run npm run build before this test')
  const source = fs.readFileSync(swPath, 'utf8')

  assert.match(source, /lumino-next-static-v1/)
  assert.match(source, /NetworkOnly/)
  assert.match(source, /_rsc/)
  assert.match(source, /\/api\//)
  assert.doesNotMatch(source, /cacheName:"(?:apis|others|start-url|next-data|static-data-assets)"/)
  assert.doesNotMatch(source, /NetworkFirst/)
  assert.doesNotMatch(source, /precacheAndRoute|addToCacheList|__WB_MANIFEST/)
})

test('generated worker migration deletes legacy runtime caches', () => {
  const workerFiles = fs
    .readdirSync(publicDir)
    .filter((name) => /^worker-.+\.js$/.test(name))

  assert.equal(workerFiles.length, 1, 'expected exactly one generated custom worker')
  const workerSource = fs.readFileSync(path.join(publicDir, workerFiles[0]), 'utf8')

  for (const cacheName of ['apis', 'others', 'start-url', 'next-data', 'static-data-assets']) {
    assert.match(workerSource, new RegExp(cacheName))
  }
  assert.match(workerSource, /caches\.delete/)
})
