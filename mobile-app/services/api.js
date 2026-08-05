const API_ORIGIN = 'https://lovestory1314.fun'

function getAccessToken() {
  return uni.getStorageSync('lumino_access_token') || ''
}

function request(path, method = 'GET', data = null, extra = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...extra.headers }
    const token = getAccessToken()
    if (token) headers.Authorization = 'Bearer ' + token
    uni.request({
      url: API_ORIGIN + '/api' + path,
      method,
      data,
      header: headers,
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

export function login(usernameOrEmail, password) {
  return request('/auth/login', 'POST', {
    username_or_email: usernameOrEmail,
    password,
  }).then((data) => {
    if (data && data.access_token) uni.setStorageSync('lumino_access_token', data.access_token)
    return data
  })
}

export function clearLogin() {
  uni.removeStorageSync('lumino_access_token')
  return request('/auth/logout', 'POST').catch(() => null)
}

export function getCurrentUser() {
  return request('/auth/me')
}

export function createAIDraft(data) {
  return request('/ai/drafts', 'POST', data)
}

export function ingestAttachment(filePath, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const token = getAccessToken()
    const headers = {}
    if (token) headers.Authorization = 'Bearer ' + token
    uni.uploadFile({
      url: API_ORIGIN + '/api/ai/ingest',
      filePath,
      name: 'file',
      formData: { filename: fileName },
      header: headers,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(response.data))
          } catch (error) {
            reject(error)
          }
          return
        }
        reject(new Error('附件解析失败'))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

export function uploadImage(filePath, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const token = getAccessToken()
    const headers = {}
    if (token) headers.Authorization = 'Bearer ' + token
    uni.uploadFile({
      url: API_ORIGIN + '/api/upload',
      filePath,
      name: 'file',
      header: headers,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(response.data))
          } catch (error) {
            reject(error)
          }
          return
        }
        reject(new Error('图片上传失败'))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

export function listChatSessions() {
  return request('/chat/sessions')
}

export function createChatSession(title = 'Lumino AI 对话', model = 'qwen') {
  return request('/chat/sessions', 'POST', { title, model })
}

export function getChatSession(id) {
  return request('/chat/sessions/' + id)
}

export function sendChatMessage(id, content, attachments = []) {
  return request('/chat/sessions/' + id + '/messages', 'POST', { content, attachments })
}

export function getSpaces() {
  return request('/spaces')
}
