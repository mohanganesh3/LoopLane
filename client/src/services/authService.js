import api from './api'

// Auth API calls
export const authService = {
  // Login user
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },

  // Register user
  register: async (userData) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },

  // Verify OTP
  verifyOTP: async (otp) => {
    const response = await api.post('/auth/verify-otp', { otp })
    return response.data
  },

  // Resend OTP
  resendOTP: async () => {
    const response = await api.post('/auth/resend-otp')
    return response.data
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  // Reset password
  resetPassword: async (otp, newPassword, confirmPassword) => {
    const response = await api.post('/auth/reset-password', {
      otp,
      newPassword,
      confirmPassword
    })
    return response.data
  },

  // Logout
  logout: async () => {
    const response = await api.post('/auth/logout')
    return response.data
  },

  // Get current user profile
  getCurrentUser: async () => {
    const response = await api.get('/api/users/profile')
    return response.data
  }
}

export default authService
