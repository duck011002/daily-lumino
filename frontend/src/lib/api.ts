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
            const publicRoutes = ['/', '/login', '/register']
            if (!publicRoutes.includes(window.location.pathname)) {
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

export default api
