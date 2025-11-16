import api from './api'

// Auth API calls - All routes now use /api prefix
export const authService = {
  // Login user
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password })
    return response.data
  },

  // Register user
  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData)
    return response.data
  },

  // Verify OTP
  verifyOtp: async (otp) => {
    const response = await api.post('/api/auth/verify-otp', { otp })
    return response.data
  },

  // Resend OTP
  resendOtp: async () => {
    const response = await api.post('/api/auth/resend-otp')
    return response.data
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email })
    return response.data
  },

  // Reset password
  resetPassword: async (otp, newPassword, confirmPassword) => {
    const response = await api.post('/api/auth/reset-password', {
      otp,
      newPassword,
      confirmPassword
    })
    return response.data
  },

  // Logout
  logout: async () => {
    const response = await api.post('/api/auth/logout')
    return response.data
  },

  // Get current user profile
  getCurrentUser: async () => {
    const response = await api.get('/api/user/profile')
    return response.data
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    })
    return response.data
  },

  // Update email
  updateEmail: async (newEmail, password) => {
    const response = await api.post('/api/auth/update-email', {
      newEmail,
      password
    })
    return response.data
  },

  // Request account deletion
  requestAccountDeletion: async (password, reason) => {
    const response = await api.post('/api/auth/delete-account', {
      password,
      reason
    })
    return response.data
  }
}

export default authService
