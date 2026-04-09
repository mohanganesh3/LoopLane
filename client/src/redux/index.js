/**
 * Redux Exports
 * Central export point for all Redux functionality
 */

// Store
export { store, persistor } from './store';

// Auth slice (sync reducers only — AuthContext is the source of truth)
export {
  setUser,
  clearUser,
  clearError as clearAuthError,
  updateUserLocal,
  resetTwoFactor,
  setLoading as setAuthLoading
} from './slices/authSlice';

// Rides slice
export {
  searchRides,
  getRideById,
  getMyRides,
  createRide,
  cancelRide,
  clearError as clearRidesError,
  setFilters as setRideFilters,
  resetFilters as resetRideFilters,
  clearSearchResults,
  clearCurrentRide,
  setCurrentPage
} from './slices/ridesSlice';

// Bookings slice
export {
  getMyBookings,
  getBookingById,
  createBooking,
  cancelBooking,
  confirmBooking,
  clearError as clearBookingsError,
  setFilters as setBookingFilters,
  clearCurrentBooking,
  updateBookingStatus
} from './slices/bookingsSlice';

// UI slice
export {
  toggleTheme,
  setTheme,
  toggleSidebar,
  setSidebar,
  openModal,
  closeModal,
  setGlobalLoading,
  addAlert,
  removeAlert,
  clearAlerts,
  setSearchQuery,
  toggleMobileMenu,
  setMobileMenu
} from './slices/uiSlice';
