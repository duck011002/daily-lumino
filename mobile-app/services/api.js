let API_ORIGIN = 'https://lovestory1314.fun'
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') API_ORIGIN = ''
}

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

export function getPublicLibrary() {
  return request('/site/profile').then((profile) => {
    const cards = Array.isArray(profile && profile.media_cards) ? profile.media_cards : []
    return cards.filter((card) => card && card.is_public !== false)
  })
}

export function getBlogCategories() {
  return request('/blog/categories')
}

export function getBlogPostsPage(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  const query = entries.length ? '?' + entries.map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&') : ''
  return request('/blog/posts-page' + query)
}

export function getBlogPost(slug) {
  return request('/blog/posts/' + encodeURIComponent(slug))
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

export function createImageUploadTask(filePath, fileName, mimeType, onProgress) {
  return createUploadTask('/upload', filePath, fileName, mimeType, onProgress)
}

function createUploadTask(path, filePath, fileName, mimeType, onProgress) {
  let task = null
  let settled = false
  let rejectUpload = null
  const finish = (callback, value) => {
    if (settled) return
    settled = true
    callback(value)
  }
  const promise = new Promise((resolve, reject) => {
    rejectUpload = reject
    const token = getAccessToken()
    const headers = {}
    if (token) headers.Authorization = 'Bearer ' + token
    task = uni.uploadFile({
      url: API_ORIGIN + '/api' + path,
      filePath,
      name: 'file',
      header: headers,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
              finish(resolve, JSON.parse(response.data))
          } catch (error) {
              finish(reject, error)
          }
          return
        }
          finish(reject, new Error('图片上传失败'))
      },
      fail(error) {
          finish(reject, error)
      },
    })
    if (task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate((event) => onProgress && onProgress(Math.min(100, Math.max(0, Number(event.progress) || 0))))
    }
  })
  return {
    promise,
    abort() {
      if (task && !settled && typeof task.abort === 'function') {
        finish(rejectUpload, new Error('已取消上传'))
        task.abort()
      }
    },
  }
}

export function uploadImage(filePath, fileName, mimeType) {
  return createImageUploadTask(filePath, fileName, mimeType).promise
}

export function createAlbumPhotoUploadTask(spaceId, albumId, filePath, fileName, mimeType, onProgress) {
  return createUploadTask('/spaces/' + spaceId + '/albums/' + albumId + '/photos', filePath, fileName, mimeType, onProgress)
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

export function getSpace(spaceId) {
  return request('/spaces/' + spaceId)
}

export function getSpaceNotes(spaceId) {
  return request('/spaces/' + spaceId + '/notes')
}

export function getSpaceNote(spaceId, noteId) {
  return request('/spaces/' + spaceId + '/notes/' + noteId)
}

export function createSpace(data) {
  return request('/spaces', 'POST', data)
}

export function createSpaceNote(spaceId, data) {
  return request('/spaces/' + spaceId + '/notes', 'POST', data)
}

export function updateSpaceNote(spaceId, noteId, data) {
  return request('/spaces/' + spaceId + '/notes/' + noteId, 'PATCH', data)
}

export function getAlbums(spaceId) {
  return request('/spaces/' + spaceId + '/albums')
}

export function createAlbum(spaceId, data) {
  return request('/spaces/' + spaceId + '/albums', 'POST', data)
}

export function getAlbumPhotos(spaceId, albumId) {
  return request('/spaces/' + spaceId + '/albums/' + albumId + '/photos')
}

export function deleteAlbumPhoto(spaceId, albumId, photoId) {
  return request('/spaces/' + spaceId + '/albums/' + albumId + '/photos/' + photoId, 'DELETE')
}

export function getMyBlogPosts() {
  return request('/blog/me/posts')
}

export function createMyBlogPost(data) {
  return request('/blog/me/posts', 'POST', data)
}

export function updateMyBlogPost(postId, data) {
  return request('/blog/me/posts/' + postId, 'PATCH', data)
}

export function deleteMyBlogPost(postId) {
  return request('/blog/me/posts/' + postId, 'DELETE')
}

export function getTodos(status) {
  return request('/todos' + (status ? '?status_filter=' + status : ''))
}

export function createTodo(data) {
  return request('/todos', 'POST', data)
}

export function updateTodo(todoId, data) {
  return request('/todos/' + todoId, 'PATCH', data)
}

export function deleteTodo(todoId) {
  return request('/todos/' + todoId, 'DELETE')
}

export function getSpaceAnniversaries(spaceId) {
  return request('/spaces/' + spaceId + '/anniversaries')
}

export function createSpaceAnniversary(spaceId, data) {
  return request('/spaces/' + spaceId + '/anniversaries', 'POST', data)
}

export function getSpaceActivities(spaceId) {
  return request('/spaces/' + spaceId + '/activities')
}

export function getDailyDigest() {
  return request('/site/daily-digest')
}

export function ingestUrl(url) {
  return request('/ai/ingest-url', 'POST', { url })
}

