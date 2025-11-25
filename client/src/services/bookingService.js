import api from './api';

const bookingService = {
  // Get my bookings (as passenger)
  getMyBookings: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) {
      if (Array.isArray(params.status)) {
        params.status.forEach(s => queryParams.append('status', s));
      } else {
        queryParams.append('status', params.status);
      }
    }
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const response = await api.get(`/api/bookings/my-bookings?${queryParams.toString()}`);
    return response.data;
  },

  // Get booking by ID
  getBookingById: async (id) => {
    const response = await api.get(`/api/bookings/${id}`);
    return response.data;
  },

  // Create booking request
  createBooking: async (rideId, data) => {
    const response = await api.post(`/api/bookings/create/${rideId}`, data);
    return response.data;
  },

  // Cancel booking
  cancelBooking: async (id, reason) => {
    const response = await api.post(`/api/bookings/${id}/cancel`, { reason });
    return response.data;
  },

  // Accept booking (for rider)
  acceptBooking: async (id) => {
    const response = await api.post(`/api/bookings/${id}/accept`);
    return response.data;
  },

  // Reject booking (for rider)
  rejectBooking: async (id, reason) => {
    const response = await api.post(`/api/bookings/${id}/reject`, { reason });
    return response.data;
  },

  // Confirm pickup with OTP
  confirmPickup: async (id, otp) => {
    const response = await api.post(`/api/bookings/${id}/verify-pickup`, { otp });
    return response.data;
  },

  // Confirm dropoff with OTP
  confirmDropoff: async (id, otp) => {
    const response = await api.post(`/api/bookings/${id}/verify-dropoff`, { otp });
    return response.data;
  },

  // Mark payment as complete
  completePayment: async (id, paymentDetails) => {
    const response = await api.post(`/api/bookings/${id}/complete-payment`, paymentDetails);
    return response.data;
  },

  // Get booking payment status
  getPaymentStatus: async (id) => {
    const response = await api.get(`/api/bookings/${id}`);
    return response.data;
  },

  // Rate booking / leave review
  rateBooking: async (id, reviewData) => {
    console.log('📤 [BookingService] Sending review to:', `/api/reviews/booking/${id}`, reviewData);
    const response = await api.post(`/api/reviews/booking/${id}`, reviewData, { timeout: 30000 });
    console.log('📥 [BookingService] Review response:', response.data);
    return response.data;
  }
};

export default bookingService;
