import api from './api';

const bookingService = {
  // Get my bookings
  getMyBookings: async (status = 'all', page = 1, limit = 10) => {
    const response = await api.get(`/bookings/my-bookings?status=${status}&page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get booking by ID
  getBookingById: async (id) => {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  },

  // Create booking
  createBooking: async (rideId, data) => {
    const response = await api.post(`/bookings/create/${rideId}`, data);
    return response.data;
  },

  // Cancel booking
  cancelBooking: async (id) => {
    const response = await api.post(`/api/bookings/${id}/cancel`);
    return response.data;
  },

  // Confirm pickup point
  confirmPickup: async (id, pickupPoint) => {
    const response = await api.post(`/bookings/${id}/confirm-pickup`, { pickupPoint });
    return response.data;
  },

  // Get booking payment status
  getPaymentStatus: async (id) => {
    const response = await api.get(`/bookings/${id}/payment`);
    return response.data;
  }
};

export default bookingService;
