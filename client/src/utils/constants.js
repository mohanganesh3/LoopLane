// API endpoints
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// User roles
export const ROLES = {
  PASSENGER: 'PASSENGER',
  RIDER: 'RIDER',
  ADMIN: 'ADMIN'
}

// Booking status
export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
}

// Ride status
export const RIDE_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
}
