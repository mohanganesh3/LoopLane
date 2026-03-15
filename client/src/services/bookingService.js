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
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    
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

  // Confirm payment received (rider-side confirmation)
  confirmPayment: async (id) => {
    const response = await api.post(`/api/bookings/${id}/confirm-payment`);
    return response.data;
  },

  // Propose a counter-offer for a pending booking
  proposeBid: async (id, data) => {
    const response = await api.post(`/api/bookings/${id}/bid`, data);
    return response.data;
  },

  // Accept or reject the active bid
  resolveBid: async (id, action) => {
    const response = await api.post(`/api/bookings/${id}/bid/resolve`, { action });
    return response.data;
  },

  // Get booking payment status
  getPaymentStatus: async (id) => {
    const response = await api.get(`/api/bookings/${id}`);
    return response.data;
  },

  // Rate booking / leave review
  rateBooking: async (id, reviewData) => {
    const response = await api.post(`/api/reviews/booking/${id}`, reviewData, { timeout: 30000 });
    return response.data;
  }
};

export default bookingService;
