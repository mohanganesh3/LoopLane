import api from './api';

const userService = {
  // Get dashboard data
  getDashboard: async () => {
    const response = await api.get('/api/user/dashboard');
    return response.data;
  },

  // Get user profile
  getProfile: async () => {
    const response = await api.get('/api/user/profile');
    return response.data;
  },

  // Update user profile
  updateProfile: async (data) => {
    const response = await api.post('/api/user/profile', data);
    return response.data;
  },

  // Update profile picture
  updateProfilePicture: async (formData) => {
    const response = await api.post('/api/user/profile/picture', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data'
      },
      transformRequest: [(data) => data] // Prevent axios from transforming FormData
    });
    return response.data;
  },

  // Upload driving license for verification
  uploadLicense: async (formData) => {
    const response = await api.post('/api/user/license/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Get license verification status
  getLicenseStatus: async () => {
    const response = await api.get('/api/user/license/status');
    return response.data;
  },

  // Add vehicle details
  addVehicle: async (vehicleData) => {
    const response = await api.post('/api/user/vehicle', vehicleData);
    return response.data;
  },

  // Update vehicle details
  updateVehicle: async (vehicleId, vehicleData) => {
    const response = await api.put(`/api/user/vehicle/${vehicleId}`, vehicleData);
    return response.data;
  },

  // Delete vehicle
  deleteVehicle: async (vehicleId) => {
    const response = await api.delete(`/api/user/vehicle/${vehicleId}`);
    return response.data;
  },

  // Get user's vehicles
  getVehicles: async () => {
    const response = await api.get('/api/user/vehicles');
    return response.data;
  },

  // Get trip history
  getTripHistory: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/user/trip-history?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get carbon report
  getCarbonReport: async () => {
    const response = await api.get('/api/user/carbon-report');
    return response.data;
  },

  // Get settings
  getSettings: async () => {
    const response = await api.get('/api/user/settings');
    return response.data;
  },

  // Update settings
  updateSettings: async (data) => {
    const response = await api.put('/api/user/settings', data);
    return response.data;
  },

  // Update emergency contacts
  updateEmergencyContacts: async (contacts) => {
    const response = await api.put('/api/user/emergency-contacts', { contacts });
    return response.data;
  },

  // Get emergency contacts
  getEmergencyContacts: async () => {
    const response = await api.get('/api/user/emergency-contacts/list');
    return response.data;
  },

  // Add emergency contact
  addEmergencyContact: async (contactData) => {
    const response = await api.post('/api/user/emergency-contacts/add', contactData);
    return response.data;
  },

  // Send contact verification OTP
  sendContactVerification: async (contactId) => {
    const response = await api.post(`/api/user/emergency-contacts/${contactId}/send-verification`);
    return response.data;
  },

  // Verify contact with OTP
  verifyContact: async (contactId, otp) => {
    const response = await api.post(`/api/user/emergency-contacts/${contactId}/verify`, { otp });
    return response.data;
  },

  // Set primary contact
  setPrimaryContact: async (contactId) => {
    const response = await api.post(`/api/user/emergency-contacts/${contactId}/set-primary`);
    return response.data;
  },

  // Delete emergency contact
  deleteEmergencyContact: async (contactId) => {
    const response = await api.delete(`/api/user/emergency-contacts/${contactId}`);
    return response.data;
  },

  // Get notifications
  getNotifications: async (params = {}) => {
    const response = await api.get('/api/notifications/all', { params });
    return response.data;
  },

  // Mark notification as read
  markNotificationRead: async (notificationId) => {
    const response = await api.post(`/api/notifications/${notificationId}/read`);
    return response.data;
  },

  // Mark all notifications as read
  markAllNotificationsRead: async () => {
    const response = await api.post('/api/notifications/mark-all-read');
    return response.data;
  },

  // Change password
  changePassword: async (data) => {
    const response = await api.post('/api/user/change-password', data);
    return response.data;
  },

  // Delete account
  deleteAccount: async (data = {}) => {
    const response = await api.delete('/api/user/account', { 
      data: data,
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  },

  // Get unread notification count
  getUnreadNotificationCount: async () => {
    const response = await api.get('/api/notifications/unread-count');
    return response.data;
  },

  // ✅ NEW: Trust Score & Badges APIs (Like BlaBlaCar/Uber)
  
  // Get trust score
  getTrustScore: async (userId = null) => {
    const url = userId ? `/api/user/trust-score/${userId}` : '/api/user/trust-score';
    const response = await api.get(url);
    return response.data;
  },

  // Get badges
  getBadges: async (userId = null) => {
    const url = userId ? `/api/user/badges/${userId}` : '/api/user/badges';
    const response = await api.get(url);
    return response.data;
  },

  // Check and award new badges
  checkBadges: async () => {
    const response = await api.post('/api/user/badges/check');
    return response.data;
  },

  // Get user statistics
  getUserStats: async (userId = null) => {
    const url = userId ? `/api/user/stats/${userId}` : '/api/user/stats';
    const response = await api.get(url);
    return response.data;
  },

  // Get recommended price for a ride
  getRecommendedPrice: async (distanceKm, vehicleType = 'SEDAN') => {
    const response = await api.get('/api/user/recommended-price', {
      params: { distanceKm, vehicleType }
    });
    return response.data;
  },

  // Get contribution calculator (BlaBlaCar-style cost sharing)
  getContributionCalculator: async (distanceKm, passengers = 1) => {
    const response = await api.get('/api/user/contribution-calculator', {
      params: { distanceKm, passengers }
    });
    return response.data;
  },

  // ✅ NEW: Complete Rider Profile (Vehicle + Preferences + License)
  completeRiderProfile: async (profileData) => {
    const response = await api.post('/api/user/complete-profile', profileData);
    return response.data;
  },

  // ✅ NEW: Upload verification documents (License, Aadhar, RC, Insurance, Vehicle Photos)
  uploadDocuments: async (formData) => {
    const response = await api.post('/api/user/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // ✅ NEW: Get document verification status
  getDocumentStatus: async () => {
    const response = await api.get('/api/user/documents/status');
    return response.data;
  }
};

export default userService;
