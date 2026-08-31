const ACTIVE_CACHE_NAMES = Object.freeze({
  nextStatic: 'lumino-next-static-v1',
})

const LEGACY_RUNTIME_CACHE_NAMES = Object.freeze([
  'start-url',
  'google-fonts-webfonts',
  'google-fonts-stylesheets',
  'static-font-assets',
  'static-image-assets',
  'next-image',
  'static-audio-assets',
  'static-video-assets',
  'static-js-assets',
  'static-style-assets',
  'next-data',
  'static-data-assets',
  'apis',
  'others',
  'cross-origin',
])

module.exports = {
  ACTIVE_CACHE_NAMES,
  LEGACY_RUNTIME_CACHE_NAMES,
}
