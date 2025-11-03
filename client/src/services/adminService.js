import api from './api';

const adminService = {
  // Dashboard Stats
  getDashboardStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // User Management
  getAllUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getUserById: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  updateUserStatus: async (userId, status) => {
    const response = await api.patch(`/admin/users/${userId}/status`, { status });
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  // License Verification
  getPendingVerifications: async () => {
    const response = await api.get('/admin/verifications/pending');
    return response.data;
  },

  verifyLicense: async (userId, data) => {
    const response = await api.post(`/admin/verifications/${userId}/verify`, data);
    return response.data;
  },

  rejectLicense: async (userId, reason) => {
    const response = await api.post(`/admin/verifications/${userId}/reject`, { reason });
    return response.data;
  },

  // Ride Management
  getAllRides: async (params = {}) => {
    const response = await api.get('/admin/rides', { params });
    return response.data;
  },

  getRideById: async (rideId) => {
    const response = await api.get(`/admin/rides/${rideId}`);
    return response.data;
  },

  cancelRide: async (rideId, reason) => {
    const response = await api.post(`/admin/rides/${rideId}/cancel`, { reason });
    return response.data;
  },

  // Booking Management
  getAllBookings: async (params = {}) => {
    const response = await api.get('/admin/bookings', { params });
    return response.data;
  },

  getBookingById: async (bookingId) => {
    const response = await api.get(`/admin/bookings/${bookingId}`);
    return response.data;
  },

  refundBooking: async (bookingId, amount) => {
    const response = await api.post(`/admin/bookings/${bookingId}/refund`, { amount });
    return response.data;
  },

  // Reports
  getRevenueReport: async (startDate, endDate) => {
    const response = await api.get('/admin/reports/revenue', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getUserActivityReport: async (startDate, endDate) => {
    const response = await api.get('/admin/reports/activity', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getRideAnalytics: async (period = 'week') => {
    const response = await api.get('/admin/reports/rides', { params: { period } });
    return response.data;
  },

  // SOS/Emergency Management
  getEmergencyAlerts: async () => {
    const response = await api.get('/admin/emergencies');
    return response.data;
  },

  resolveEmergency: async (emergencyId, resolution) => {
    const response = await api.post(`/admin/emergencies/${emergencyId}/resolve`, { resolution });
    return response.data;
  },

  // Support Tickets
  getSupportTickets: async (params = {}) => {
    const response = await api.get('/admin/support', { params });
    return response.data;
  },

  updateTicketStatus: async (ticketId, status) => {
    const response = await api.patch(`/admin/support/${ticketId}`, { status });
    return response.data;
  },

  replyToTicket: async (ticketId, message) => {
    const response = await api.post(`/admin/support/${ticketId}/reply`, { message });
    return response.data;
  }
};

export default adminService;
