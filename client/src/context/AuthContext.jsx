import { createContext, useContext, useState, useEffect } from 'react'

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
      const response = await fetch('/api/users/profile', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.log('Not authenticated')
    } finally {
      setLoading(false)
    }
  }

  const login = (userData) => {
    setUser(userData)
  }

<<<<<<< HEAD
  const logout = () => {
    setUser(null)
=======
  // Register function
  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      if (response.data?.success) {
        // Store user ID for OTP verification if provided
        if (response.data.userId) {
          localStorage.setItem('pendingUserId', response.data.userId)
        }
        return { 
          success: true, 
          message: response.data.message || 'Registration successful! Please verify your email.',
          redirectUrl: response.data.redirectUrl || '/verify-otp'
        }
      }
      return { success: false, message: response.data?.message || 'Registration failed' }
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message)
      return { 
        success: false, 
        message: error.response?.data?.message || 'Registration failed. Please try again.' 
      }
    }
>>>>>>> 2d6981d (fix: backend services configuration and registration flow improvements)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuth
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
