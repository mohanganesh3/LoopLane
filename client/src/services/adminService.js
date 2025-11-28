import api from './api';

const adminService = {
  // Dashboard Stats
  getDashboardStats: async () => {
    const response = await api.get('/api/admin/stats');
    return response.data;
  },

  // User Management
  getAllUsers: async (params = {}) => {
    const response = await api.get('/api/admin/users', { params });
    return response.data;
  },

  getUserById: async (userId) => {
    const response = await api.get(`/api/admin/users/${userId}`);
    return response.data;
  },

  updateUserStatus: async (userId, action, data = {}) => {
    // Map action to appropriate endpoint
    if (action === 'suspend' || action === 'SUSPENDED') {
      const response = await api.post(`/api/admin/users/${userId}/suspend`, data);
      return response.data;
    } else if (action === 'activate' || action === 'ACTIVE') {
      const response = await api.post(`/api/admin/users/${userId}/activate`, data);
      return response.data;
    } else {
      const response = await api.patch(`/api/admin/users/${userId}/status`, { status: action });
      return response.data;
    }
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/api/admin/users/${userId}`);
    return response.data;
  },

  // License Verification
  getPendingVerifications: async () => {
    const response = await api.get('/api/admin/verifications/pending');
    return response.data;
  },

  verifyLicense: async (userId, data) => {
    const response = await api.post(`/api/admin/verifications/${userId}/verify`, data);
    return response.data;
  },

  rejectLicense: async (userId, reason) => {
    const response = await api.post(`/api/admin/verifications/${userId}/reject`, { reason });
    return response.data;
  },

  // Ride Management
  getAllRides: async (params = {}) => {
    const response = await api.get('/api/admin/rides', { params });
    return response.data;
  },

  getRides: async (params = {}) => {
    const response = await api.get('/api/admin/rides', { params });
    return response.data;
  },

  getRideById: async (rideId) => {
    const response = await api.get(`/api/admin/rides/${rideId}`);
    return response.data;
  },

  cancelRide: async (rideId, reason) => {
    const response = await api.post(`/api/admin/rides/${rideId}/cancel`, { reason });
    return response.data;
  },

  // Booking Management
  getAllBookings: async (params = {}) => {
    const response = await api.get('/api/admin/bookings', { params });
    return response.data;
  },

  getBookings: async (params = {}) => {
    const response = await api.get('/api/admin/bookings', { params });
    return response.data;
  },

  getBookingById: async (bookingId) => {
    const response = await api.get(`/api/admin/bookings/${bookingId}`);
    return response.data;
  },

  refundBooking: async (bookingId, amount) => {
    const response = await api.post(`/api/admin/bookings/${bookingId}/refund`, { amount });
    return response.data;
  },

  // Analytics Reports
  getRevenueReport: async (startDate, endDate) => {
    const response = await api.get('/api/admin/analytics/revenue', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getUserActivityReport: async (startDate, endDate) => {
    const response = await api.get('/api/admin/analytics/activity', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getRideAnalytics: async (period = 'week') => {
    const response = await api.get('/api/admin/analytics/rides', { params: { period } });
    return response.data;
  },

  // User Reports (complaints/issues)
  getReports: async (params = {}) => {
    const response = await api.get('/api/admin/reports', { params });
    return response.data;
  },

  getReportById: async (reportId) => {
    const response = await api.get(`/api/admin/reports/${reportId}`);
    return response.data;
  },

  takeReportAction: async (reportId, action, reason) => {
    const response = await api.post(`/api/admin/reports/${reportId}/action`, { action, reason });
    return response.data;
  },

  // Legacy alias for reviewReport
  reviewReport: async (reportId, data) => {
    const response = await api.post(`/api/admin/reports/${reportId}/action`, data);
    return response.data;
  },

  // SOS/Emergency Management
  getEmergencyAlerts: async () => {
    const response = await api.get('/api/admin/emergencies');
    return response.data;
  },

  resolveEmergency: async (emergencyId, resolution) => {
    const response = await api.post(`/api/admin/emergencies/${emergencyId}/resolve`, { resolution });
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/api/admin/settings');
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await api.put('/api/admin/settings', settings);
    return response.data;
  },

  // Notifications
  getNotifications: async () => {
    const response = await api.get('/api/admin/notifications');
    return response.data;
  },

  markNotificationAsRead: async (notificationId) => {
    const response = await api.post(`/api/admin/notifications/${notificationId}/read`);
    return response.data;
  }
};

export default adminService;
