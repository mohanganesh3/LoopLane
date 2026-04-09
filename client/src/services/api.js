import axios from 'axios'
import { API_URL as DEFAULT_API_URL } from '../utils/constants'

// Resolve API base URL: prefer explicit env, else fall back to current origin
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL
const AUTH_REFRESH_EXCLUDED_PATHS = [
  '/api/token/refresh',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/logout'
]
const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-otp',
  '/admin/login'
])

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important: sends cookies with requests
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
})

// ===== Automatic Token Refresh =====
let isRefreshing = false
let failedQueue = []

const shouldSkipRefresh = (requestConfig = {}) =>
  requestConfig.skipAuthRefresh ||
  AUTH_REFRESH_EXCLUDED_PATHS.some((path) => requestConfig.url?.includes(path))

const redirectToLogin = () => {
  if (typeof window === 'undefined') {
    return
  }

  const currentPath = window.location.pathname
  if (PUBLIC_AUTH_PATHS.has(currentPath)) {
    return
  }

  const loginPath = currentPath.startsWith('/admin') ? '/admin/login' : '/login'
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const redirectUrl = `${loginPath}?redirect=${encodeURIComponent(returnTo)}`

  window.location.replace(redirectUrl)
}

// Clear only app-specific storage keys (not all keys from the origin)
const clearAppStorage = () => {
  localStorage.removeItem('persist:root')
  sessionStorage.removeItem('pendingUserId')
  sessionStorage.removeItem('passwordResetEmail')
}

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Response interceptor - auto-refresh expired access tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const response = error.response
    
    // Handle suspended/deleted/inactive accounts - force logout
    if (response?.status === 403 && response?.data?.forceLogout) {
      clearAppStorage()
      console.warn('[Auth] Force logout:', response.data.message || 'Account suspended')
      redirectToLogin()
      return Promise.reject(error)
    }
    
    // Handle 401 with forceLogout flag
    if (response?.status === 401 && response?.data?.forceLogout) {
      clearAppStorage()
      redirectToLogin()
      return Promise.reject(error)
    }

    // Auto-refresh: if 401 and not already retried, try refreshing the token
    if (response?.status === 401 && !originalRequest._retry) {
      if (shouldSkipRefresh(originalRequest)) {
        return Promise.reject(error)
      }

      // Mark as retry BEFORE queuing to prevent re-trigger on failed retry
      originalRequest._retry = true

      if (isRefreshing) {
        // Another refresh is in progress — queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return api(originalRequest)
        }).catch(err => {
          // If the retried request also fails with 401, redirect to login
          if (err.response?.status === 401) {
            clearAppStorage()
            redirectToLogin()
          }
          return Promise.reject(err)
        })
      }

      isRefreshing = true

      try {
        await axios.post(`${API_URL}/api/token/refresh`, {}, { withCredentials: true })
        processQueue(null)
        // Retry the original request with the new cookie
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        // Refresh failed — token fully expired, force logout
        clearAppStorage()
        redirectToLogin()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
