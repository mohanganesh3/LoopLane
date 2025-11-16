import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { setUser as setReduxUser, clearUser as clearReduxUser, setLoading as setReduxLoading } from '../redux/slices/authSlice'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const authCheckDone = useRef(false)
  const dispatch = useDispatch()

  // Check if user is logged in on mount - only once
  useEffect(() => {
    if (!authCheckDone.current) {
      authCheckDone.current = true
      checkAuth()
    }
  }, [])

  // Internal helper to sync user state with Redux
  const syncUserWithRedux = (userData) => {
    setUser(userData)
    if (userData) {
      dispatch(setReduxUser(userData))
    } else {
      dispatch(clearReduxUser())
    }
  }

  const checkAuth = async () => {
    dispatch(setReduxLoading(true))
    try {
      // Use the profile endpoint that returns full user data
      const response = await api.get('/api/user/profile')
      if (response.data?.success && response.data?.user) {
        const userData = response.data.user
        
        // Check if user account is suspended or deleted
        if (userData.accountStatus === 'SUSPENDED' || userData.isSuspended) {
          console.log('Account is suspended, logging out...')
          syncUserWithRedux(null)
          localStorage.clear()
          return
        }
        
        if (userData.accountStatus === 'DELETED') {
          console.log('Account is deleted, logging out...')
          syncUserWithRedux(null)
          localStorage.clear()
          return
        }
        
        syncUserWithRedux(userData)
      } else {
        syncUserWithRedux(null)
      }
    } catch (error) {
      // 401/403 is expected when not logged in - don't log as error
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        console.error('Auth check error:', error)
      }
      
      // If account is suspended/deleted, the api interceptor will handle redirect
      // Just clear the user state here
      syncUserWithRedux(null)
    } finally {
      setLoading(false)
      dispatch(setReduxLoading(false))
    }
  }

  // Login function that calls API - ✅ Updated for Two-Factor Auth & Redux
  const login = async (email, password, otp = undefined) => {
    try {
      const response = await api.post('/api/auth/login', { email, password, otp })
      if (response.data?.success) {
        // If user data is returned, set it
        if (response.data.user) {
          setUser(response.data.user)
          dispatch(setReduxUser(response.data.user))
        } else {
          // Fetch user data if not included in login response
          await checkAuth()
        }
        return { 
          success: true, 
          user: response.data.user,
          redirectUrl: response.data.redirectUrl || '/dashboard'
        }
      }
      return { success: false, message: response.data?.message || 'Login failed' }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.'
      // ✅ Check if two-factor authentication is required
      if (error.response?.status === 403 && error.response?.data?.requiresTwoFactor) {
        return { success: false, requiresTwoFactor: true, message }
      }
      // Check if OTP verification needed (during registration)
      if (error.response?.status === 403 && error.response?.data?.requiresVerification) {
        return { success: false, message, redirectUrl: '/verify-otp' }
      }
      return { success: false, message }
    }
  }

  // Register function
  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData)
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
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      // Ignore errors during logout - we're logging out anyway
      console.log('Logout completed')
    } finally {
      setUser(null)
      dispatch(clearReduxUser())
      // Clear any stored data
      localStorage.removeItem('pendingUserId')
    }
  }

  // Refresh user data from server
  const refreshUser = async () => {
    try {
      const response = await api.get('/api/user/profile')
      if (response.data?.success && response.data?.user) {
        setUser(response.data.user)
        dispatch(setReduxUser(response.data.user))
        return response.data.user
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
    return null
  }

  // Update user locally (also syncs to Redux)
  const updateUserData = (userData) => {
    setUser(prev => {
      const newUser = { ...prev, ...userData }
      dispatch(setReduxUser(newUser))
      return newUser
    })
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
    refreshUser,
    updateUser: updateUserData,  // Export as updateUser for backward compatibility
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
