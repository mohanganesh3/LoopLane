/**
 * Bookings Slice - Redux State Management for Bookings
 * Handles booking creation, listing, and status updates
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Initial state
const initialState = {
  bookings: [],
  currentBooking: null,
  loading: false,
  error: null,
  filters: {
    status: 'all',
    sortBy: 'createdAt',
    order: 'desc'
  }
};

// Async Thunks

// Get my bookings
export const getMyBookings = createAsyncThunk(
  'bookings/getMyBookings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/bookings/my-bookings', { params });
      if (response.data?.success) {
        return response.data.bookings || [];
      }
      return rejectWithValue(response.data?.message || 'Failed to get bookings');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get bookings');
    }
  }
);

// Get booking by ID
export const getBookingById = createAsyncThunk(
  'bookings/getById',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/bookings/${bookingId}`);
      if (response.data?.success) {
        return response.data.booking;
      }
      return rejectWithValue(response.data?.message || 'Booking not found');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get booking');
    }
  }
);

// Create booking
export const createBooking = createAsyncThunk(
  'bookings/create',
  async ({ rideId, bookingData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/bookings/create/${rideId}`, bookingData);
      if (response.data?.success) {
        return response.data.booking;
      }
      return rejectWithValue(response.data?.message || 'Failed to create booking');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create booking');
    }
  }
);

// Cancel booking
export const cancelBooking = createAsyncThunk(
  'bookings/cancel',
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/bookings/${bookingId}/cancel`, { reason });
      if (response.data?.success) {
        return { bookingId, status: 'CANCELLED' };
      }
      return rejectWithValue(response.data?.message || 'Failed to cancel booking');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel booking');
    }
  }
);

// Confirm booking (for riders)
export const confirmBooking = createAsyncThunk(
  'bookings/confirm',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/bookings/${bookingId}/accept`);
      if (response.data?.success) {
        return { bookingId, status: 'CONFIRMED' };
      }
      return rejectWithValue(response.data?.message || 'Failed to confirm booking');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to confirm booking');
    }
  }
);

// Bookings Slice
const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    // Set bookings list
    setBookings: (state, action) => {
      state.bookings = action.payload;
    },
    // Set current booking
    setCurrentBooking: (state, action) => {
      state.currentBooking = action.payload;
    },
    // Add a new booking
    addBooking: (state, action) => {
      state.bookings.unshift(action.payload);
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Set filters
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    // Clear current booking
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
    },
    // Update booking status locally
    updateBookingStatus: (state, action) => {
      const { bookingId, status } = action.payload;
      state.bookings = state.bookings.map(booking =>
        booking._id === bookingId ? { ...booking, status } : booking
      );
    }
  },
  extraReducers: (builder) => {
    builder
      // Get My Bookings
      .addCase(getMyBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMyBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
        state.error = null;
      })
      .addCase(getMyBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Booking By ID
      .addCase(getBookingById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getBookingById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBooking = action.payload;
        state.error = null;
      })
      .addCase(getBookingById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create Booking
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = [action.payload, ...state.bookings];
        state.currentBooking = action.payload;
        state.error = null;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Cancel Booking
      .addCase(cancelBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = state.bookings.map(booking =>
          booking._id === action.payload.bookingId 
            ? { ...booking, status: action.payload.status } 
            : booking
        );
        state.error = null;
      })
      .addCase(cancelBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Confirm Booking
      .addCase(confirmBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(confirmBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = state.bookings.map(booking =>
          booking._id === action.payload.bookingId 
            ? { ...booking, status: action.payload.status } 
            : booking
        );
        state.error = null;
      })
      .addCase(confirmBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { 
  setBookings,
  setCurrentBooking,
  addBooking,
  clearError, 
  setFilters, 
  clearCurrentBooking,
  updateBookingStatus 
} = bookingsSlice.actions;
export default bookingsSlice.reducer;
