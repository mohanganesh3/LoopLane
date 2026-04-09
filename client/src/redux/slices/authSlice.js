/**
 * Auth Slice - Redux State Management for Authentication
 * Sync-only reducers — AuthContext is the source of truth.
 * These reducers exist so AuthContext can mirror state into Redux for persistence.
 */

import { createSlice } from '@reduxjs/toolkit';

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  authChecked: false,
  requiresTwoFactor: false,
};

// Auth Slice (sync reducers only — async auth logic lives in AuthContext)
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Set user directly (for context sync)
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.authChecked = true;
    },
    // Clear user (logout sync)
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Update user locally
    updateUserLocal: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    // Reset two-factor requirement
    resetTwoFactor: (state) => {
      state.requiresTwoFactor = false;
    },
    // Set loading
    setLoading: (state, action) => {
      state.loading = action.payload;
    }
  }
});

export const { setUser, clearUser, clearError, updateUserLocal, resetTwoFactor, setLoading } = authSlice.actions;
export default authSlice.reducer;
