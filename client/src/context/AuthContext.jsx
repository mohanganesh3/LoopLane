import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await api.get('/api/users/profile')
      if (response.data?.user) {
        setUser(response.data.user)
      }
    } catch (error) {
      console.log('Not authenticated')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Login function that calls API
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      if (response.data?.success) {
        setUser(response.data.user)
        return { 
          success: true, 
          user: response.data.user,
          redirectUrl: response.data.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
        }
      }
      return { success: false, message: response.data?.message || 'Login failed' }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.'
      // Check if OTP verification needed
      if (error.response?.status === 403 && error.response?.data?.requiresVerification) {
        return { success: false, message, redirectUrl: '/verify-otp' }
      }
      return { success: false, message }
    }
  }

  // Register function
  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      if (response.data?.success) {
        return { success: true, message: 'Registration successful! Please verify your email.' }
      }
      return { success: false, message: response.data?.message || 'Registration failed' }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Registration failed' }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
    }
  }

  // Computed property for authentication status
  const isAuthenticated = !!user

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
    setUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export default AuthContext
