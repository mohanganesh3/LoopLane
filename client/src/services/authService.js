import api from './api'

const getStoredPasswordResetEmail = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return sessionStorage.getItem('passwordResetEmail') || ''
}

// Auth API calls - All routes now use /api prefix
export const authService = {
  // Login user
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password }, { skipAuthRefresh: true })
    return response.data
  },

  // Register user
  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData, { skipAuthRefresh: true })
    return response.data
  },

  // Verify OTP
  verifyOtp: async (otp) => {
    // Get userId from sessionStorage (stored during registration)
    const userId = sessionStorage.getItem('pendingUserId')
    const response = await api.post('/api/auth/verify-otp', { otp, userId }, { skipAuthRefresh: true })
    return response.data
  },

  // Resend OTP
  resendOtp: async () => {
    // Get userId from sessionStorage (stored during registration)
    const userId = sessionStorage.getItem('pendingUserId')
    const response = await api.post('/api/auth/resend-otp', { userId }, { skipAuthRefresh: true })
    return response.data
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email }, { skipAuthRefresh: true })
    return response.data
  },

  // Reset password
  resetPassword: async (otp, newPassword, confirmPassword, email = getStoredPasswordResetEmail()) => {
    if (!email) {
      throw new Error('Reset session expired. Request a new reset code.')
    }

    const response = await api.post(
      '/api/auth/reset-password',
      {
        otp,
        newPassword,
        confirmPassword,
        email
      },
      { skipAuthRefresh: true }
    )
    return response.data
  },

  // Logout
  logout: async () => {
    const response = await api.post('/api/auth/logout', {}, { skipAuthRefresh: true })
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
    const response = await api.post(
      '/api/auth/update-email',
      {
        newEmail,
        password
      },
      { skipAuthRefresh: true }
    )
    return response.data
  },

  // Request account deletion
  requestAccountDeletion: async (password, reason) => {
    const response = await api.post(
      '/api/auth/delete-account',
      {
        password,
        reason
      },
      { skipAuthRefresh: true }
    )
    return response.data
  }
}

export default authService
