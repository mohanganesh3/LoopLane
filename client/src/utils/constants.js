// API endpoints
const resolvedBaseUrl = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

export const API_URL = resolvedBaseUrl

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
