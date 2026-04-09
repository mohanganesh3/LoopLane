/**
 * Rides Slice - Redux State Management for Rides
 * Handles ride listings, search, filters, and ride details
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Initial state
const initialState = {
  rides: [],
  currentRide: null,
  myRides: [],
  searchResults: [],
  loading: false,
  error: null,
  filters: {
    from: '',
    to: '',
    date: '',
    seats: 1,
    priceRange: { min: 0, max: 1000 },
    sortBy: 'departureTime',
    vehicleType: ''
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalRides: 0
  }
};

// Async Thunks

// Search rides
export const searchRides = createAsyncThunk(
  'rides/search',
  async (searchParams, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/rides/search/results', { params: searchParams });
      if (response.data?.success) {
        return {
          rides: response.data.rides || [],
          pagination: response.data.pagination
        };
      }
      return rejectWithValue(response.data?.message || 'Search failed');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to search rides');
    }
  }
);

// Get ride by ID
export const getRideById = createAsyncThunk(
  'rides/getById',
  async (rideId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/rides/${rideId}`);
      if (response.data?.success) {
        return response.data.ride;
      }
      return rejectWithValue(response.data?.message || 'Ride not found');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get ride');
    }
  }
);

// Get my rides (as rider)
export const getMyRides = createAsyncThunk(
  'rides/getMyRides',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/rides/my-rides');
      if (response.data?.success) {
        return response.data.rides || [];
      }
      return rejectWithValue(response.data?.message || 'Failed to get rides');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get my rides');
    }
  }
);

// Create ride
export const createRide = createAsyncThunk(
  'rides/create',
  async (rideData, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/rides/post', rideData);
      if (response.data?.success) {
        return response.data.ride;
      }
      return rejectWithValue(response.data?.message || 'Failed to create ride');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create ride');
    }
  }
);

// Cancel ride
export const cancelRide = createAsyncThunk(
  'rides/cancel',
  async ({ rideId, reason }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/rides/${rideId}/cancel`, { reason });
      if (response.data?.success) {
        return rideId;
      }
      return rejectWithValue(response.data?.message || 'Failed to cancel ride');
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel ride');
    }
  }
);

// Rides Slice
const ridesSlice = createSlice({
  name: 'rides',
  initialState,
  reducers: {
    // Set rides list
    setRides: (state, action) => {
      state.rides = action.payload;
    },
    // Set search results
    setSearchResults: (state, action) => {
      state.searchResults = action.payload;
    },
    // Set current ride
    setCurrentRide: (state, action) => {
      state.currentRide = action.payload;
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Set filters
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    // Reset filters
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    // Clear search results
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    // Clear current ride
    clearCurrentRide: (state) => {
      state.currentRide = null;
    },
    // Set current page
    setCurrentPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Search Rides
      .addCase(searchRides.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchRides.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload.rides;
        if (action.payload.pagination) {
          state.pagination = action.payload.pagination;
        }
        state.error = null;
      })
      .addCase(searchRides.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Ride By ID
      .addCase(getRideById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRideById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentRide = action.payload;
        state.error = null;
      })
      .addCase(getRideById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get My Rides
      .addCase(getMyRides.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMyRides.fulfilled, (state, action) => {
        state.loading = false;
        state.myRides = action.payload;
        state.error = null;
      })
      .addCase(getMyRides.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create Ride
      .addCase(createRide.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createRide.fulfilled, (state, action) => {
        state.loading = false;
        state.myRides = [action.payload, ...state.myRides];
        state.error = null;
      })
      .addCase(createRide.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Cancel Ride
      .addCase(cancelRide.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelRide.fulfilled, (state, action) => {
        state.loading = false;
        state.myRides = state.myRides.map(ride => 
          ride._id === action.payload ? { ...ride, status: 'CANCELLED' } : ride
        );
        state.error = null;
      })
      .addCase(cancelRide.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { 
  setRides,
  setSearchResults,
  setCurrentRide,
  clearError, 
  setFilters, 
  resetFilters, 
  clearSearchResults, 
  clearCurrentRide,
  setCurrentPage 
} = ridesSlice.actions;
export default ridesSlice.reducer;
