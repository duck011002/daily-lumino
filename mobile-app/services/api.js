const API_ORIGIN = 'https://lovestory1314.fun'

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: API_ORIGIN + '/api' + path,
      method,
      data,
      timeout: 15000,
      withCredentials: true,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }
        reject(new Error('请求失败'))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

export function normalizeAssetUrl(value) {
  if (!value) return ''
  if (value.startsWith('/')) return API_ORIGIN + value
  if (value.includes('localhost') || value.includes('127.0.0.1')) {
    const marker = value.indexOf('/uploads/')
    if (marker >= 0) return API_ORIGIN + value.slice(marker)
  }
  return value
}

export function getHomeData() {
  return Promise.allSettled([
    request('/site/profile'),
    request('/blog/featured'),
  ]).then((results) => {
    const data = {
      profile: null,
      posts: [],
    }
    if (results[0].status === 'fulfilled') data.profile = results[0].value
    if (results[1].status === 'fulfilled') data.posts = results[1].value
    return data
  })
}

export function getCapabilities() {
  return request('/ai/capabilities')
}

export function getCurrentUser() {
  return request('/auth/me')
}

export function createAIDraft(data) {
  return request('/ai/drafts', 'POST', data)
}

export function getSpaces() {
  return request('/spaces')
}
