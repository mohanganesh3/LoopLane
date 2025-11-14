import axios from 'axios'

// In development, use empty string to leverage Vite proxy
// In production, use actual API URL
const API_URL = import.meta.env.VITE_API_URL || ''

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important: sends cookies with requests
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 for auth endpoints
    if (error.response?.status === 401 && !error.config.url.includes('/auth')) {
      // Redirect to login if unauthorized (but not for login/register attempts)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
