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
    if (!userId) throw new Error('userId is required');
    const validActions = ['suspend', 'SUSPENDED', 'activate', 'ACTIVE', 'delete', 'DELETED'];
    // Map action to appropriate endpoint
    if (action === 'suspend' || action === 'SUSPENDED') {
      const response = await api.post(`/api/admin/users/${userId}/suspend`, data);
      return response.data;
    } else if (action === 'activate' || action === 'ACTIVE') {
      const response = await api.post(`/api/admin/users/${userId}/activate`, data);
      return response.data;
    } else if (validActions.includes(action)) {
      const response = await api.patch(`/api/admin/users/${userId}/status`, { status: action });
      return response.data;
    } else {
      throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
    }
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/api/admin/users/${userId}`);
    return response.data;
  },

  // License Verification
  getPendingVerifications: async (params = {}) => {
    const response = await api.get('/api/admin/verifications/pending', { params });
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

  // Alias for getAllRides (backward compat)
  getRides: null, // set below

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

  // Alias for getAllBookings (backward compat)
  getBookings: null, // set below

  getBookingById: async (bookingId) => {
    const response = await api.get(`/api/admin/bookings/${bookingId}`);
    return response.data;
  },

  refundBooking: async (bookingId, amount) => {
    if (!bookingId) throw new Error('bookingId is required');
    if (typeof amount !== 'number' || amount <= 0) throw new Error('amount must be a positive number');
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

  takeReportAction: async (reportId, payload) => {
    const response = await api.post(`/api/admin/reports/${reportId}/action`, payload);
    return response.data;
  },

  issueReportRefund: async (reportId, refundAmount, notes) => {
    const response = await api.post(`/api/admin/reports/${reportId}/refund`, { refundAmount, notes });
    return response.data;
  },

  sendAdminReportMessage: async (reportId, message) => {
    const response = await api.post(`/api/admin/reports/${reportId}/message`, { message });
    return response.data;
  },

  addInvestigationEvent: async (reportId, event, details) => {
    const response = await api.post(`/api/admin/reports/${reportId}/timeline`, { event, details });
    return response.data;
  },

  updatePlaybookProgress: async (reportId, templateId, completedSteps) => {
    const response = await api.post(`/api/admin/reports/${reportId}/playbook`, { templateId, completedSteps });
    return response.data;
  },

  getSafetyMetrics: async () => {
    const response = await api.get('/api/admin/safety-metrics');
    return response.data;
  },

  // Alias for takeReportAction (backward compat)
  reviewReport: null, // set below

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

  // Sustainability Dashboard
  getSustainabilityData: async () => {
    const response = await api.get('/api/admin/sustainability');
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await api.put('/api/admin/settings', settings);
    return response.data;
  },

  getSettingsAudit: async () => {
    const response = await api.get('/api/admin/settings/audit');
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
  },

  // Employee Management (Enterprise)
  getEmployeeStats: async () => {
    const response = await api.get('/api/admin/employees/stats');
    return response.data;
  },

  getEmployees: async (params = {}) => {
    const response = await api.get('/api/admin/employees', { params });
    return response.data;
  },

  getEmployeeById: async (employeeId) => {
    const response = await api.get(`/api/admin/employees/${employeeId}`);
    return response.data;
  },

  createEmployee: async (data) => {
    const response = await api.post('/api/admin/employees', data);
    return response.data;
  },

  updateEmployee: async (employeeId, data) => {
    const response = await api.put(`/api/admin/employees/${employeeId}`, data);
    return response.data;
  },

  updateEmployeeStatus: async (employeeId, data) => {
    const response = await api.patch(`/api/admin/employees/${employeeId}/status`, data);
    return response.data;
  },

  updateEmployeeOnboarding: async (employeeId, data) => {
    const response = await api.patch(`/api/admin/employees/${employeeId}/onboarding`, data);
    return response.data;
  },

  deactivateEmployee: async (employeeId) => {
    const response = await api.delete(`/api/admin/employees/${employeeId}`);
    return response.data;
  },

  getPermissions: async () => {
    const response = await api.get('/api/admin/employees/permissions');
    return response.data;
  },

  getHexCoverage: async () => {
    const response = await api.get('/api/admin/employees/hex-coverage');
    return response.data;
  },

  // Audit Logs
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/api/admin/audit-logs', { params });
    return response.data;
  },

  // System Health
  getSystemHealth: async () => {
    const response = await api.get('/api/admin/system-health');
    return response.data;
  },

  // Advanced Analytics
  getBirdEyeData: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/bird-eye', { params });
    return response.data;
  },

  getGodsEyeData: async () => {
    const response = await api.get('/api/admin/analytics/godseye');
    return response.data;
  },

  getIsochrone: async (params) => {
    const response = await api.get('/api/admin/analytics/isochrone', { params });
    return response.data;
  },

  getWeatherGrid: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/weather', { params });
    return response.data;
  },

  getSupplyForecast: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/forecast', { params });
    return response.data;
  },

  getGeoRideAnalytics: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/ride-analytics', { params });
    return response.data;
  },

  getUserRevenue: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/user-revenue', { params });
    return response.data;
  },

  getRouteAnalytics: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/routes', { params });
    return response.data;
  },

  getAreaAnalytics: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/areas', { params });
    return response.data;
  },

  getPeriodComparison: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/comparison', { params });
    return response.data;
  },

  // Demand/Supply Analytics (C12/H3)
  getDemandSupplyAnalytics: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/demand-supply', { params });
    return response.data;
  },

  // User LTV/Churn Analytics (H4)
  getUserLTVAnalytics: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/user-ltv', { params });
    return response.data;
  },

  // Bulk Notifications (H6)
  sendBulkNotification: async (data) => {
    const response = await api.post('/api/admin/notifications/bulk', data);
    return response.data;
  },

  // Promo Codes (H7)
  getPromoCodes: async () => {
    const response = await api.get('/api/admin/promo-codes');
    return response.data;
  },

  createPromoCode: async (data) => {
    const response = await api.post('/api/admin/promo-codes', data);
    return response.data;
  },

  updatePromoCode: async (id, data) => {
    const response = await api.put(`/api/admin/promo-codes/${id}`, data);
    return response.data;
  },

  deletePromoCode: async (id) => {
    const response = await api.delete(`/api/admin/promo-codes/${id}`);
    return response.data;
  },

  togglePromoCode: async (id) => {
    const response = await api.post(`/api/admin/promo-codes/${id}/toggle`);
    return response.data;
  },

  // Data Export (C15/H9)
  exportData: async (params = {}) => {
    const response = await api.get('/api/admin/export', { params });
    return response.data;
  },

  // Payment Simulation (E1)
  simulatePayment: async (data) => {
    const response = await api.post('/api/admin/payments/simulate', data);
    return response.data;
  },

  // Invoice Generation (E7)
  generateInvoice: async (bookingId) => {
    const response = await api.get(`/api/admin/bookings/${bookingId}/invoice`);
    return response.data;
  },

  // Batch Settlement (E8)
  batchSettlement: async (data = {}) => {
    const response = await api.post('/api/admin/settlements/batch', data);
    return response.data;
  },

  // Epic 6: Autonomous Ops — Fraud Detection
  triggerFraudDetection: async (params = {}) => {
    const response = await api.post('/api/admin/analytics/fraud-detect', params);
    return response.data;
  },

  // Epic 6: Autonomous Ops — Churn Prediction
  triggerChurnPrediction: async (params = {}) => {
    const response = await api.post('/api/admin/analytics/churn-predict', params);
    return response.data;
  },

  // Cancellation Analytics
  getCancellationAnalytics: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/cancellations', { params });
    return response.data;
  },

  // Conversion Funnel Analytics
  getConversionFunnel: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/funnel', { params });
    return response.data;
  },

  // Route Demand Intelligence
  getUnbookedRoutesInsight: async (params = {}) => {
    const response = await api.get('/api/admin/analytics/unbooked-routes', { params });
    return response.data;
  },

  // AI Insights (Gemini 2.5 Flash) — with client-side cache to prevent burst
  _aiCache: new Map(),
  _AI_CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  getAIInsight: async (context, metrics = {}) => {
    const cacheKey = `${context}::${JSON.stringify(metrics)}`;
    const cached = adminService._aiCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < adminService._AI_CACHE_TTL) {
      return { success: true, data: { ...cached.data, cached: true } };
    }
    const response = await api.post('/api/admin/ai/insights', { context, metrics });
    if (response.data?.success && response.data?.data) {
      adminService._aiCache.set(cacheKey, { data: response.data.data, ts: Date.now() });
    }
    return response.data;
  },

  getAIBatchInsights: async (sections) => {
    const response = await api.post('/api/admin/ai/batch-insights', { sections });
    return response.data;
  },

  explainAnomaly: async (anomalyData) => {
    const response = await api.post('/api/admin/ai/explain-anomaly', { anomalyData });
    return response.data;
  },

  getDashboardNarrative: async () => {
    const response = await api.get('/api/admin/ai/dashboard-narrative');
    return response.data;
  },
};

// Backward-compatible aliases (deduplicated implementations)
adminService.getRides = adminService.getAllRides;
adminService.getBookings = adminService.getAllBookings;
adminService.reviewReport = adminService.takeReportAction;

export default adminService;
