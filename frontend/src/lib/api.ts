import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api',
  withCredentials: true,
  timeout: 30000,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config
    if (err.response?.status === 401 && !originalRequest?._retry) {
      const isLoginOrRegister = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/register')
      if (!isLoginOrRegister) {
        originalRequest._retry = true
        try {
          await axios.post('/api/auth/refresh', {}, { withCredentials: true })
          return api.request(originalRequest)
        } catch (refreshErr) {
          if (typeof window !== 'undefined') {
            const isPublicRoute = (path: string) => {
              const publicRoutes = ['/', '/login', '/register']
              if (publicRoutes.includes(path)) return true
              if (path === '/blog' || path.startsWith('/blog/')) return true
              return false
            }
            if (!isPublicRoute(window.location.pathname)) {
              window.location.href = '/login'
            }
          }
          return Promise.reject(refreshErr)
        }
      }
    }
    return Promise.reject(err)
  }
)

export function getErrorMessage(err: any, defaultMsg: string = '操作失败，请重试。'): string {
  if (err.response?.data?.detail) {
    const detail = err.response.data.detail
    if (Array.isArray(detail)) {
      return detail
        .map((e: any) => {
          const field = e.loc ? e.loc[e.loc.length - 1] : ''
          const fieldMap: Record<string, string> = {
            username: '用户名',
            email: '邮箱地址',
            password: '密码',
            display_name: '显示昵称',
            invite_code: '邀请码',
          }
          const translatedField = fieldMap[field] || field
          let msg = e.msg || '格式错误'
          if (msg.includes('at least 3 characters') || msg.includes('should have at least 3 characters')) {
            msg = '长度不能少于 3 个字符'
          } else if (msg.includes('at least 8 characters') || msg.includes('should have at least 8 characters')) {
            msg = '长度不能少于 8 个字符'
          } else if (msg === 'field required') {
            msg = '必填字段'
          } else if (msg.includes('value is not a valid email address')) {
            msg = '请输入有效的邮箱地址'
          }
          return translatedField ? `${translatedField}: ${msg}` : msg
        })
        .join('; ')
    }
    if (typeof detail === 'string') {
      return detail
    }
    if (typeof detail === 'object' && detail !== null) {
      return JSON.stringify(detail)
    }
  }

  // Handle custom backend response like { message: "..." } or { error: "..." }
  if (err.response?.data?.message && typeof err.response.data.message === 'string') {
    return err.response.data.message
  }
  if (err.response?.data?.error && typeof err.response.data.error === 'string') {
    return err.response.data.error
  }

  if (typeof err === 'string') {
    return err
  }
  if (err instanceof Error) {
    return err.message && err.message !== '[object Object]' ? err.message : defaultMsg
  }
  if (err && typeof err === 'object') {
    if (err.message && typeof err.message === 'string' && err.message !== '[object Object]') {
      return err.message
    }
    try {
      const stringified = JSON.stringify(err)
      return stringified !== '{}' ? stringified : defaultMsg
    } catch {
      return defaultMsg
    }
  }
  return defaultMsg
}

export default api
