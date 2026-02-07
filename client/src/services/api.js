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

// Response interceptor for error handling - Handle suspended/deleted accounts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response
    
    // Handle suspended/deleted/inactive accounts - force logout
    if (response?.status === 403 && response?.data?.forceLogout) {
      // Clear any local storage
      localStorage.clear()
      
      // Show alert with the message
      const message = response.data.message || 'Your account has been suspended. Please contact support.'
      alert(message)
      
      // Force redirect to login
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // Handle 401 when session is invalid
    if (response?.status === 401 && response?.data?.forceLogout) {
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    return Promise.reject(error)
  }
)

export default api
