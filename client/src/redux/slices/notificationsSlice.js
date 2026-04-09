/**
 * Notifications Slice - Redux State Management for Notifications
 * Handles notifications listing and management
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null
};

// Async Thunks

// Get notifications
export const getNotifications = createAsyncThunk(
  'notifications/getAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/notifications/all', { params });
      if (response.data?.success) {
        return response.data.notifications || [];
      }
      return rejectWithValue(response.data?.message || 'Failed to get notifications');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get notifications');
    }
  }
);

// Get unread count
export const getUnreadCount = createAsyncThunk(
  'notifications/getUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/notifications/count');
      if (response.data?.success) {
        return response.data.unreadCount || response.data.count || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }
);

// Mark notification as read
export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/notifications/${notificationId}/read`);
      if (response.data?.success) {
        return notificationId;
      }
      return rejectWithValue('Failed to mark as read');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark as read');
    }
  }
);

// Mark all as read
export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/notifications/mark-all-read');
      if (response.data?.success) {
        return true;
      }
      return rejectWithValue('Failed to mark all as read');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

// Notifications Slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Add notification (from socket)
    addNotification: (state, action) => {
      state.notifications = [action.payload, ...state.notifications];
      state.unreadCount += 1;
    },
    // Clear all notifications
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      // Get Notifications
      .addCase(getNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        state.error = null;
      })
      .addCase(getNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Unread Count
      .addCase(getUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      
      // Mark As Read
      .addCase(markAsRead.fulfilled, (state, action) => {
        state.notifications = state.notifications.map(n =>
          n._id === action.payload ? { ...n, read: true } : n
        );
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      })
      
      // Mark All As Read
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map(n => ({ ...n, read: true }));
        state.unreadCount = 0;
      });
  }
});

export const { 
  clearError, 
  addNotification, 
  clearNotifications 
} = notificationsSlice.actions;
export default notificationsSlice.reducer;
