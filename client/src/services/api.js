import axios from 'axios'
import { API_URL as DEFAULT_API_URL } from '../utils/constants'

// Resolve API base URL: prefer explicit env, else fall back to current origin
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL

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
      localStorage.clear()
      const message = response.data.message || 'Your account has been suspended. Please contact support.'
      alert(message)
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // Handle 401 with forceLogout flag
    if (response?.status === 401 && response?.data?.forceLogout) {
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Auto-refresh: if 401 and not already retried, try refreshing the token
    if (response?.status === 401 && !originalRequest._retry) {
      // Don't retry the refresh endpoint itself
      if (originalRequest.url?.includes('/api/token/refresh')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Another refresh is in progress — queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return api(originalRequest)
        }).catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await axios.post(`${API_URL}/api/token/refresh`, {}, { withCredentials: true })
        processQueue(null)
        // Retry the original request with the new cookie
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        // Refresh failed — token fully expired, force logout
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
